type ControllerLike = {
  readonly desiredSize: number | null;
  enqueue(chunk: Uint8Array): void;
};

type BatchItem = {
  symbol: string;
};

const encoder = new TextEncoder();

function encodeEvent(name: string, value: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
}

export function createBoundedSseBroadcaster(controller: ControllerLike) {
  const pendingBatch = new Map<string, BatchItem>();
  let pendingHeartbeat: string | null = null;
  let active = true;

  const writable = () => active && (controller.desiredSize ?? 0) > 0;

  function flush() {
    if (!writable()) return;
    if (pendingBatch.size) {
      controller.enqueue(encodeEvent("batch", [...pendingBatch.values()]));
      pendingBatch.clear();
    }
    if (pendingHeartbeat !== null && writable()) {
      controller.enqueue(
        encodeEvent("heartbeat", { asOf: pendingHeartbeat }),
      );
      pendingHeartbeat = null;
    }
  }

  return {
    snapshot(value: unknown) {
      if (writable()) controller.enqueue(encodeEvent("snapshot", value));
    },

    batch<T extends BatchItem>(items: T[]) {
      if (!active || items.length === 0) return;
      if (pendingBatch.size || !writable()) {
        for (const item of items) pendingBatch.set(item.symbol, item);
        flush();
        return;
      }
      controller.enqueue(encodeEvent("batch", items));
    },

    heartbeat(asOf = new Date().toISOString()) {
      if (!active) return;
      if (pendingBatch.size || !writable()) {
        pendingHeartbeat = asOf;
        flush();
        return;
      }
      controller.enqueue(encodeEvent("heartbeat", { asOf }));
    },

    flush,

    stop() {
      active = false;
      pendingBatch.clear();
      pendingHeartbeat = null;
    },
  };
}

export type SseBroadcaster = ReturnType<typeof createBoundedSseBroadcaster>;
