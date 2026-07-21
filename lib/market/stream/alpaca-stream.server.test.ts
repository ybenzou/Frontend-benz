import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

class FakeSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  private closed = false;

  constructor(private readonly onClosed: () => void = () => {}) {
    super();
  }

  close = vi.fn(() => {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSING;
  });

  terminate = vi.fn(() => {
    this.finishClose();
  });

  send(value: string) {
    this.sent.push(value);
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.emit("open");
  }

  message(value: unknown) {
    this.emit("message", typeof value === "string" ? value : JSON.stringify(value));
  }

  finishClose() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = FakeSocket.CLOSED;
    this.onClosed();
    this.emit("close");
  }
}

function fakeState() {
  return {
    apply: vi.fn(),
    updateTrade: vi.fn(),
    updateBar: vi.fn(),
    markStale: vi.fn(),
  };
}

const env = {
  ALPACA_API_KEY_ID: "public-key",
  ALPACA_API_SECRET_KEY: "private-secret",
};

describe("Alpaca stream", () => {
  it("uses one upstream, deduplicates symbols, and subscribes after auth", async () => {
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const socket = new FakeSocket();
    const createSocket = vi.fn(() => socket);
    const state = fakeState();
    const stream = createAlpacaStream({ env, createSocket, state });

    stream.subscribe(["aapl", "AAPL"]);
    stream.subscribe(["MSFT"]);
    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(createSocket).toHaveBeenCalledWith(
      "wss://stream.data.alpaca.markets/v2/iex",
    );

    socket.open();
    expect(JSON.parse(socket.sent[0])).toEqual({
      action: "auth",
      key: "public-key",
      secret: "private-secret",
    });
    socket.message([{ T: "success", msg: "authenticated" }]);

    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      action: "subscribe",
      trades: ["AAPL", "MSFT"],
      bars: ["AAPL", "MSFT"],
    });
  });

  it("accepts exactly 30 unique symbols and rejects the 31st", async () => {
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const stream = createAlpacaStream({
      env,
      createSocket: () => new FakeSocket(),
      state: fakeState(),
    });

    expect(() =>
      stream.subscribe(Array.from({ length: 30 }, (_, index) => `S${index}`)),
    ).not.toThrow();
    expect(() => stream.subscribe(["OVER"])).toThrow("30");
  });

  it("maps array trade/bar messages and marks symbols stale on close", async () => {
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const socket = new FakeSocket();
    const state = fakeState();
    const stream = createAlpacaStream({
      env,
      createSocket: () => socket,
      state,
    });
    stream.subscribe(["AAPL"]);

    socket.open();
    socket.message(
      [
        { T: "t", S: "AAPL", p: 234.5, s: 10, t: "2026-07-21T20:00:00Z" },
        { T: "b", S: "AAPL", c: 235, v: 100, t: "2026-07-21T20:01:00Z" },
      ],
    );
    socket.finishClose();

    expect(state.apply).toHaveBeenCalledOnce();
    expect(state.apply).toHaveBeenCalledWith([
      expect.objectContaining({ T: "t", S: "AAPL", p: 234.5 }),
      expect.objectContaining({ T: "b", S: "AAPL", c: 235 }),
    ]);
    expect(state.markStale).toHaveBeenCalledWith(["AAPL"]);
  });

  it("reconnects with exponential backoff", async () => {
    vi.useFakeTimers();
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const sockets = [new FakeSocket(), new FakeSocket(), new FakeSocket()];
    const createSocket = vi.fn(() => sockets.shift()!);
    const stream = createAlpacaStream({
      env,
      createSocket,
      state: fakeState(),
      timers: {
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
      },
      reconnectBaseMs: 100,
      random: () => 0.5,
    });
    stream.subscribe(["AAPL"]);

    createSocket.mock.results[0].value.finishClose();
    await vi.advanceTimersByTimeAsync(99);
    expect(createSocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createSocket).toHaveBeenCalledTimes(2);

    createSocket.mock.results[1].value.finishClose();
    await vi.advanceTimersByTimeAsync(200);
    expect(createSocket).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("keeps a closing generation current and never overlaps upstream sockets", async () => {
    vi.useFakeTimers();
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    let active = 0;
    let maxActive = 0;
    const sockets: FakeSocket[] = [];
    const createSocket = vi.fn(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const socket = new FakeSocket(() => {
        active -= 1;
      });
      sockets.push(socket);
      return socket;
    });
    const state = fakeState();
    const stream = createAlpacaStream({
      env,
      createSocket,
      state,
      reconnectBaseMs: 100,
      closeTimeoutMs: 1_000,
      random: () => 0.5,
    });
    stream.subscribe(["AAPL"]);
    const first = sockets[0];

    first.open();
    first.emit("error", new Error("network"));
    expect(first.close).toHaveBeenCalledOnce();
    expect(first.readyState).toBe(FakeSocket.CLOSING);
    await vi.advanceTimersByTimeAsync(500);
    expect(createSocket).toHaveBeenCalledTimes(1);

    first.message([
      { T: "t", S: "AAPL", p: 999, t: "2026-07-21T20:00:00Z" },
    ]);
    first.finishClose();
    await vi.advanceTimersByTimeAsync(99);
    expect(createSocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(state.apply).not.toHaveBeenCalled();
    expect(createSocket).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
    vi.useRealTimers();
  });

  it("treats Alpaca T:error as a controlled reconnect", async () => {
    vi.useFakeTimers();
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const socket = new FakeSocket();
    const createSocket = vi
      .fn()
      .mockReturnValueOnce(socket)
      .mockReturnValueOnce(new FakeSocket());
    const state = fakeState();
    const stream = createAlpacaStream({
      env,
      createSocket,
      state,
      reconnectBaseMs: 100,
      random: () => 0.5,
    });
    stream.subscribe(["AAPL"]);

    socket.open();
    socket.message([
      { T: "error", code: 406, msg: "connection limit exceeded" },
    ]);

    expect(state.markStale).toHaveBeenCalledWith(["AAPL"]);
    expect(socket.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(500);
    expect(createSocket).toHaveBeenCalledTimes(1);
    socket.finishClose();
    await vi.advanceTimersByTimeAsync(100);
    expect(createSocket).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("accepts subscription confirmations without changing quote state", async () => {
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const socket = new FakeSocket();
    const state = fakeState();
    const stream = createAlpacaStream({
      env,
      createSocket: () => socket,
      state,
    });
    stream.subscribe(["AAPL"]);

    socket.open();
    socket.message([
      { T: "subscription", trades: ["AAPL"], bars: ["AAPL"] },
    ]);

    expect(state.apply).not.toHaveBeenCalled();
    expect(state.markStale).not.toHaveBeenCalled();
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("closes after idle timeout and cancels idle close for a new subscriber", async () => {
    vi.useFakeTimers();
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    let active = 0;
    let maxActive = 0;
    const sockets: FakeSocket[] = [];
    const createSocket = vi.fn(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const value = new FakeSocket(() => {
        active -= 1;
      });
      sockets.push(value);
      return value;
    });
    const stream = createAlpacaStream({
      env,
      createSocket,
      state: fakeState(),
      idleTimeoutMs: 100,
      reconnectBaseMs: 100,
      random: () => 0.5,
    });
    stream.subscribe(["AAPL"]);
    const socket = sockets[0];
    socket.open();
    socket.message([{ T: "success", msg: "authenticated" }]);

    stream.unsubscribe(["AAPL"]);
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      action: "unsubscribe",
      trades: ["AAPL"],
      bars: ["AAPL"],
    });
    await vi.advanceTimersByTimeAsync(99);
    stream.subscribe(["AAPL"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(socket.close).not.toHaveBeenCalled();

    stream.unsubscribe(["AAPL"]);
    await vi.advanceTimersByTimeAsync(100);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(socket.readyState).toBe(FakeSocket.CLOSING);

    stream.subscribe(["AAPL"]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(createSocket).toHaveBeenCalledTimes(1);
    socket.finishClose();
    await vi.advanceTimersByTimeAsync(100);
    expect(createSocket).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
    vi.useRealTimers();
  });

  it("terminates a stuck closing socket before releasing it", async () => {
    vi.useFakeTimers();
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    let active = 0;
    let maxActive = 0;
    const sockets: FakeSocket[] = [];
    const createSocket = vi.fn(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const value = new FakeSocket(() => {
        active -= 1;
      });
      sockets.push(value);
      return value;
    });
    const stream = createAlpacaStream({
      env,
      createSocket,
      state: fakeState(),
      closeTimeoutMs: 50,
      reconnectBaseMs: 100,
      random: () => 0.5,
    });
    stream.subscribe(["AAPL"]);
    sockets[0].open();
    sockets[0].emit("error", new Error("network"));

    await vi.advanceTimersByTimeAsync(49);
    expect(sockets[0].terminate).not.toHaveBeenCalled();
    expect(createSocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets[0].terminate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(99);
    expect(createSocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createSocket).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
    vi.useRealTimers();
  });

  it("rolls back references when socket construction throws", async () => {
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const socket = new FakeSocket();
    const createSocket = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("constructor failed");
      })
      .mockReturnValueOnce(socket);
    const stream = createAlpacaStream({
      env,
      createSocket,
      state: fakeState(),
    });

    expect(() => stream.subscribe(["AAPL"])).toThrow("constructor failed");
    expect(() => stream.subscribe(["AAPL"])).not.toThrow();
    socket.open();
    socket.message([{ T: "success", msg: "authenticated" }]);
    stream.unsubscribe(["AAPL"]);

    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      action: "unsubscribe",
      trades: ["AAPL"],
      bars: ["AAPL"],
    });
    expect(createSocket).toHaveBeenCalledTimes(2);
  });

  it("applies injected jitter to reconnect delay", async () => {
    vi.useFakeTimers();
    const { createAlpacaStream } = await import("./alpaca-stream.server");
    const sockets = [new FakeSocket(), new FakeSocket()];
    const createSocket = vi.fn(() => sockets.shift()!);
    const stream = createAlpacaStream({
      env,
      createSocket,
      state: fakeState(),
      reconnectBaseMs: 100,
      random: () => 1,
    });
    stream.subscribe(["AAPL"]);
    createSocket.mock.results[0].value.finishClose();

    await vi.advanceTimersByTimeAsync(109);
    expect(createSocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createSocket).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("keeps one global singleton across repeated access", async () => {
    const previousKey = process.env.ALPACA_API_KEY_ID;
    const previousSecret = process.env.ALPACA_API_SECRET_KEY;
    process.env.ALPACA_API_KEY_ID = env.ALPACA_API_KEY_ID;
    process.env.ALPACA_API_SECRET_KEY = env.ALPACA_API_SECRET_KEY;
    const { getAlpacaStream } = await import("./alpaca-stream.server");

    try {
      expect(getAlpacaStream()).toBe(getAlpacaStream());
    } finally {
      if (previousKey === undefined) delete process.env.ALPACA_API_KEY_ID;
      else process.env.ALPACA_API_KEY_ID = previousKey;
      if (previousSecret === undefined) delete process.env.ALPACA_API_SECRET_KEY;
      else process.env.ALPACA_API_SECRET_KEY = previousSecret;
    }
  });
});
