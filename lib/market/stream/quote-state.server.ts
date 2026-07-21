import "server-only";

import type { RealQuote } from "../contracts";
import { SYMBOL_METADATA } from "../symbols";

export type AlpacaStreamTrade = {
  T: "t";
  S: string;
  p: number;
  s?: number;
  t: string;
};

export type AlpacaStreamBar = {
  T: "b";
  S: string;
  o?: number;
  h?: number;
  l?: number;
  c: number;
  v?: number;
  t: string;
};

export type QuoteTrade = {
  price: number;
  size: number | null;
  asOf: string;
};

export type QuoteBar = {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  asOf: string;
};

export type QuoteStateSnapshot = {
  symbol: string;
  quote: RealQuote;
  trade?: QuoteTrade;
  bar?: QuoteBar;
  stale: boolean;
  source: "alpaca";
  asOf: string | null;
};

export type QuoteStateListener = (batch: QuoteStateSnapshot[]) => void;
export type AlpacaQuoteEvent = AlpacaStreamTrade | AlpacaStreamBar;

function newer(first?: string, second?: string) {
  if (!first) return second ?? null;
  if (!second) return first;
  return Date.parse(first) >= Date.parse(second) ? first : second;
}

function emptyQuote(symbol: string): RealQuote {
  const metadata = SYMBOL_METADATA[symbol];
  return {
    symbol,
    name: metadata?.name ?? null,
    price: null,
    previousClose: null,
    change: null,
    changePercent: null,
    sector: metadata?.sector ?? null,
    marketCap: null,
    pe: null,
    volume: null,
    spark: [],
    source: "alpaca",
    asOf: null,
    stale: true,
  };
}

export function createQuoteState() {
  const records = new Map<string, QuoteStateSnapshot>();
  const previousCloses = new Map<string, number>();
  const listeners = new Set<QuoteStateListener>();

  function get(symbolValue: string) {
    const symbol = symbolValue.toUpperCase();
    return records.get(symbol) ?? {
      symbol,
      quote: emptyQuote(symbol),
      stale: true,
      source: "alpaca" as const,
      asOf: null,
    };
  }

  function store(snapshot: QuoteStateSnapshot) {
    records.set(snapshot.symbol, snapshot);
  }

  function applyOne(message: AlpacaQuoteEvent) {
    if (message.T === "t") {
      const symbol = message.S.toUpperCase();
      const current = get(symbol);
      const trade = {
        price: message.p,
        size: message.s ?? null,
        asOf: message.t,
      };
      const asOf = newer(message.t, current.bar?.asOf);
      const previousClose = previousCloses.get(symbol);
      const rawChange =
        previousClose === undefined ? null : message.p - previousClose;
      const snapshot = {
        ...current,
        symbol,
        trade,
        stale: false,
        asOf,
        quote: {
          ...current.quote,
          symbol,
          price: message.p,
          change:
            rawChange === null ? null : Math.round(rawChange * 100) / 100,
          changePercent:
            rawChange === null ||
            previousClose === undefined ||
            previousClose === 0
              ? null
              : (rawChange / previousClose) * 100,
          asOf,
          stale: false,
        },
      };
      store(snapshot);
      return snapshot;
    } else {
      const symbol = message.S.toUpperCase();
      const current = get(symbol);
      const bar = {
        open: message.o ?? null,
        high: message.h ?? null,
        low: message.l ?? null,
        close: message.c,
        volume: message.v === undefined ? null : message.v / 1_000_000,
        asOf: message.t,
      };
      const asOf = newer(current.trade?.asOf, message.t);
      const price = current.trade?.price ?? message.c;
      const previousClose = previousCloses.get(symbol);
      const rawChange =
        previousClose === undefined ? null : price - previousClose;
      const snapshot = {
        ...current,
        symbol,
        bar,
        stale: false,
        asOf,
        quote: {
          ...current.quote,
          symbol,
          price,
          change:
            rawChange === null ? null : Math.round(rawChange * 100) / 100,
          changePercent:
            rawChange === null ||
            previousClose === undefined ||
            previousClose === 0
              ? null
              : (rawChange / previousClose) * 100,
          volume:
            message.v === undefined
              ? current.quote.volume
              : message.v / 1_000_000,
          spark: [...current.quote.spark, message.c].slice(-30),
          asOf,
          stale: false,
        },
      };
      store(snapshot);
      return snapshot;
    }
  }

  function notify(batch: QuoteStateSnapshot[]) {
    if (!batch.length) return;
    for (const listener of listeners) listener(batch);
  }

  function apply(messages: Iterable<AlpacaQuoteEvent>) {
    const changed = new Map<string, QuoteStateSnapshot>();
    for (const message of messages) {
      const snapshot = applyOne(message);
      changed.set(snapshot.symbol, snapshot);
    }
    const batch = [...changed.values()];
    notify(batch);
    return batch;
  }

  return {
    apply,

    seed(quotes: Iterable<RealQuote>) {
      const batch: QuoteStateSnapshot[] = [];
      for (const quote of quotes) {
        const symbol = quote.symbol.toUpperCase();
        if (quote.previousClose !== null) {
          previousCloses.set(symbol, quote.previousClose);
        }
        const snapshot: QuoteStateSnapshot = {
          symbol,
          quote: { ...quote, symbol },
          stale: quote.stale,
          source: "alpaca",
          asOf: quote.asOf,
        };
        store(snapshot);
        batch.push(snapshot);
      }
      notify(batch);
      return batch;
    },

    updateTrade(message: AlpacaStreamTrade) {
      apply([message]);
    },

    updateBar(message: AlpacaStreamBar) {
      apply([message]);
    },

    markStale(symbolValues?: Iterable<string>) {
      const symbols = symbolValues
        ? [...symbolValues].map((symbol) => symbol.toUpperCase())
        : [...records.keys()];
      const batch: QuoteStateSnapshot[] = [];
      for (const symbol of symbols) {
        const current = get(symbol);
        const stale = {
          ...current,
          stale: true,
          quote: { ...current.quote, stale: true },
        };
        records.set(symbol, stale);
        batch.push(stale);
      }
      notify(batch);
    },

    snapshots(symbolValues: Iterable<string>) {
      return [...symbolValues].map((symbol) => get(symbol));
    },

    subscribe(listener: QuoteStateListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type QuoteState = ReturnType<typeof createQuoteState>;

const globalState = globalThis as typeof globalThis & {
  __marketQuoteState?: QuoteState;
};

export const quoteState =
  globalState.__marketQuoteState ?? (globalState.__marketQuoteState = createQuoteState());
