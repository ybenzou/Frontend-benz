import "server-only";

import WebSocket from "ws";
import {
  quoteState,
  type AlpacaStreamBar,
  type AlpacaStreamTrade,
  type AlpacaQuoteEvent,
  type QuoteState,
} from "./quote-state.server";

const STREAM_URL = "wss://stream.data.alpaca.markets/v2/iex";
const MAX_SYMBOLS = 30;
const MAX_RECONNECT_MS = 30_000;

type StreamEnvironment = Partial<Record<string, string | undefined>>;

type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  terminate(): void;
  on(event: "open" | "close" | "error" | "message", listener: (...args: unknown[]) => void): unknown;
};

type Timers = {
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
};

type StreamState = Pick<QuoteState, "apply" | "markStale">;

type Connection = {
  generation: number;
  socket: SocketLike;
  authenticated: boolean;
  phase: "active" | "closing";
  reconnectAfterClose: boolean;
  closeTimer: ReturnType<typeof setTimeout> | null;
};

type AlpacaStreamOptions = {
  env?: StreamEnvironment;
  createSocket?: (url: string) => SocketLike;
  state?: StreamState;
  timers?: Timers;
  reconnectBaseMs?: number;
  idleTimeoutMs?: number;
  closeTimeoutMs?: number;
  random?: () => number;
};

