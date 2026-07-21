import { afterEach, describe, expect, it, vi } from "vitest";
import type { RealQuote } from "./contracts";
import {
  aggregateQuoteSectors,
  createLiveQuoteController,
  mergePortfolioQuotes,
  mergeQuoteRows,
} from "./live-quotes";

const baseQuote: RealQuote = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: 200,
  previousClose: 196,
  change: 4,
  changePercent: 2.04,
  sector: "Technology",
  marketCap: null,
  pe: null,
  volume: 10,
  spark: [196, 200],
  source: "alpaca",
  asOf: "2026-07-21T20:00:00Z",
  stale: false,
};

type Listener = (event: MessageEvent<string>) => void;

type FetchQuotes = (
  symbols: string[],
  signal: AbortSignal,
) => Promise<RealQuote[]>;

function createHarness(options: {
  fetchQuotes?: ReturnType<typeof vi.fn<FetchQuotes>>;
  buffer?: Map<string, RealQuote>;
} = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const source = {
    close: vi.fn(),
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      const set = listeners.get(name) ?? new Set<Listener>();
      set.add(listener as Listener);
      listeners.set(name, set);
    }),
    removeEventListener: vi.fn((name: string, listener: EventListener) => {
      listeners.get(name)?.delete(listener as Listener);
    }),
    onopen: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  const visibilityListeners = new Set<() => void>();
  let visibility: DocumentVisibilityState = "visible";
  const fetchQuotes =
    options.fetchQuotes ??
    vi.fn(async () => [
      { ...baseQuote, price: 215, change: 19, asOf: "2026-07-21T20:00:15Z" },
    ]);
  const states: ReturnType<ReturnType<typeof createLiveQuoteController>["getState"]>[] = [];
  const controller = createLiveQuoteController({
    initial: [baseQuote],
    symbols: ["AAPL"],
    enabled: true,
    buffer: options.buffer,
    createEventSource: vi.fn(() => source),
    fetchQuotes,
    getVisibility: () => visibility,
    addVisibilityListener: (listener) => {
      visibilityListeners.add(listener);
      return () => visibilityListeners.delete(listener);
    },
  });
  controller.subscribe((state) => states.push(state));

  return {
    controller,
    source,
    fetchQuotes,
    states,
    emit(name: string, value: unknown) {
      const event = { data: JSON.stringify(value) } as MessageEvent<string>;
      for (const listener of listeners.get(name) ?? []) listener(event);
    },
    hide() {
      visibility = "hidden";
      for (const listener of visibilityListeners) listener();
    },
    show() {
      visibility = "visible";
      for (const listener of visibilityListeners) listener();
    },
    visibilityListeners,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("live quote controller", () => {
  it("atomically flushes the latest buffered quote once per second", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.controller.start();

    harness.emit("batch", [
      { symbol: "AAPL", quote: { ...baseQuote, price: 201 } },
      { symbol: "AAPL", quote: { ...baseQuote, price: 202 } },
    ]);
    expect(harness.controller.getState().quotes.AAPL.price).toBe(200);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.controller.getState().quotes.AAPL.price).toBe(202);
  });

  it("uses heartbeats to keep a quote-less transport healthy without claiming LIVE", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.controller.start();

    for (let elapsed = 0; elapsed < 6_000; elapsed += 2_000) {
      harness.emit("heartbeat", { asOf: "2026-07-21T20:00:30Z" });
      await vi.advanceTimersByTimeAsync(2_000);
    }
    expect(harness.controller.getState().status).toBe("CONNECTING");
    expect(harness.fetchQuotes).not.toHaveBeenCalled();
  });

  it("keeps stale-data fallback after transport error recovery", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.controller.start();
    harness.emit("batch", [
      { symbol: "AAPL", quote: { ...baseQuote, price: 199, stale: true } },
    ]);
    harness.source.onerror?.();
    harness.emit("heartbeat", { asOf: "2026-07-21T20:00:30Z" });
    await vi.advanceTimersByTimeAsync(2_000);

    expect(harness.controller.getState().status).toBe("STALE/FALLBACK");
    expect(harness.fetchQuotes).toHaveBeenCalledOnce();
  });

  it("stops transport-error fallback when a heartbeat proves recovery", async () => {
    vi.useFakeTimers();
    const fetchQuotes = vi.fn<FetchQuotes>(
      () => new Promise(() => {}),
    );
    const harness = createHarness({ fetchQuotes });
    harness.controller.start();
    harness.source.onerror?.();
    const signal = fetchQuotes.mock.calls[0][1];
    harness.emit("heartbeat", { asOf: "2026-07-21T20:00:30Z" });

    expect(signal.aborted).toBe(true);
    expect(harness.controller.getState().status).toBe("CONNECTING");
    expect(fetchQuotes).toHaveBeenCalledOnce();
  });

  it("leaves fallback only after a fresh stream quote arrives", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.controller.start();
    await vi.advanceTimersByTimeAsync(5_001);

    harness.emit("batch", [
      { symbol: "AAPL", quote: { ...baseQuote, price: 205, stale: false } },
    ]);
    expect(harness.controller.getState().status).toBe("IEX/LIVE");

    await vi.advanceTimersByTimeAsync(5_001);
    expect(harness.controller.getState().status).toBe("STALE/FALLBACK");
  });

  it("discards an in-flight fallback result after fresh SSE recovery", async () => {
    vi.useFakeTimers();
    let resolveFallback!: (quotes: RealQuote[]) => void;
    const fetchQuotes = vi.fn<FetchQuotes>(
      () =>
        new Promise((resolve) => {
          resolveFallback = resolve;
        }),
    );
    const harness = createHarness({ fetchQuotes });
    harness.controller.start();
    await vi.advanceTimersByTimeAsync(5_001);
    const signal = fetchQuotes.mock.calls[0][1];

    harness.emit("batch", [
      { symbol: "AAPL", quote: { ...baseQuote, price: 205, stale: false } },
    ]);
    expect(signal.aborted).toBe(true);
    resolveFallback([{ ...baseQuote, price: 999, stale: true }]);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.controller.getState().quotes.AAPL.price).toBe(205);
    expect(harness.controller.getState().status).toBe("IEX/LIVE");
  });

  it("does not leak an old fallback result into a rebuilt controller", async () => {
    vi.useFakeTimers();
    const buffer = new Map<string, RealQuote>();
    let resolveFallback!: (quotes: RealQuote[]) => void;
    const fetchQuotes = vi.fn<FetchQuotes>(
      () =>
        new Promise((resolve) => {
          resolveFallback = resolve;
        }),
    );
    const oldHarness = createHarness({ fetchQuotes, buffer });
    oldHarness.controller.start();
    await vi.advanceTimersByTimeAsync(5_001);
    oldHarness.controller.stop();

    const rebuilt = createHarness({ buffer });
    rebuilt.controller.start();
    resolveFallback([{ ...baseQuote, price: 999, stale: true }]);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(rebuilt.controller.getState().quotes.AAPL.price).toBe(200);
    rebuilt.controller.stop();
  });

  it("pauses hidden-page flushes and flushes immediately when visible", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.controller.start();
    harness.hide();
    harness.emit("snapshot", [
      { symbol: "AAPL", quote: { ...baseQuote, price: 205 } },
    ]);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(harness.controller.getState().quotes.AAPL.price).toBe(200);

    harness.show();
    expect(harness.controller.getState().quotes.AAPL.price).toBe(205);
  });

  it("closes the stream and clears every timer and listener on cleanup", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.controller.start();
    harness.source.onerror?.();
    await vi.runOnlyPendingTimersAsync();

    harness.controller.stop();

    expect(harness.source.close).toHaveBeenCalledOnce();
    expect(harness.visibilityListeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("stream quote validation", () => {
  it("rejects malformed quotes and outer-symbol mismatches", async () => {
    const { parseQuoteSnapshots } = await import("./live-quotes");

    expect(
      parseQuoteSnapshots(
        JSON.stringify([
          { symbol: "MSFT", quote: baseQuote },
          {
            symbol: "AAPL",
            quote: { ...baseQuote, price: "not-a-number" },
          },
        ]),
      ),
    ).toEqual([]);
  });
});

describe("client quote merging", () => {
  it("recomputes sector breadth from available non-ETF changes", () => {
    expect(
      aggregateQuoteSectors([
        baseQuote,
        { ...baseQuote, symbol: "MSFT", changePercent: -1 },
        { ...baseQuote, symbol: "SPY", sector: "ETF", changePercent: 10 },
        { ...baseQuote, symbol: "NVDA", sector: null, changePercent: null },
      ]),
    ).toEqual([["Technology", 0.52]]);
  });

  it("merges live fields without dropping initial nullable metadata", () => {
    const merged = mergeQuoteRows(
      [{ ...baseQuote, name: null, marketCap: null }],
      { AAPL: { ...baseQuote, price: 210, name: "Apple Inc." } },
    );

    expect(merged[0]).toMatchObject({
      symbol: "AAPL",
      price: 210,
      name: "Apple Inc.",
      marketCap: null,
    });
  });

  it("updates portfolio prices while preserving position inputs and cash", () => {
    const holdings = [
      {
        symbol: "AAPL",
        shares: 12,
        avg: 180,
        price: 200,
        previousPrice: 196,
        sector: "Technology",
      },
      {
        symbol: "CASH",
        shares: 1,
        avg: 500,
        price: 500,
        previousPrice: 500,
        sector: "Cash",
      },
    ];

    expect(
      mergePortfolioQuotes(holdings, {
        AAPL: { ...baseQuote, price: 210, previousClose: 195 },
      }),
    ).toEqual([
      { ...holdings[0], price: 210, previousPrice: 195 },
      holdings[1],
    ]);
  });
});
