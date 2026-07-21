import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("market SSE route", () => {
  it("uses a default heartbeat no slower than three seconds", async () => {
    vi.useFakeTimers();
    const { createStreamHandler } = await import("./route");
    const response = await createStreamHandler({
      state: {
        snapshots: vi.fn(() => []),
        subscribe: vi.fn(() => vi.fn()),
      },
      stream: { subscribe: vi.fn(), unsubscribe: vi.fn() },
    })(new Request("http://localhost/api/market/stream?symbols=AAPL"));
    const reader = response.body!.getReader();

    await reader.read();
    const heartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(3_000);
    await reader.cancel();
    const chunk = new TextDecoder().decode((await heartbeat).value);

    expect(chunk).toContain("event: heartbeat");
    vi.useRealTimers();
  });

  it("validates symbols before constructing the credentialed singleton", async () => {
    const previousKey = process.env.ALPACA_API_KEY_ID;
    const previousSecret = process.env.ALPACA_API_SECRET_KEY;
    delete process.env.ALPACA_API_KEY_ID;
    delete process.env.ALPACA_API_SECRET_KEY;
    const { GET } = await import("./route");

    try {
      const response = await GET(
        new Request("http://localhost/api/market/stream?symbols=EVIL"),
      );
      expect(response.status).toBe(400);
    } finally {
      if (previousKey === undefined) delete process.env.ALPACA_API_KEY_ID;
      else process.env.ALPACA_API_KEY_ID = previousKey;
      if (previousSecret === undefined) delete process.env.ALPACA_API_SECRET_KEY;
      else process.env.ALPACA_API_SECRET_KEY = previousSecret;
    }
  });

  it("rejects symbols outside the static allowlist", async () => {
    const { createStreamHandler } = await import("./route");
    const handler = createStreamHandler({
      state: { snapshots: vi.fn(), subscribe: vi.fn() },
      stream: { subscribe: vi.fn(), unsubscribe: vi.fn() },
      heartbeatMs: 60_000,
    });

    const response = await handler(
      new Request("http://localhost/api/market/stream?symbols=AAPL,EVIL"),
    );

    expect(response.status).toBe(400);
  });

  it("sends safe snapshots and removes listeners when aborted", async () => {
    const { createStreamHandler } = await import("./route");
    const abort = new AbortController();
    const removeAbortListener = vi.spyOn(abort.signal, "removeEventListener");
    const removeListener = vi.fn();
    const state = {
      snapshots: vi.fn(() => [
        {
          symbol: "AAPL",
          quote: {
            symbol: "AAPL",
            name: "Apple Inc.",
            price: 234,
            previousClose: null,
            change: null,
            changePercent: null,
            sector: "Technology",
            marketCap: null,
            pe: null,
            volume: null,
            spark: [],
            source: "alpaca",
            asOf: "2026-07-21T20:00:00Z",
            stale: false,
          },
          stale: false,
          source: "alpaca",
          asOf: "2026-07-21T20:00:00Z",
        },
      ]),
      subscribe: vi.fn(() => removeListener),
    };
    const stream = { subscribe: vi.fn(), unsubscribe: vi.fn() };
    const handler = createStreamHandler({ state, stream, heartbeatMs: 60_000 });
    const response = await handler(
      new Request("http://localhost/api/market/stream?symbols=AAPL", {
        signal: abort.signal,
      }),
    );
    const reader = response.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);

    expect(first).toContain("event: snapshot");
    expect(first).toContain('"symbol":"AAPL"');
    expect(first).not.toContain("private-secret");
    expect(first).not.toContain("ALPACA_API");

    abort.abort();
    await Promise.resolve();
    expect(removeListener).toHaveBeenCalledOnce();
    expect(stream.unsubscribe).toHaveBeenCalledWith(["AAPL"]);
    expect(removeAbortListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
  });

  it("cleans up once when a consumer cancels and later aborts", async () => {
    const { createStreamHandler } = await import("./route");
    const abort = new AbortController();
    const removeListener = vi.fn();
    const removeAbortListener = vi.spyOn(abort.signal, "removeEventListener");
    const state = {
      snapshots: vi.fn(() => []),
      subscribe: vi.fn(() => removeListener),
    };
    const stream = { subscribe: vi.fn(), unsubscribe: vi.fn() };
    const response = await createStreamHandler({
      state,
      stream,
      heartbeatMs: 60_000,
    })(new Request("http://localhost/api/market/stream?symbols=AAPL", {
      signal: abort.signal,
    }));

    await expect(response.body!.cancel()).resolves.toBeUndefined();
    abort.abort();

    expect(removeListener).toHaveBeenCalledOnce();
    expect(stream.unsubscribe).toHaveBeenCalledOnce();
    expect(removeAbortListener).toHaveBeenCalledOnce();
  });
});
