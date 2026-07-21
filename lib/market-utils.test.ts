import { describe, expect, it } from "vitest";
import {
  derivePortfolioSummary,
  filterScreener,
  formatCurrency,
  formatPercent,
} from "./market-utils";

describe("market formatters", () => {
  it("formats currency and signed percentages consistently", () => {
    expect(formatCurrency(187.44)).toBe("$187.44");
    expect(formatPercent(2.34)).toBe("+2.34%");
    expect(formatPercent(-0.8)).toBe("-0.80%");
  });
});

describe("filterScreener", () => {
  it("applies sector and minimum market cap filters", () => {
    const stocks = [
      { sector: "Technology", marketCap: 3200 },
      { sector: "Financials", marketCap: 680 },
      { sector: "Technology", marketCap: 220 },
    ];

    expect(
      filterScreener(stocks, { sector: "Technology", minMarketCap: 500 }),
    ).toEqual([{ sector: "Technology", marketCap: 3200 }]);
  });
});

describe("derivePortfolioSummary", () => {
  it("derives totals, gains, cash, and weights from holdings", () => {
    const result = derivePortfolioSummary([
      { symbol: "ACME", shares: 2, avg: 80, price: 100, previousPrice: 90, sector: "Technology" },
      { symbol: "CASH", shares: 1, avg: 50, price: 50, previousPrice: 50, sector: "Cash" },
    ]);

    expect(result.netValue).toBe(250);
    expect(result.dayGain).toBe(20);
    expect(result.totalGain).toBe(40);
    expect(result.cashBalance).toBe(50);
    expect(result.positions[0].weight).toBe(80);
    expect(result.allocations).toEqual([
      { sector: "Technology", value: 200, weight: 80 },
      { sector: "Cash", value: 50, weight: 20 },
    ]);
  });
});
