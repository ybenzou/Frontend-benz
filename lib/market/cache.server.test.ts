import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("TTL cache", () => {
  it("returns stale cached data when a refresh fails", async () => {
    const { createTtlCache } = await import("./cache.server");
    let now = 0;
    const cache = createTtlCache<string>({ ttlMs: 10, now: () => now });
    const first = await cache.getOrLoad("AAPL", async () => "fresh");
    now = 11;
    const fallback = await cache.getOrLoad("AAPL", async () => {
      throw new Error("provider down");
    });

    expect(first).toEqual({ value: "fresh", stale: false });
    expect(fallback).toEqual({ value: "fresh", stale: true });
  });

  it("throws a unified unavailable error when no cache exists", async () => {
    const { createTtlCache, MarketDataUnavailableError } = await import(
      "./cache.server"
    );
    const cache = createTtlCache<string>({ ttlMs: 10 });

    await expect(
      cache.getOrLoad("AAPL", async () => {
        throw new Error("provider down");
      }),
    ).rejects.toBeInstanceOf(MarketDataUnavailableError);
  });

  it("rejects a stale fallback older than the configured maximum age", async () => {
    const { createTtlCache, MarketDataUnavailableError } = await import(
      "./cache.server"
    );
    let now = 0;
    const cache = createTtlCache<string>({
      ttlMs: 10,
      maxStaleMs: 20,
      now: () => now,
    });
    await cache.getOrLoad("AAPL", async () => "cached");
    now = 21;

    await expect(
      cache.getOrLoad("AAPL", async () => {
        throw new Error("provider down");
      }),
    ).rejects.toBeInstanceOf(MarketDataUnavailableError);
  });
});