function required(environment: StreamEnvironment, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseMessage(value: unknown): unknown[] {
  const text =
    typeof value === "string"
      ? value
      : Buffer.isBuffer(value)
        ? value.toString("utf8")
        : String(value);
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Alpaca stream payload must be an array");
  return parsed;
}

export function createAlpacaStream(options: AlpacaStreamOptions = {}) {
  const environment = options.env ?? process.env;
  const key = required(environment, "ALPACA_API_KEY_ID");
  const secret = required(environment, "ALPACA_API_SECRET_KEY");
  const createSocket =
    options.createSocket ?? ((url: string) => new WebSocket(url) as SocketLike);
  const state = options.state ?? quoteState;
  const timers = options.timers ?? globalThis;
  const reconnectBaseMs = options.reconnectBaseMs ?? 1_000;
  const idleTimeoutMs = options.idleTimeoutMs ?? 5_000;
  const closeTimeoutMs = options.closeTimeoutMs ?? 2_000;
  const random = options.random ?? Math.random;
  const references = new Map<string, number>();
  let generation = 0;
  let current: Connection | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const symbols = () => [...references.keys()];

  function send(payload: object) {
    const connection = current;
    if (
      connection &&
      (connection.socket.readyState === WebSocket.OPEN ||
        connection.socket.readyState === 1)
    ) {
      connection.socket.send(JSON.stringify(payload));
    }
  }

  function sendSubscription(action: "subscribe" | "unsubscribe", selected: string[]) {
    if (!current?.authenticated || selected.length === 0) return;
    send({ action, trades: selected, bars: selected });
  }

  function scheduleReconnect() {
    if (reconnectTimer || references.size === 0) return;
    state.markStale(symbols());
    const baseDelay = Math.min(
      reconnectBaseMs * 2 ** reconnectAttempt,
      MAX_RECONNECT_MS,
    );
    const delay = Math.round(baseDelay * (0.9 + random() * 0.2));
    reconnectAttempt += 1;
    reconnectTimer = timers.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function isCurrent(token: number, socket: SocketLike) {
    return current?.generation === token && current.socket === socket;
  }

  function finalizeClose(connection: Connection) {
    if (!isCurrent(connection.generation, connection.socket)) return;
    if (connection.closeTimer) {
      timers.clearTimeout(connection.closeTimer);
      connection.closeTimer = null;
    }
    current = null;
    if (connection.reconnectAfterClose && references.size > 0) {
      scheduleReconnect();
    }
  }

  function forceTerminate(connection: Connection) {
    if (!isCurrent(connection.generation, connection.socket)) return;
    try {
      connection.socket.terminate();
    } catch {
      return;
    }
    finalizeClose(connection);
  }

  function beginClosing(reconnectAfterClose: boolean, markStale: boolean) {
    const connection = current;
    if (!connection) return;
    connection.reconnectAfterClose ||= reconnectAfterClose;
    if (connection.phase === "closing") return;
    connection.phase = "closing";
    connection.authenticated = false;
    if (markStale) state.markStale(symbols());
    connection.closeTimer = timers.setTimeout(
      () => forceTerminate(connection),
      closeTimeoutMs,
    );
    try {
      connection.socket.close();
    } catch {
      forceTerminate(connection);
    }
  }

  function failConnection(token: number, socket: SocketLike) {
    if (!isCurrent(token, socket)) return;
    beginClosing(true, true);
  }

  function handleMessage(token: number, socket: SocketLike, raw: unknown) {
    if (!isCurrent(token, socket) || current?.phase !== "active") return;
    try {
      const quoteEvents: AlpacaQuoteEvent[] = [];
      for (const message of parseMessage(raw)) {
        if (!message || typeof message !== "object") continue;
        const event = message as Record<string, unknown>;
        if (event.T === "error") {
          failConnection(token, socket);
          return;
        }
        if (event.T === "success" && event.msg === "authenticated") {
          const connection = current;
          if (
            !connection ||
            connection.generation !== token ||
            connection.socket !== socket
          ) return;
          connection.authenticated = true;
          reconnectAttempt = 0;
          sendSubscription("subscribe", symbols());
        } else if (event.T === "subscription") {
          // Confirmation only; desired subscriptions remain reference-counted locally.
        } else if (
          event.T === "t" &&
          typeof event.S === "string" &&
          typeof event.p === "number" &&
          typeof event.t === "string"
        ) {
          quoteEvents.push(event as AlpacaStreamTrade);
        } else if (
          event.T === "b" &&
          typeof event.S === "string" &&
          typeof event.c === "number" &&
          typeof event.t === "string"
        ) {
          quoteEvents.push(event as AlpacaStreamBar);
        }
      }
      if (quoteEvents.length && isCurrent(token, socket)) state.apply(quoteEvents);
    } catch {
      failConnection(token, socket);
    }
  }

  function connect() {
    if (current || reconnectTimer || references.size === 0) return;
    const socket = createSocket(STREAM_URL);
    const token = ++generation;
    current = {
      generation: token,
      socket,
      authenticated: false,
      phase: "active",
      reconnectAfterClose: false,
      closeTimer: null,
    };
    socket.on("open", () => {
      if (!isCurrent(token, socket) || current?.phase !== "active") return;
      send({ action: "auth", key, secret });
    });
    socket.on("message", (value) => handleMessage(token, socket, value));
    socket.on("error", () => {
      failConnection(token, socket);
    });
    socket.on("close", () => {
      if (!isCurrent(token, socket)) return;
      const connection = current;
      if (!connection) return;
      if (connection.phase === "active") {
        connection.reconnectAfterClose = true;
        state.markStale(symbols());
      }
      finalizeClose(connection);
    });
  }

  return {
    subscribe(values: Iterable<string>) {
      if (idleTimer) {
        timers.clearTimeout(idleTimer);
        idleTimer = null;
      }
      const selected = [
        ...new Set([...values].map((symbol) => symbol.trim().toUpperCase())),
      ].filter(Boolean);
      const additions = selected.filter((symbol) => !references.has(symbol));
      if (references.size + additions.length > MAX_SYMBOLS) {
        throw new Error(`Alpaca stream supports at most ${MAX_SYMBOLS} symbols`);
      }
      const previousCounts = new Map(
        selected.map((symbol) => [symbol, references.get(symbol)]),
      );
      for (const symbol of selected) {
        references.set(symbol, (references.get(symbol) ?? 0) + 1);
      }
      try {
        if (current?.phase === "closing") {
          current.reconnectAfterClose = true;
        } else {
          connect();
        }
      } catch (error) {
        for (const [symbol, count] of previousCounts) {
          if (count === undefined) references.delete(symbol);
          else references.set(symbol, count);
        }
        throw error;
      }
      sendSubscription("subscribe", additions);
    },

    unsubscribe(values: Iterable<string>) {
      const removals: string[] = [];
      for (const symbol of new Set(
        [...values].map((value) => value.trim().toUpperCase()),
      )) {
        const count = references.get(symbol);
        if (count === undefined) continue;
        if (count <= 1) {
          references.delete(symbol);
          removals.push(symbol);
        } else {
          references.set(symbol, count - 1);
        }
      }
      sendSubscription("unsubscribe", removals);
      if (references.size === 0) {
        if (current?.phase === "closing") {
          current.reconnectAfterClose = false;
        }
        if (reconnectTimer) {
          timers.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (!idleTimer) {
          idleTimer = timers.setTimeout(() => {
            idleTimer = null;
            if (references.size > 0) return;
            beginClosing(false, false);
          }, idleTimeoutMs);
        }
      }
    },
  };
}

export type AlpacaStream = ReturnType<typeof createAlpacaStream>;

const globalStream = globalThis as typeof globalThis & {
  __marketAlpacaStream?: AlpacaStream;
};

export function getAlpacaStream() {
  return (
    globalStream.__marketAlpacaStream ??
    (globalStream.__marketAlpacaStream = createAlpacaStream())
  );
}
