import { describe, expect, it, vi } from "vitest";
import companyFactsFixture from "./fixtures/sec-companyfacts.json";

vi.mock("server-only", () => ({}));

const realQuote = {
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
  spark: [190, 200],
  source: "alpaca" as const,
  asOf: "2026-07-21T20:00:00Z",
  stale: false,
};

describe("market server repository", () => {
  it("loads and seeds the full quote universe in real mode", async () => {
    const loaded = [
      realQuote,
      { ...realQuote, symbol: "MSFT", name: "Microsoft Corp." },
    ];
    const quoteService = {
      loadQuotes: vi.fn().mockResolvedValue(loaded),
      loadHistory: vi.fn(),
    };
    const seedQuotes = vi.fn();
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService,
      seedQuotes,
    });

    const quotes = await repository.getQuotes();

    expect(quoteService.loadQuotes).toHaveBeenCalledWith([
      "AAPL",
      "MSFT",
      "NVDA",
      "AMZN",
      "JPM",
      "LLY",
      "XOM",
      "COST",
    ]);
    expect(seedQuotes).toHaveBeenCalledWith(loaded);
    expect(quotes).toEqual(loaded);
  });

  it("keeps mock portfolio data compatible through the async repository", async () => {
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({ env: {} });

    const portfolio = await repository.getPortfolio();

    expect(portfolio.mode).toBe("mock");
    expect(portfolio.holdings.find(({ symbol }) => symbol === "CASH")?.price).toBe(
      16_241,
    );
  });

  it("updates only non-cash portfolio prices from one real quote batch", async () => {
    const loaded = [
      { ...realQuote, symbol: "AAPL", price: 205, previousClose: 199 },
      { ...realQuote, symbol: "MSFT", price: null, previousClose: null },
      { ...realQuote, symbol: "NVDA", price: 145, previousClose: 140 },
      { ...realQuote, symbol: "JPM", price: 250, previousClose: 245 },
      { ...realQuote, symbol: "LLY", price: 810, previousClose: 800 },
    ];
    const quoteService = {
      loadQuotes: vi.fn().mockResolvedValue(loaded),
      loadHistory: vi.fn(),
    };
    const seedQuotes = vi.fn();
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService,
      seedQuotes,
    });

    const portfolio = await repository.getPortfolio();
    const apple = portfolio.holdings.find(({ symbol }) => symbol === "AAPL");
    const microsoft = portfolio.holdings.find(({ symbol }) => symbol === "MSFT");
    const cash = portfolio.holdings.find(({ symbol }) => symbol === "CASH");

    expect(quoteService.loadQuotes).toHaveBeenCalledWith([
      "AAPL",
      "MSFT",
      "NVDA",
      "JPM",
      "LLY",
    ]);
    expect(seedQuotes).toHaveBeenCalledWith(loaded);
    expect(apple).toMatchObject({
      shares: 120,
      avg: 184.2,
      price: 205,
      previousPrice: 199,
    });
    expect(microsoft).toMatchObject({ price: 448.62, previousPrice: 450.15 });
    expect(cash).toMatchObject({
      shares: 1,
      avg: 16_241,
      price: 16_241,
      previousPrice: 16_241,
    });
  });

  it("defaults to the existing mock adapter", async () => {
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({ env: {} });

    const overview = await repository.getOverview();

    expect(overview.mode).toBe("mock");
    expect(overview.dataLabel).toBe("MOCK");
    expect(overview.watchlist[0].symbol).toBe("AAPL");
  });

  it("uses ETF quotes as explicitly labelled market proxies in real mode", async () => {
    const symbols = ["AAPL", "MSFT", "NVDA", "AMZN", "JPM", "LLY", "XOM", "COST", "SPY", "QQQ", "DIA", "IWM"];
    const quotes = symbols.map((symbol, index) => ({
      ...realQuote,
      symbol,
      name: symbol,
      price: 100 + index,
      changePercent: index < 8 ? (index % 2 === 0 ? 2 : -1) : 0.5,
      sector: index < 4 ? "Technology" : index < 8 ? "Financials" : "ETF",
    }));
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService: {
        loadQuotes: vi.fn().mockResolvedValue(quotes),
        loadHistory: vi.fn(),
      },
    });

    const overview = await repository.getOverview();

    expect(overview.mode).toBe("real");
    expect(overview.dataLabel).toBe("IEX · ETF PROXY");
    expect(overview.indices.map(({ symbol, proxy }) => [symbol, proxy])).toEqual([
      ["SPY", true],
      ["QQQ", true],
      ["DIA", true],
      ["IWM", true],
    ]);
    expect(overview.sectors).toEqual([
      ["Financials", 0.5],
      ["Technology", 0.5],
    ]);
    expect(overview.eventSource).toBe("static");
  });

  it("merges Alpaca history with SEC facts without inventing valuation metrics", async () => {
    const { createMarketServerRepository } = await import("./repository.server");
    const quoteService = {
      loadQuotes: vi.fn().mockResolvedValue([realQuote]),
      loadHistory: vi.fn().mockResolvedValue([
        { date: "2026-07-20", price: 198, volume: 1_000_000 },
        { date: "2026-07-21", price: 200, volume: 1_200_000 },
      ]),
    };
    const secProvider = {
      getCompanyFacts: vi.fn().mockResolvedValue(companyFactsFixture),
    };
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService,
      secProvider,
      now: () => new Date("2026-07-21T20:00:00Z"),
    });

    const research = await repository.getResearch("AAPL");

    expect(research).toMatchObject({
      source: "alpaca+sec",
      quote: {
        marketCap: (200 * 14_773_260_000) / 1_000_000_000,
        pe: null,
      },
      metrics: {
        enterpriseValue: null,
        evEbitda: null,
        dividendYield: null,
        beta: null,
      },
      financials: [
        {
          year: "FY2025",
          revenue: 420,
          income: 112.01,
        },
      ],
    });
    expect(research?.history).toEqual(await quoteService.loadHistory.mock.results[0].value);
    expect(secProvider.getCompanyFacts).toHaveBeenCalledWith("0000320193");
  });

  it("does not silently fall back to mock data when a real provider fails", async () => {
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService: {
        loadQuotes: vi.fn().mockRejectedValue(new Error("provider down")),
        loadHistory: vi.fn(),
      },
    });

    await expect(repository.getOverview()).rejects.toThrow("provider down");
  });

  it("retains a SEC annual row when net income is unavailable", async () => {
    const { createMarketServerRepository } = await import("./repository.server");
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService: {
        loadQuotes: vi.fn().mockResolvedValue([realQuote]),
        loadHistory: vi.fn().mockResolvedValue([]),
      },
      secProvider: {
        getCompanyFacts: vi.fn().mockResolvedValue({
          cik: 320193,
          entityName: "Apple Inc.",
          facts: {
            "us-gaap": {
              Revenues: {
                units: {
                  USD: [{
                    start: "2025-01-01",
                    end: "2025-12-31",
                    filed: "2026-02-01",
                    form: "10-K",
                    fp: "FY",
                    val: 420_000_000_000,
                  }],
                },
              },
            },
          },
        }),
      },
    });

    const research = await repository.getResearch("AAPL");

    expect(research?.financials).toEqual([
      { year: "FY2025", revenue: 420, income: null, margin: null },
    ]);
  });

  it("reuses cached SEC CompanyFacts for repeated research requests", async () => {
    const { createMarketServerRepository } = await import("./repository.server");
    const getCompanyFacts = vi.fn().mockResolvedValue(companyFactsFixture);
    const repository = createMarketServerRepository({
      env: { MARKET_DATA_MODE: "real" },
      quoteService: {
        loadQuotes: vi.fn().mockResolvedValue([realQuote]),
        loadHistory: vi.fn().mockResolvedValue([]),
      },
      secProvider: { getCompanyFacts },
    });

    await repository.getResearch("AAPL");
    await repository.getResearch("AAPL");

    expect(getCompanyFacts).toHaveBeenCalledOnce();
    expect(getCompanyFacts).toHaveBeenCalledWith("0000320193");
  });
});
