import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("quote state", () => {
  it("seeds REST quotes and recalculates trades from the seeded previous close", async () => {
    const { createQuoteState } = await import("./quote-state.server");
    const state = createQuoteState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.seed([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 105,
        previousClose: 100.125,
        change: 4.88,
        changePercent: 4.87,
        sector: "Technology",
        marketCap: null,
        pe: null,
        volume: 48.2,
        spark: [98, 101, 105],
        source: "alpaca",
        asOf: "2026-07-21T19:59:00Z",
        stale: false,
      },
    ]);
    state.updateTrade({
      T: "t",
      S: "AAPL",
      p: 110,
      t: "2026-07-21T20:00:00Z",
    });

    expect(state.snapshots(["AAPL"])[0].quote).toMatchObject({
      price: 110,
      previousClose: 100.125,
      change: 9.88,
      volume: 48.2,
      spark: [98, 101, 105],
    });
    expect(state.snapshots(["AAPL"])[0].quote.changePercent).toBeCloseTo(
      ((110 - 100.125) / 100.125) * 100,
      10,
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("normalizes bar volume, recalculates change, and appends its close", async () => {
    const { createQuoteState } = await import("./quote-state.server");
    const state = createQuoteState();
    state.seed([
      {
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
        spark: [98, 101, 105],
        source: "alpaca",
        asOf: "2026-07-21T19:59:00Z",
        stale: false,
      },
    ]);

    state.updateBar({
      T: "b",
      S: "AAPL",
      c: 111,
      v: 1_250_000,
      t: "2026-07-21T20:01:00Z",
    });

    const quote = state.snapshots(["AAPL"])[0].quote;
    expect(quote).toMatchObject({
      price: 111,
      previousClose: 100.125,
      change: 10.88,
      volume: 1.25,
      spark: [98, 101, 105, 111],
    });
    expect(quote.changePercent).toBeCloseTo(
      ((111 - 100.125) / 100.125) * 100,
      10,
    );
  });

  it("applies an upstream array before notifying one complete batch", async () => {
    const { createQuoteState } = await import("./quote-state.server");
    const state = createQuoteState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.apply([
      {
        T: "t",
        S: "AAPL",
        p: 234.5,
        t: "2026-07-21T20:00:00Z",
      },
      {
        T: "b",
        S: "AAPL",
        c: 235,
        v: 100,
        t: "2026-07-21T20:01:00Z",
      },
      {
        T: "t",
        S: "MSFT",
        p: 500,
        t: "2026-07-21T20:00:00Z",
      },
    ]);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({
        symbol: "AAPL",
        trade: { price: 234.5, size: null, asOf: "2026-07-21T20:00:00Z" },
        bar: expect.objectContaining({ close: 235 }),
      }),
      expect.objectContaining({ symbol: "MSFT" }),
    ]);
  });

  it("stores the latest trade and bar and emits batched snapshots", async () => {
    const { createQuoteState } = await import("./quote-state.server");
    const state = createQuoteState();
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.updateTrade({
      T: "t",
      S: "aapl",
      p: 234.5,
      s: 10,
      t: "2026-07-21T20:00:00Z",
    });
    state.updateBar({
      T: "b",
      S: "AAPL",
      o: 233,
      h: 235,
      l: 232,
      c: 234,
      v: 1000,
      t: "2026-07-21T20:01:00Z",
    });

    expect(state.snapshots(["aapl"])[0]).toMatchObject({
      symbol: "AAPL",
      trade: { price: 234.5, size: 10 },
      bar: { close: 234, volume: 0.001 },
      quote: {
        symbol: "AAPL",
        price: 234.5,
        source: "alpaca",
        stale: false,
      },
      stale: false,
      source: "alpaca",
      asOf: "2026-07-21T20:01:00Z",
    });
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ symbol: "AAPL" }),
    ]);

    unsubscribe();
    state.updateTrade({
      T: "t",
      S: "AAPL",
      p: 235,
      t: "2026-07-21T20:02:00Z",
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("marks selected symbols stale while retaining cached values", async () => {
    const { createQuoteState } = await import("./quote-state.server");
    const state = createQuoteState();
    state.updateTrade({
      T: "t",
      S: "MSFT",
      p: 500,
      t: "2026-07-21T20:00:00Z",
    });

    state.markStale(["MSFT"]);

    expect(state.snapshots(["MSFT"])[0]).toMatchObject({
      quote: { price: 500, stale: true },
      stale: true,
    });
  });
});
