export const SYMBOL_METADATA_VERSION = 1 as const;

export type SymbolMetadata = {
  symbol: string;
  name: string;
  sector: string;
  cik: string | null;
};

const entries: SymbolMetadata[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", cik: "0000320193" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", cik: "0000789019" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", cik: "0001045810" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", sector: "Consumer Discretionary", cik: "0001018724" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", cik: "0000019617" },
  { symbol: "LLY", name: "Eli Lilly and Co.", sector: "Health Care", cik: "0000059478" },
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", cik: "0000034088" },
  { symbol: "COST", name: "Costco Wholesale Corp.", sector: "Consumer Staples", cik: "0000909832" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", sector: "ETF", cik: null },
  { symbol: "QQQ", name: "Invesco QQQ Trust", sector: "ETF", cik: null },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust", sector: "ETF", cik: null },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", sector: "ETF", cik: null },
];

export const SYMBOL_METADATA = Object.freeze(
  Object.fromEntries(entries.map((entry) => [entry.symbol, Object.freeze(entry)])),
) as Readonly<Record<string, Readonly<SymbolMetadata>>>;

export const ALLOWED_SYMBOLS = Object.freeze(entries.map(({ symbol }) => symbol));

export function normalizeAllowedSymbols(value: string | null): string[] | null {
  if (!value) return null;
  const symbols = [...new Set(value.split(",").map((symbol) => symbol.trim().toUpperCase()))];
  if (
    symbols.length === 0 ||
    symbols.length > 30 ||
    symbols.some(
      (symbol) => !/^[A-Z]{1,5}$/.test(symbol) || !(symbol in SYMBOL_METADATA),
    )
  ) {
    return null;
  }
  return symbols;
}
