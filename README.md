# MarketDesk

A desktop-first US equities workspace built with Next.js 16, React 19, Tailwind CSS 4, Recharts, Zod, and Vitest.

## Run

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Open `http://localhost:3000`. Main routes are `/`, `/watchlist`, `/research/AAPL`, `/screener`, and `/portfolio`.

## Architecture

- `app/` contains App Router pages and route-level client boundaries.
- `components/` contains the workspace shell and responsive chart primitives.
- `lib/market-data.ts` owns Zod-validated quotes, research snapshots, holdings, and events behind `MarketRepository`.
- `lib/market-utils.ts` contains reusable formatting, screening, and portfolio-derivation logic.

`MarketRepository` is the page-facing boundary for overview, research, and portfolio data (`getOverview`, `getResearch`, and `getPortfolio`). To connect a real provider, replace those methods with server-only fetches and map each response through the existing Zod schemas. Keep API credentials on the server and add caching/revalidation based on the data’s freshness.

All displayed values are deterministic mock snapshots dated July 21, 2026. Market-open labels are presentation data, not a live exchange status.

## Cloudflare Tunnel

For temporary remote preview, run the app and expose it with:

```bash
pnpm dev
cloudflared tunnel --url http://localhost:3000
```

Use a named tunnel and access policies for persistent or non-public environments.
