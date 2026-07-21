import "server-only";

import { getAlpacaStream } from "../../../../lib/market/stream/alpaca-stream.server";
import {
  quoteState,
  type QuoteStateListener,
} from "../../../../lib/market/stream/quote-state.server";
import { normalizeAllowedSymbols } from "../../../../lib/market/symbols";
import {
  createBoundedSseBroadcaster,
  type SseBroadcaster,
} from "./broadcaster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamRouteDependencies = {
  state: {
    snapshots(symbols: Iterable<string>): unknown[];
    subscribe(listener: QuoteStateListener): () => void;
  };
  stream: {
    subscribe(symbols: Iterable<string>): void;
    unsubscribe(symbols: Iterable<string>): void;
  } | (() => {
    subscribe(symbols: Iterable<string>): void;
    unsubscribe(symbols: Iterable<string>): void;
  });
  heartbeatMs?: number;
};

export function createStreamHandler({
  state,
  stream,
  heartbeatMs = 3_000,
}: StreamRouteDependencies) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const symbols = normalizeAllowedSymbols(url.searchParams.get("symbols"));
    if (!symbols) {
      return Response.json(
        { error: "INVALID_SYMBOLS" },
        { status: 400 },
      );
    }

    let connection: Exclude<StreamRouteDependencies["stream"], () => unknown>;
    try {
      connection = typeof stream === "function" ? stream() : stream;
      connection.subscribe(symbols);
    } catch {
      return Response.json(
        { error: "STREAM_UNAVAILABLE" },
        { status: 503 },
      );
    }

    const selected = new Set(symbols);
    let cleanup: (closeController: boolean) => void = () => {};
    let broadcaster: SseBroadcaster | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let cleaned = false;
        broadcaster = createBoundedSseBroadcaster(controller);
        broadcaster.snapshot(state.snapshots(symbols));

        const removeListener = state.subscribe((batch) => {
          const filtered = batch.filter((snapshot) => selected.has(snapshot.symbol));
          if (filtered.length) broadcaster?.batch(filtered);
        });
        const heartbeat = setInterval(
          () => broadcaster?.heartbeat(),
          heartbeatMs,
        );
        const onAbort = () => cleanup(true);

        cleanup = (closeController) => {
          if (cleaned) return;
          cleaned = true;
          clearInterval(heartbeat);
          request.signal.removeEventListener("abort", onAbort);
          removeListener();
          connection.unsubscribe(symbols);
          broadcaster?.stop();
          if (closeController) controller.close();
        };
        request.signal.addEventListener("abort", onAbort, { once: true });
        if (request.signal.aborted) cleanup(true);
      },
      pull() {
        broadcaster?.flush();
      },
      cancel() {
        cleanup(false);
      },
    });

    return new Response(body, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  };
}

export async function GET(request: Request) {
  return createStreamHandler({
    state: quoteState,
    stream: getAlpacaStream,
  })(request);
}
