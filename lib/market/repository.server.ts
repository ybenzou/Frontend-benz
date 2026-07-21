import "server-only";

import { marketRepository } from "../market-data";
import { MarketDataUnavailableError } from "./cache.server";
import {
  eventSchema,
  researchSchema,
  type MarketEvent,
  type Quote,
  type RealQuote,
  type ResearchSnapshot,
  type SecCompanyFacts,
} from "./contracts";
import { extractSecFundamentals } from "./mappers";
import {
  createQuoteService,
  createSecTtlCache,
  getQuoteService,
  type QuoteHistoryPoint,
} from "./quotes.server";
import { createSecProvider } from "./providers/sec";
import { quoteState } from "./stream/quote-state.server";
import { SYMBOL_METADATA } from "./symbols";

const EQUITY_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "JPM",
  "LLY",
  "XOM",
  "COST",
] as const;
const PROXY_SYMBOLS = ["SPY", "QQQ", "DIA", "IWM"] as const;
const PROXY_NAMES: Record<(typeof PROXY_SYMBOLS)[number], string> = {
  SPY: "S&P 500 ETF proxy",
  QQQ: "Nasdaq 100 ETF proxy",
  DIA: "Dow Jones ETF proxy",
  IWM: "Russell 2000 ETF proxy",
};

type Environment = Partial<Record<string, string | undefined>>;
type QuoteService = Pick<
  ReturnType<typeof createQuoteService>,
  "loadQuotes" | "loadHistory"
>;
type SecProvider = Pick<ReturnType<typeof createSecProvider>, "getCompanyFacts">;
type DisplayQuote = Quote | RealQuote;

export type MarketOverview = {
  mode: "mock" | "real";
  dataLabel: "MOCK" | "IEX · ETF PROXY";
  snapshotDate: string;
  marketStatus: string;
  indices: {
    name: string;
    symbol: string;
    value: number | null;
    change: number | null;
    proxy: boolean;
  }[];
  sectors: [string, number][];
  events: MarketEvent[];
  eventSource: "static";
  watchlist: DisplayQuote[];
  liveQuotes: RealQuote[];
};

type RepositoryOptions = {
  env?: Environment;
  quoteService?: QuoteService;
  secProvider?: SecProvider;
  now?: () => Date;
  seedQuotes?: (quotes: RealQuote[]) => void;
};

function marketMode(env: Environment): "mock" | "real" {
  const value = env.MARKET_DATA_MODE?.trim().toLowerCase();
  if (!value || value === "mock") return "mock";
  if (value === "real") return "real";
  throw new Error("MARKET_DATA_MODE must be mock or real");
}

function aggregateSectors(quotes: RealQuote[]): [string, number][] {
  const groups = new Map<string, number[]>();
  for (const quote of quotes) {
    if (!quote.sector || quote.sector === "ETF" || quote.changePercent === null) {
      continue;
    }
    groups.set(quote.sector, [
      ...(groups.get(quote.sector) ?? []),
      quote.changePercent,
    ]);
  }
  return [...groups.entries()]
    .map(
      ([sector, changes]) =>
        [
          sector,
          changes.reduce((sum, change) => sum + change, 0) / changes.length,
        ] as [string, number],
    )
    .sort(([left], [right]) => left.localeCompare(right));
}

function mockOverview(): MarketOverview {
  const overview = marketRepository.getOverview();
  return {
    mode: "mock",
    dataLabel: "MOCK",
    snapshotDate: overview.snapshotDate,
    marketStatus: overview.marketStatus,
    indices: overview.indices.map((index) => ({
      name: index.name,
      symbol: index.symbol,
      value: Number(index.value.replaceAll(",", "")),
      change: index.change,
      proxy: false,
    })),
    sectors: overview.sectors.map(([sector, change]) => [sector, change]),
    events: overview.events,
    eventSource: "static",
    watchlist: overview.watchlist,
    liveQuotes: [],
  };
}

function realFinancials(fundamentals: ReturnType<typeof extractSecFundamentals>) {
  if (
    fundamentals.fiscalYear === null ||
    (fundamentals.revenue === null && fundamentals.netIncome === null)
  ) {
    return [];
  }
  const revenue =
    fundamentals.revenue === null
      ? null
      : fundamentals.revenue / 1_000_000_000;
  const income =
    fundamentals.netIncome === null
      ? null
      : fundamentals.netIncome / 1_000_000_000;
  return [
    {
      year: `FY${fundamentals.fiscalYear}`,
      revenue,
      income,
      margin:
        revenue === null || income === null || revenue === 0
          ? null
          : (income / revenue) * 100,
    },
  ];
}

