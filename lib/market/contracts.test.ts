import { describe, expect, it } from "vitest";
import {
  alpacaBarSchema,
  alpacaSnapshotSchema,
  alpacaTradeSchema,
  researchSchema,
  secFactUnitSchema,
  secSubmissionsSchema,
} from "./contracts";

describe("market provider contracts", () => {
  it("accepts an official partial snapshot with a minute bar", () => {
    expect(
      alpacaSnapshotSchema.safeParse({
        minuteBar: {
          c: 100,
          t: "2026-07-21T19:58:00Z",
          v: 0,
        },
      }).success,
    ).toBe(true);
  });

  it("rejects malformed Alpaca timestamps", () => {
    expect(alpacaTradeSchema.safeParse({ p: 100, t: "yesterday" }).success).toBe(
      false,
    );
  });

  it("rejects negative Alpaca volume", () => {
    expect(
      alpacaBarSchema.safeParse({
        c: 100,
        t: "2026-07-21T19:58:00Z",
        v: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects malformed SEC filing dates", () => {
    expect(
      secFactUnitSchema.safeParse({
        val: 1,
        end: "2025-13-40",
        filed: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("validates official SEC recent filing arrays and preserves extra fields", () => {
    const result = secSubmissionsSchema.parse({
      cik: "0000320193",
      name: "Apple Inc.",
      filings: {
        recent: {
          accessionNumber: ["0000320193-25-000079"],
          filingDate: ["2025-10-31"],
          reportDate: ["2025-09-27"],
          form: ["10-K"],
          primaryDocument: ["aapl-20250927.htm"],
          primaryDocDescription: ["10-K"],
          isXBRL: [1],
        },
        files: [],
        extraFilingsField: "preserved",
      },
      tickers: ["AAPL"],
    });

    expect(result.filings.recent.form).toEqual(["10-K"]);
    expect(result.filings.extraFilingsField).toBe("preserved");
    expect(result.tickers).toEqual(["AAPL"]);
  });

  it("rejects malformed SEC recent filing fields", () => {
    expect(
      secSubmissionsSchema.safeParse({
        cik: "0000320193",
        name: "Apple Inc.",
        filings: {
          recent: {
            accessionNumber: "0000320193-25-000079",
            filingDate: ["not-a-date"],
            reportDate: ["2025-09-27"],
            form: ["10-K"],
            primaryDocument: ["aapl-20250927.htm"],
          },
        },
      }).success,
    ).toBe(false);
  });

  it("accepts unavailable real research metrics as null", () => {
    const parsed = researchSchema.parse({
      quote: {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 200,
        previousClose: 196,
        change: 4,
        changePercent: 2,
        sector: "Technology",
        marketCap: 3000,
        pe: null,
        volume: 10,
        spark: [190, 200],
        source: "alpaca",
        asOf: "2026-07-21T20:00:00Z",
        stale: false,
      },
      history: [{ date: "2026-07-21", price: 200, volume: 1_000_000 }],
      financials: [
        { year: "FY2025", revenue: 420, income: 112.01, margin: 26.67 },
      ],
      metrics: {
        enterpriseValue: null,
        evEbitda: null,
        dividendYield: null,
        beta: null,
        low52Week: 170,
        high52Week: 210,
      },
      events: [],
      source: "alpaca+sec",
      asOf: "2026-07-21T20:00:00Z",
      stale: false,
      feed: "iex",
      eventSource: "static",
    });

    expect(parsed.metrics.evEbitda).toBeNull();
  });

  it("requires real quotes to preserve the provider previous close", async () => {
    const { realQuoteSchema } = await import("./contracts");
    const result = realQuoteSchema.safeParse({
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 105,
      previousClose: 100.125,
      change: 4.88,
      changePercent: 4.87,
      sector: "Technology",
      marketCap: null,
      pe: null,
      volume: 1,
      spark: [],
      source: "alpaca",
      asOf: "2026-07-21T20:00:00Z",
      stale: false,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.previousClose).toBe(100.125);
  });
});
