import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("real market pages", () => {
  it("keeps server-only repositories out of live client workspaces", async () => {
    const files = await Promise.all([
      readFile(new URL("./watchlist/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./screener/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./portfolio/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/market/watchlist-workspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/market/screener-workspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/market/portfolio-workspace.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/market/overview-live.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/market/real-quote-display.tsx", import.meta.url), "utf8"),
    ]);
    const [watchlist, screener, portfolio, ...clients] = files;

    for (const page of [watchlist, screener, portfolio]) {
      expect(page).toContain("async function");
      expect(page).toContain("getMarketServerRepository");
    }
    for (const client of clients) {
      expect(client).toContain('"use client"');
      expect(client).toContain("useLiveQuotes");
      expect(client).not.toContain("repository.server");
    }
  });

  it("forces the overview and research routes to render dynamically", async () => {
    const [overview, research] = await Promise.all([
      readFile(new URL("./page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./research/[symbol]/page.tsx", import.meta.url), "utf8"),
    ]);

    expect(overview).toContain('export const dynamic = "force-dynamic"');
    expect(research).toContain('export const dynamic = "force-dynamic"');
  });

  it("documents mock as the default market data mode", async () => {
    const envExample = await readFile(
      new URL("../.env.example", import.meta.url),
      "utf8",
    );

    expect(envExample).toContain("MARKET_DATA_MODE=mock");
  });
});
