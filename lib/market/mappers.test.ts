import { describe, expect, it } from "vitest";
import alpacaFixture from "./fixtures/alpaca.json";
import alpacaBarsFixture from "./fixtures/alpaca-bars.json";
import companyFactsFixture from "./fixtures/sec-companyfacts.json";

describe("mapAlpacaQuote", () => {
  it("maps snapshot and bars into a traceable real quote", async () => {
    const { mapAlpacaQuote } = await import("./mappers");
    const quote = mapAlpacaQuote({
      symbol: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
      snapshot: alpacaFixture.AAPL,
      bars: alpacaBarsFixture.bars.AAPL,
      now: new Date("2026-07-21T20:00:00Z"),
    });

    expect(quote).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 234.414,
      previousClose: 231.57,
      change: 2.84,
      sector: "Technology",
      marketCap: null,
      pe: null,
      volume: 48.2,
      spark: [229, 231, 234.41],
      source: "alpaca",
      asOf: "2026-07-21T19:59:00Z",
      stale: false,
    });
    expect(quote.changePercent).toBeCloseTo(
      ((234.414 - 231.57) / 231.57) * 100,
      10,
    );
  });

  it("uses null for values that cannot be derived reliably", async () => {
    const { mapAlpacaQuote } = await import("./mappers");
    const quote = mapAlpacaQuote({
      symbol: "MISSING",
      snapshot: {},
      bars: [],
      now: new Date("2026-07-21T20:00:00Z"),
    });

    expect(quote).toMatchObject({
      name: null,
      price: null,
      previousClose: null,
      change: null,
      changePercent: null,
      sector: null,
      marketCap: null,
      pe: null,
      volume: null,
      spark: [],
      asOf: null,
      stale: true,
    });
  });

  it("marks an old snapshot stale", async () => {
    const { mapAlpacaQuote } = await import("./mappers");
    const quote = mapAlpacaQuote({
      symbol: "AAPL",
      snapshot: alpacaFixture.AAPL,
      bars: [],
      now: new Date("2026-07-21T20:20:00Z"),
      staleAfterMs: 15 * 60 * 1000,
    });

    expect(quote.stale).toBe(true);
  });

  it("uses minuteBar time when latestTrade is missing", async () => {
    const { mapAlpacaQuote } = await import("./mappers");
    const quote = mapAlpacaQuote({
      symbol: "AAPL",
      snapshot: {
        ...alpacaFixture.AAPL,
        latestTrade: undefined,
      },
      bars: [],
      now: new Date("2026-07-21T20:00:00Z"),
    });

    expect(quote.asOf).toBe("2026-07-21T19:58:00Z");
    expect(quote.stale).toBe(false);
  });

  it("marks a future snapshot timestamp stale", async () => {
    const { mapAlpacaQuote } = await import("./mappers");
    const quote = mapAlpacaQuote({
      symbol: "AAPL",
      snapshot: {
        latestTrade: {
          p: 100,
          t: "2026-07-21T20:05:00Z",
        },
      },
      bars: [],
      now: new Date("2026-07-21T20:00:00Z"),
    });

    expect(quote.stale).toBe(true);
  });
});

describe("extractSecFundamentals", () => {
  it("extracts shares and latest annual revenue and net income", async () => {
    const { extractSecFundamentals } = await import("./mappers");
    const fundamentals = extractSecFundamentals("AAPL", companyFactsFixture, {
      now: new Date("2026-07-21T20:00:00Z"),
    });

    expect(fundamentals).toEqual({
      symbol: "AAPL",
      cik: "0000320193",
      sharesOutstanding: 14773260000,
      revenue: 420000000000,
      netIncome: 112010000000,
      fiscalYear: 2025,
      source: "sec",
      asOf: "2025-10-30",
      stale: false,
    });
  });

  it("returns null instead of inventing missing facts", async () => {
    const { extractSecFundamentals } = await import("./mappers");
    const fundamentals = extractSecFundamentals(
      "EMPTY",
      { cik: 1, entityName: "Empty Corp", facts: {} },
      { now: new Date("2026-07-21T20:00:00Z") },
    );

    expect(fundamentals).toMatchObject({
      sharesOutstanding: null,
      revenue: null,
      netIncome: null,
      fiscalYear: null,
      asOf: null,
      stale: true,
    });
  });

  it("selects revenue and net income from their latest common annual period", async () => {
    const { extractSecFundamentals } = await import("./mappers");
    const annual = (
      start: string,
      end: string,
      filed: string,
      val: number,
    ) => ({
      start,
      end,
      filed,
      form: "10-K",
      fp: "FY",
      val,
    });
    const fundamentals = extractSecFundamentals(
      "PAIR",
      {
        cik: 42,
        entityName: "Pair Corp",
        facts: {
          "us-gaap": {
            Revenues: {
              units: {
                USD: [
                  annual("2025-01-01", "2025-12-31", "2026-02-01", 600),
                  annual("2024-01-01", "2024-12-31", "2025-02-01", 500),
                ],
              },
            },
            NetIncomeLoss: {
              units: {
                USD: [
                  annual("2024-01-01", "2024-12-31", "2025-02-02", 50),
                  annual("2023-01-01", "2023-12-31", "2024-02-02", 40),
                ],
              },
            },
          },
        },
      },
      { now: new Date("2025-06-01T00:00:00Z") },
    );

    expect(fundamentals).toMatchObject({
      revenue: 500,
      netIncome: 50,
      fiscalYear: 2024,
      asOf: "2025-02-01",
    });
  });

  it("keeps the latest annual row when only one SEC metric is available", async () => {
    const { extractSecFundamentals } = await import("./mappers");
    const fundamentals = extractSecFundamentals("UNPAIRED", {
      cik: 43,
      entityName: "Unpaired Corp",
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
                val: 600,
              }],
            },
          },
          NetIncomeLoss: {
            units: {
              USD: [{
                start: "2024-01-01",
                end: "2024-12-31",
                filed: "2025-02-01",
                form: "10-K",
                fp: "FY",
                val: 50,
              }],
            },
          },
        },
      },
    });

    expect(fundamentals).toMatchObject({
      revenue: 600,
      netIncome: null,
      fiscalYear: 2025,
      asOf: "2026-02-01",
    });
  });
});
