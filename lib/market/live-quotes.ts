import {
  realQuoteSchema,
  type Holding,
  type RealQuote,
} from "./contracts";

export type LiveQuoteStatus =
  | "MOCK"
  | "CONNECTING"
  | "IEX/LIVE"
  | "STALE/FALLBACK";

export type LiveQuoteMap = Record<string, RealQuote>;

export type LiveQuoteState = {
  quotes: LiveQuoteMap;
  status: LiveQuoteStatus;
};

type EventSourceLike = {
  close(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
};

type ControllerOptions = {
  initial: RealQuote[];
  symbols: string[];
  enabled: boolean;
  buffer?: Map<string, RealQuote>;
  createEventSource?: (url: string) => EventSourceLike;
  fetchQuotes?: (symbols: string[], signal: AbortSignal) => Promise<RealQuote[]>;
  getVisibility?: () => DocumentVisibilityState;
  addVisibilityListener?: (listener: () => void) => () => void;
};

type SnapshotPayload = {
  symbol?: unknown;
  quote?: unknown;
};

type FallbackReason =
  | "transport-silence"
  | "transport-error"
  | "stale-data";

const FLUSH_MS = 1_000;
const SILENCE_MS = 5_000;
const FALLBACK_MS = 15_000;

function quoteMap(quotes: RealQuote[]): LiveQuoteMap {
  return Object.fromEntries(quotes.map((quote) => [quote.symbol, quote]));
}

function parseRealQuote(value: unknown): RealQuote | null {
  const parsed = realQuoteSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseQuoteSnapshots(data: string): RealQuote[] {
  try {
    const payload: unknown = JSON.parse(data);
    if (!Array.isArray(payload)) return [];
    return payload.flatMap((item: SnapshotPayload) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.symbol !== "string"
      ) {
        return [];
      }
      const quote = parseRealQuote(item.quote);
      return quote && item.symbol === quote.symbol ? [quote] : [];
    });
  } catch {
    return [];
  }
}

export function mergeQuoteRows(
  initial: RealQuote[],
  live: LiveQuoteMap,
): RealQuote[] {
  return initial.map((quote) => live[quote.symbol] ?? quote);
}

export function aggregateQuoteSectors(quotes: RealQuote[]): [string, number][] {
  const groups = new Map<string, number[]>();
  for (const quote of quotes) {
    if (
      !quote.sector ||
      quote.sector === "ETF" ||
      quote.changePercent === null
    ) {
      continue;
    }
    const changes = groups.get(quote.sector) ?? [];
    changes.push(quote.changePercent);
    groups.set(quote.sector, changes);
  }
  return [...groups].map(([sector, changes]) => [
    sector,
    changes.reduce((sum, change) => sum + change, 0) / changes.length,
  ]);
}

export function mergePortfolioQuotes<T extends Holding>(
  holdings: T[],
  live: LiveQuoteMap,
): T[] {
  return holdings.map((holding) => {
    if (holding.symbol === "CASH") return holding;
    const quote = live[holding.symbol];
    if (!quote) return holding;
    return {
      ...holding,
      price: quote.price ?? holding.price,
      previousPrice: quote.previousClose ?? holding.previousPrice,
    };
  });
}