export function createMarketServerRepository(options: RepositoryOptions = {}) {
  const env = options.env ?? process.env;
  const mode = marketMode(env);
  const now = options.now ?? (() => new Date());
  const secCache = createSecTtlCache<SecCompanyFacts>();
  const quotes = () => options.quoteService ?? getQuoteService();
  const sec = () => options.secProvider ?? createSecProvider({ env });
  const seedQuotes = options.seedQuotes ?? ((loaded: RealQuote[]) => quoteState.seed(loaded));

  return {
    mode,

    async getQuotes(): Promise<DisplayQuote[]> {
      if (mode === "mock") return marketRepository.getQuotes();
      const loaded = await quotes().loadQuotes([...EQUITY_SYMBOLS]);
      seedQuotes(loaded);
      return loaded;
    },

    async getPortfolio() {
      const portfolio = marketRepository.getPortfolio();
      if (mode === "mock") {
        return {
          ...portfolio,
          mode: "mock" as const,
          dataLabel: "MOCK" as const,
          quotes: [] as RealQuote[],
        };
      }

      const symbols = portfolio.holdings
        .filter(({ symbol }) => symbol !== "CASH")
        .map(({ symbol }) => symbol);
      const loaded = await quotes().loadQuotes(symbols);
      seedQuotes(loaded);
      const bySymbol = new Map(loaded.map((quote) => [quote.symbol, quote]));
      return {
        ...portfolio,
        mode: "real" as const,
        dataLabel: "IEX" as const,
        snapshotDate: now().toISOString().slice(0, 10),
        quotes: loaded,
        holdings: portfolio.holdings.map((holding) => {
          if (holding.symbol === "CASH") return holding;
          const quote = bySymbol.get(holding.symbol);
          return {
            ...holding,
            price: quote?.price ?? holding.price,
            previousPrice: quote?.previousClose ?? holding.previousPrice,
          };
        }),
      };
    },

    async getOverview(): Promise<MarketOverview> {
      if (mode === "mock") return mockOverview();

      const loaded = await quotes().loadQuotes([
        ...EQUITY_SYMBOLS,
        ...PROXY_SYMBOLS,
      ]);
      quoteState.seed(loaded);
      const bySymbol = new Map(loaded.map((quote) => [quote.symbol, quote]));
      const staticOverview = marketRepository.getOverview();

      return {
        mode: "real",
        dataLabel: "IEX · ETF PROXY",
        snapshotDate: now().toISOString().slice(0, 10),
        marketStatus: "Alpaca market data · IEX feed",
        indices: PROXY_SYMBOLS.map((symbol) => {
          const quote = bySymbol.get(symbol);
          return {
            name: PROXY_NAMES[symbol],
            symbol,
            value: quote?.price ?? null,
            change: quote?.changePercent ?? null,
            proxy: true,
          };
        }),
        sectors: aggregateSectors(
          EQUITY_SYMBOLS.flatMap((symbol) => {
            const quote = bySymbol.get(symbol);
            return quote ? [quote] : [];
          }),
        ),
        events: eventSchema.array().parse(staticOverview.events),
        eventSource: "static",
        watchlist: EQUITY_SYMBOLS.slice(0, 4).flatMap((symbol) => {
          const quote = bySymbol.get(symbol);
          return quote ? [quote] : [];
        }),
        liveQuotes: [...PROXY_SYMBOLS, ...EQUITY_SYMBOLS.slice(0, 4)].flatMap(
          (symbol) => {
            const quote = bySymbol.get(symbol);
            return quote ? [quote] : [];
          },
        ),
      };
    },

    async getResearch(symbolValue: string): Promise<ResearchSnapshot | undefined> {
      const symbol = symbolValue.toUpperCase();
      if (mode === "mock") return marketRepository.getResearch(symbol);

      const metadata = SYMBOL_METADATA[symbol];
      if (!metadata || !metadata.cik || metadata.sector === "ETF") return undefined;

      const [loadedQuotes, history, factsResult] = await Promise.all([
        quotes().loadQuotes([symbol]),
        quotes().loadHistory(symbol),
        secCache.getOrLoad(metadata.cik, () =>
          sec().getCompanyFacts(metadata.cik as string),
        ),
      ]);
      const loadedQuote = loadedQuotes[0];
      if (!loadedQuote || loadedQuote.price === null) {
        throw new MarketDataUnavailableError(
          `Market data unavailable for ${symbol}`,
        );
      }
      quoteState.seed([loadedQuote]);
      const fundamentals = extractSecFundamentals(symbol, factsResult.value, {
        now: now(),
      });
      const marketCap =
        fundamentals.sharesOutstanding === null
          ? null
          : (loadedQuote.price * fundamentals.sharesOutstanding) / 1_000_000_000;
      const quote = { ...loadedQuote, marketCap };

      return researchSchema.parse({
        quote,
        history,
        financials: realFinancials(fundamentals),
        metrics: {
          enterpriseValue: null,
          evEbitda: null,
          dividendYield: null,
          beta: null,
          low52Week: null,
          high52Week: null,
        },
        events: [],
        source: "alpaca+sec",
        asOf: quote.asOf,
        stale: quote.stale || fundamentals.stale || factsResult.stale,
        feed: "iex",
        eventSource: "static",
      });
    },
  };
}

export type MarketServerRepository = ReturnType<
  typeof createMarketServerRepository
>;

const globalRepository = globalThis as typeof globalThis & {
  __marketServerRepository?: MarketServerRepository;
};

export function getMarketServerRepository() {
  return (
    globalRepository.__marketServerRepository ??
    (globalRepository.__marketServerRepository = createMarketServerRepository())
  );
}

export type { QuoteHistoryPoint };
