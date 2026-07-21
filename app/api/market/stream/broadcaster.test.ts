import { describe, expect, it } from "vitest";

describe("bounded SSE broadcaster", () => {
  it("merges backpressured quote updates into one latest batch", async () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      desiredSize: 0,
      enqueue(chunk: Uint8Array) {
        chunks.push(chunk);
      },
    };
    const { createBoundedSseBroadcaster } = await import("./broadcaster");
    const broadcaster = createBoundedSseBroadcaster(controller);

    broadcaster.batch([{ symbol: "AAPL", price: 1 }]);
    broadcaster.batch([
      { symbol: "AAPL", price: 2 },
      { symbol: "MSFT", price: 3 },
    ]);
    expect(chunks).toHaveLength(0);

    controller.desiredSize = 1;
    broadcaster.flush();

    expect(chunks).toHaveLength(1);
    const payload = new TextDecoder().decode(chunks[0]);
    expect(payload).toContain('"symbol":"AAPL","price":2');
    expect(payload).toContain('"symbol":"MSFT","price":3');
    expect(payload).not.toContain('"price":1');
  });

  it("keeps at most one pending heartbeat while backpressured", async () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      desiredSize: 0,
      enqueue(chunk: Uint8Array) {
        chunks.push(chunk);
      },
    };
    const { createBoundedSseBroadcaster } = await import("./broadcaster");
    const broadcaster = createBoundedSseBroadcaster(controller);

    broadcaster.heartbeat("first");
    broadcaster.heartbeat("latest");
    controller.desiredSize = 1;
    broadcaster.flush();

    expect(chunks).toHaveLength(1);
    expect(new TextDecoder().decode(chunks[0])).toContain("latest");
  });
});
