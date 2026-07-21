import "server-only";

import type { RealQuote } from "./contracts";
import {
  BARS_MAX_STALE_MS,
  BARS_TTL_MS,
  SEC_MAX_STALE_MS,
  SEC_TTL_MS,
  SNAPSHOT_MAX_STALE_MS,
  SNAPSHOT_TTL_MS,
  createTtlCache,
} from "./cache.server";
import { mapAlpacaQuote } from "./mappers";
import { createAlpacaProvider } from "./providers/alpaca";
import { SYMBOL_METADATA } from "./symbols";

type AlpacaProvider = ReturnType<typeof createAlpacaProvider>;

type QuoteServiceOptions = {
  provider?: AlpacaProvider;
  now?: () => Date;
};

export type QuoteHistoryPoint = {
  date: string;
  price: number;
  volume: number;
};

export function createSecTtlCache<T>() {
  return createTtlCache<T>({
    ttlMs: SEC_TTL_MS,
    maxStaleMs: SEC_MAX_STALE_MS,
  });
}

export function createQuoteService(options: QuoteServiceOptions = {}) {
  const provider = options.provider ?? createAlpacaProvider();
  const now = options.now ?? (() => new Date());
  const snapshotCache = createTtlCache<
    Awaited<ReturnType<AlpacaProvider["getSnapshots"]>>
  >({ ttlMs: SNAPSHOT_TTL_MS, maxStaleMs: SNAPSHOT_MAX_STALE_MS });
  const barsCache = createTtlCache<
    Awaited<ReturnType<AlpacaProvider["getBars"]>>
  >({ ttlMs: BARS_TTL_MS, maxStaleMs: BARS_MAX_STALE_MS });

  function loadBars(symbols: string[], end: Date) {
    const key = symbols.slice().sort().join(",");
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60_000);
    return barsCache.getOrLoad(key, () =>
      provider.getBars(symbols, {
        timeframe: "1Day",
        start: start.toISOString(),
        end: end.toISOString(),
        limit: 30,
      }),
    );
  }

  return {
    async loadQuotes(symbols: string[]): Promise<RealQuote[]> {
      const normalized = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
      const key = normalized.slice().sort().join(",");
      const end = now();
      const [snapshots, bars] = await Promise.all([
        snapshotCache.getOrLoad(key, () => provider.getSnapshots(normalized)),
        loadBars(normalized, end),
      ]);

      return normalized.map((symbol) => {
        const metadata = SYMBOL_METADATA[symbol];
        const quote = mapAlpacaQuote({
          symbol,
          name: metadata?.name,
          sector: metadata?.sector,
          snapshot: snapshots.value[symbol] ?? {},
          bars: bars.value.bars[symbol] ?? [],
          now: end,
        });
        return snapshots.stale || bars.stale ? { ...quote, stale: true } : quote;
      });
    },

    async loadHistory(symbolValue: string): Promise<QuoteHistoryPoint[]> {
      const symbol = symbolValue.toUpperCase();
      const bars = await loadBars([symbol], now());
      return (bars.value.bars[symbol] ?? []).map((bar) => ({
        date: bar.t.slice(0, 10),
        price: bar.c,
        volume: bar.v ?? 0,
      }));
    },
  };
}

type QuoteService = ReturnType<typeof createQuoteService>;
const globalQuotes = globalThis as typeof globalThis & {
  __marketQuoteService?: QuoteService;
};

export function getQuoteService() {
  return (
    globalQuotes.__marketQuoteService ??
    (globalQuotes.__marketQuoteService = createQuoteService())
  );
}
