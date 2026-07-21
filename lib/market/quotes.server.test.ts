import { afterEach, describe, expect, it, vi } from "vitest";
import barsFixture from "./fixtures/alpaca-bars.json";
import snapshotsFixture from "./fixtures/alpaca.json";

vi.mock("server-only", () => ({}));

afterEach(() => vi.useRealTimers());

describe("quote service cache fallback", () => {
  it("returns serializable daily history from the shared bars cache", async () => {
    const provider = {
      getSnapshots: vi.fn().mockResolvedValue(snapshotsFixture),
      getBars: vi.fn().mockResolvedValue(barsFixture),
    };
    const { createQuoteService } = await import("./quotes.server");
    const service = createQuoteService({
      provider,
      now: () => new Date("2026-07-21T20:00:00Z"),
    });

    await service.loadQuotes(["AAPL"]);
    const history = await service.loadHistory("AAPL");

    expect(history).toEqual([
      { date: "2026-07-15", price: 229, volume: 41_000_000 },
      { date: "2026-07-16", price: 231, volume: 42_000_000 },
      { date: "2026-07-21", price: 234.41, volume: 48_200_000 },
    ]);
    expect(provider.getBars).toHaveBeenCalledTimes(1);
  });

  it("returns a stale quote when snapshot refresh fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T20:00:00Z"));
    const provider = {
      getSnapshots: vi
        .fn()
        .mockResolvedValueOnce(snapshotsFixture)
        .mockRejectedValueOnce(new Error("provider down")),
      getBars: vi.fn().mockResolvedValue(barsFixture),
    };
    const { createQuoteService } = await import("./quotes.server");
    const service = createQuoteService({
      provider,
      now: () => new Date(Date.now()),
    });

    expect((await service.loadQuotes(["AAPL"]))[0].stale).toBe(false);
    vi.setSystemTime(new Date("2026-07-21T20:00:10.001Z"));

    const fallback = await service.loadQuotes(["AAPL"]);

    expect(fallback[0]).toMatchObject({
      symbol: "AAPL",
      price: 234.414,
      stale: true,
    });
    expect(provider.getSnapshots).toHaveBeenCalledTimes(2);
    expect(provider.getBars).toHaveBeenCalledTimes(1);
  });
});