export function createLiveQuoteController(options: ControllerOptions) {
  const symbols = [...new Set(options.symbols.map((symbol) => symbol.toUpperCase()))];
  const buffer = options.buffer ?? new Map<string, RealQuote>();
  const listeners = new Set<(state: LiveQuoteState) => void>();
  let state: LiveQuoteState = {
    quotes: quoteMap(options.initial),
    status: options.enabled ? "CONNECTING" : "MOCK",
  };
  let source: EventSourceLike | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let fallbackAbort: AbortController | null = null;
  let removeVisibilityListener: (() => void) | null = null;
  let started = false;
  let stopped = false;
  let fallbackGeneration = 0;
  let fallbackInFlightGeneration: number | null = null;
  let transportHealthy = false;
  const fallbackReasons = new Set<FallbackReason>();

  const getVisibility =
    options.getVisibility ??
    (() =>
      typeof document === "undefined" ? "visible" : document.visibilityState);
  const addVisibilityListener =
    options.addVisibilityListener ??
    ((listener: () => void) => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    });
  const createEventSource =
    options.createEventSource ??
    ((url: string) => new EventSource(url) as EventSourceLike);
  const fetchQuotes =
    options.fetchQuotes ??
    (async (requestedSymbols: string[], signal: AbortSignal) => {
      const response = await fetch(
        `/api/market/quotes?symbols=${encodeURIComponent(requestedSymbols.join(","))}`,
        { cache: "no-store", signal },
      );
      if (!response.ok) throw new Error("Quote fallback unavailable");
      const payload = (await response.json()) as { quotes?: unknown };
      return Array.isArray(payload.quotes)
        ? payload.quotes.flatMap((quote) => {
            const parsed = parseRealQuote(quote);
            return parsed ? [parsed] : [];
          })
        : [];
    });

  function publish(next: LiveQuoteState) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  function setStatus(status: LiveQuoteStatus) {
    if (state.status !== status) publish({ ...state, status });
  }

  function enqueue(quotes: RealQuote[]) {
    for (const quote of quotes) buffer.set(quote.symbol, quote);
  }

  function flush() {
    if (stopped || getVisibility() === "hidden" || buffer.size === 0) return;
    publish({
      ...state,
      quotes: { ...state.quotes, ...Object.fromEntries(buffer) },
    });
    buffer.clear();
  }

  function invalidateFallbackRequest() {
    fallbackGeneration += 1;
    fallbackAbort?.abort();
    fallbackAbort = null;
    fallbackInFlightGeneration = null;
  }

  function stopFallback() {
    if (fallbackTimer !== null) clearInterval(fallbackTimer);
    fallbackTimer = null;
    invalidateFallbackRequest();
    fallbackReasons.clear();
  }

  async function pollFallback() {
    const generation = fallbackGeneration;
    if (stopped || fallbackInFlightGeneration === generation) return;
    fallbackInFlightGeneration = generation;
    const abort = new AbortController();
    fallbackAbort = abort;
    try {
      const quotes = await fetchQuotes(symbols, abort.signal);
      if (!stopped && fallbackGeneration === generation) enqueue(quotes);
    } catch {
      // The status already exposes fallback staleness; the next poll retries.
    } finally {
      if (fallbackGeneration === generation) {
        if (fallbackAbort === abort) fallbackAbort = null;
        if (fallbackInFlightGeneration === generation) {
          fallbackInFlightGeneration = null;
        }
      }
    }
  }

  function startFallback(reason: FallbackReason) {
    if (stopped) return;
    fallbackReasons.add(reason);
    setStatus("STALE/FALLBACK");
    if (fallbackTimer !== null) return;
    void pollFallback();
    fallbackTimer = setInterval(() => void pollFallback(), FALLBACK_MS);
  }

  function armTransportSilenceTimer() {
    if (silenceTimer !== null) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      transportHealthy = false;
      startFallback("transport-silence");
    }, SILENCE_MS);
  }

  function markTransportHealthy() {
    const transportWasUnhealthy = !transportHealthy;
    transportHealthy = true;
    armTransportSilenceTimer();
    const clearedSilence = fallbackReasons.delete("transport-silence");
    const clearedError = fallbackReasons.delete("transport-error");
    const clearedTransportReason =
      transportWasUnhealthy && (clearedSilence || clearedError);
    if (clearedTransportReason && fallbackReasons.size === 0) {
      stopFallback();
      setStatus("CONNECTING");
    }
  }

  function markFreshStreamData() {
    transportHealthy = true;
    armTransportSilenceTimer();
    stopFallback();
    setStatus("IEX/LIVE");
  }

  const onQuotes = (event: Event) => {
    const quotes = parseQuoteSnapshots((event as MessageEvent<string>).data);
    if (quotes.length === 0) return;
    enqueue(quotes);
    if (quotes.some((quote) => !quote.stale)) {
      markFreshStreamData();
    } else {
      markTransportHealthy();
      startFallback("stale-data");
    }
  };
  const onHeartbeat = () => markTransportHealthy();

  function start() {
    if (started || !options.enabled || symbols.length === 0) return;
    started = true;
    stopped = false;
    source = createEventSource(
      `/api/market/stream?symbols=${encodeURIComponent(symbols.join(","))}`,
    );
    source.addEventListener("snapshot", onQuotes);
    source.addEventListener("batch", onQuotes);
    source.addEventListener("heartbeat", onHeartbeat);
    source.onopen = () => {
      markTransportHealthy();
      if (state.status !== "IEX/LIVE" && state.status !== "STALE/FALLBACK") {
        setStatus("CONNECTING");
      }
    };
    source.onerror = () => {
      transportHealthy = false;
      startFallback("transport-error");
    };
    flushTimer = setInterval(flush, FLUSH_MS);
    removeVisibilityListener = addVisibilityListener(() => {
      if (getVisibility() === "visible") flush();
    });
    armTransportSilenceTimer();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (flushTimer !== null) clearInterval(flushTimer);
    if (silenceTimer !== null) clearTimeout(silenceTimer);
    flushTimer = null;
    silenceTimer = null;
    stopFallback();
    removeVisibilityListener?.();
    removeVisibilityListener = null;
    if (source) {
      source.removeEventListener("snapshot", onQuotes);
      source.removeEventListener("batch", onQuotes);
      source.removeEventListener("heartbeat", onHeartbeat);
      source.onopen = null;
      source.onerror = null;
      source.close();
      source = null;
    }
    buffer.clear();
    listeners.clear();
  }

  return {
    start,
    stop,
    getState: () => state,
    subscribe(listener: (next: LiveQuoteState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
