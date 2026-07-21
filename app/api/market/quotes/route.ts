import "server-only";

import { MarketDataUnavailableError } from "../../../../lib/market/cache.server";
import { realQuoteSchema, type RealQuote } from "../../../../lib/market/contracts";
import { getQuoteService } from "../../../../lib/market/quotes.server";
import { quoteState } from "../../../../lib/market/stream/quote-state.server";
import { normalizeAllowedSymbols } from "../../../../lib/market/symbols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuotesRouteDependencies = {
  loadQuotes(symbols: string[]): Promise<RealQuote[]>;
  seedQuotes?(quotes: RealQuote[]): void;
};

export function createQuotesHandler({
  loadQuotes,
  seedQuotes = () => {},
}: QuotesRouteDependencies) {
  return async function GET(request: Request): Promise<Response> {
    const symbols = normalizeAllowedSymbols(
      new URL(request.url).searchParams.get("symbols"),
    );
    if (!symbols) {
      return Response.json({ error: "INVALID_SYMBOLS" }, { status: 400 });
    }

    try {
      const quotes = realQuoteSchema.array().parse(await loadQuotes(symbols));
      seedQuotes(quotes);
      return Response.json(
        { quotes },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (!(error instanceof MarketDataUnavailableError)) {
        console.error("Market quote request failed", error);
      }
      return Response.json(
        { error: "MARKET_DATA_UNAVAILABLE" },
        { status: 503 },
      );
    }
  };
}

export async function GET(request: Request) {
  return createQuotesHandler({
    loadQuotes: (symbols) => getQuoteService().loadQuotes(symbols),
    seedQuotes: (quotes) => quoteState.seed(quotes),
  })(request);
}
