import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const quote = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: 234,
  previousClose: 232,
  change: 2,
  changePercent: 0.86,
  sector: "Technology",
  marketCap: null,
  pe: null,
  volume: 48,
  spark: [230, 234],
  source: "alpaca" as const,
  asOf: "2026-07-21T20:00:00Z",
  stale: false,
};

describe("market quotes route", () => {
  it("returns 400 for an invalid or non-allowlisted symbol", async () => {
    const { createQuotesHandler } = await import("./route");
    const handler = createQuotesHandler({ loadQuotes: vi.fn() });

    const response = await handler(
      new Request("http://localhost/api/market/quotes?symbols=AAPL,BAD!"),
    );

    expect(response.status).toBe(400);
  });

  it("returns unified RealQuote payloads", async () => {
    const { createQuotesHandler } = await import("./route");
    const loadQuotes = vi.fn(async () => [quote]);
    const seedQuotes = vi.fn();
    const handler = createQuotesHandler({ loadQuotes, seedQuotes });

    const response = await handler(
      new Request("http://localhost/api/market/quotes?symbols=aapl"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quotes: [quote] });
    expect(loadQuotes).toHaveBeenCalledWith(["AAPL"]);
    expect(seedQuotes).toHaveBeenCalledWith([quote]);
  });

  it("returns 503 when the provider fails without cached data", async () => {
    const { MarketDataUnavailableError } = await import(
      "../../../../lib/market/cache.server"
    );
    const { createQuotesHandler } = await import("./route");
    const handler = createQuotesHandler({
      loadQuotes: vi.fn(async () => {
        throw new MarketDataUnavailableError("provider unavailable");
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/market/quotes?symbols=AAPL"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "MARKET_DATA_UNAVAILABLE",
    });
  });
});
