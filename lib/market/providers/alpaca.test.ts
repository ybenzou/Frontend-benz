import { afterEach, describe, expect, it, vi } from "vitest";
import snapshotsFixture from "../fixtures/alpaca.json";

vi.mock("server-only", () => ({}));

const env = {
  ALPACA_API_KEY_ID: "key-id",
  ALPACA_API_SECRET_KEY: "secret",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Alpaca REST provider", () => {
  it("requests batched snapshots with IEX credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(snapshotsFixture), { status: 200 }),
    );
    const { createAlpacaProvider } = await import("./alpaca");
    const provider = createAlpacaProvider({ env, fetch: fetcher });

    const snapshots = await provider.getSnapshots(["AAPL", "MSFT"]);

    const [request] = fetcher.mock.calls[0];
    const url = new URL(String(request));
    expect(url.pathname).toBe("/v2/stocks/snapshots");
    expect(url.searchParams.get("symbols")).toBe("AAPL,MSFT");
    expect(url.searchParams.get("feed")).toBe("iex");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      "APCA-API-KEY-ID": "key-id",
      "APCA-API-SECRET-KEY": "secret",
    });
    expect(snapshots.AAPL.minuteBar?.v).toBe(120400);
  });

  it("requests historical bars in batches and forces the IEX feed", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ bars: {}, next_page_token: null }), { status: 200 }),
    );
    const { createAlpacaProvider } = await import("./alpaca");
    const provider = createAlpacaProvider({ env, fetch: fetcher });

    await provider.getBars(["AAPL", "MSFT"], {
      timeframe: "1Day",
      start: "2026-07-01",
      end: "2026-07-21",
      limit: 50,
    });

    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/v2/stocks/bars");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      symbols: "AAPL,MSFT",
      timeframe: "1Day",
      start: "2026-07-01",
      end: "2026-07-21",
      limit: "50",
      feed: "iex",
    });
  });

  it("reports non-2xx responses without treating them as data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"message":"forbidden"}', { status: 403 }),
    );
    const { createAlpacaProvider } = await import("./alpaca");
    const provider = createAlpacaProvider({ env, fetch: fetcher });

    await expect(provider.getSnapshots(["AAPL"])).rejects.toThrow(
      "Alpaca request failed (403): forbidden",
    );
  });

  it("sanitizes and truncates upstream error bodies", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`bad\r\n\u0000detail ${"x".repeat(2_000)}`, { status: 500 }),
    );
    const { createAlpacaProvider } = await import("./alpaca");
    const provider = createAlpacaProvider({ env, fetch: fetcher });

    const error = await provider.getSnapshots(["AAPL"]).catch((value) => value);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("bad detail");
    expect(error.message).not.toMatch(/[\r\n\u0000]/);
    expect(error.message.length).toBeLessThan(400);
  });

  it("aborts requests after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new TypeError("fetch failed after abort")),
        );
      }),
    );
    const { createAlpacaProvider } = await import("./alpaca");
    const provider = createAlpacaProvider({ env, fetch: fetcher, timeoutMs: 25 });

    const request = provider.getSnapshots(["AAPL"]);
    const assertion = expect(request).rejects.toThrow(
      "Alpaca request timed out after 25ms",
    );
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it("requires both Alpaca credentials", async () => {
    const { createAlpacaProvider } = await import("./alpaca");

    expect(() =>
      createAlpacaProvider({
        env: { ALPACA_API_KEY_ID: "key-id" },
        fetch: vi.fn<typeof fetch>(),
      }),
    ).toThrow("ALPACA_API_SECRET_KEY");
  });

  it("rejects blank symbols before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const { createAlpacaProvider } = await import("./alpaca");
    const provider = createAlpacaProvider({ env, fetch: fetcher });

    expect(() => provider.getSnapshots(["AAPL", "  "])).toThrow(
      "Symbols cannot be blank",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
