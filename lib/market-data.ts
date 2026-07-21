import { z } from "zod";

export const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  sector: z.string(),
  marketCap: z.number(),
  pe: z.number(),
  volume: z.number(),
  spark: z.array(z.number()),
});

export type Quote = z.infer<typeof quoteSchema>;

export const eventSchema = z.object({
  time: z.string(),
  tag: z.string(),
  title: z.string(),
  detail: z.string(),
});

export const holdingSchema = z.object({
  symbol: z.string(),
  shares: z.number().positive(),
  avg: z.number().nonnegative(),
  price: z.number().nonnegative(),
  previousPrice: z.number().nonnegative(),
  sector: z.string(),
});

const researchSchema = z.object({
  quote: quoteSchema,
  history: z.array(z.object({ date: z.string(), price: z.number(), volume: z.number() })),
  financials: z.array(z.object({
    year: z.string(),
    revenue: z.number(),
    income: z.number(),
    margin: z.number(),
  })),
  metrics: z.object({
    enterpriseValue: z.number(),
    evEbitda: z.number(),
    dividendYield: z.number(),
    beta: z.number(),
    low52Week: z.number(),
    high52Week: z.number(),
  }),
  events: z.array(eventSchema),
});

export type ResearchSnapshot = z.infer<typeof researchSchema>;
export type Holding = z.infer<typeof holdingSchema>;

const quotes: Quote[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 234.41, change: 2.84, changePercent: 1.23, sector: "Technology", marketCap: 3520, pe: 35.7, volume: 48.2, spark: [229, 231, 230, 233, 232, 235, 234] },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 448.62, change: -1.53, changePercent: -0.34, sector: "Technology", marketCap: 3335, pe: 36.5, volume: 18.7, spark: [452, 450, 451, 449, 448, 450, 449] },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 139.56, change: 3.67, changePercent: 2.70, sector: "Technology", marketCap: 3418, pe: 54.1, volume: 286.4, spark: [131, 134, 133, 136, 135, 138, 140] },
  { symbol: "AMZN", name: "Amazon.com Inc.", price: 211.48, change: 1.12, changePercent: 0.53, sector: "Consumer", marketCap: 2225, pe: 44.8, volume: 31.5, spark: [208, 210, 209, 211, 210, 212, 211] },
  { symbol: "JPM", name: "JPMorgan Chase", price: 244.82, change: -2.06, changePercent: -0.83, sector: "Financials", marketCap: 684, pe: 13.6, volume: 9.8, spark: [250, 249, 247, 248, 246, 245, 245] },
  { symbol: "LLY", name: "Eli Lilly & Co.", price: 798.20, change: 10.36, changePercent: 1.32, sector: "Healthcare", marketCap: 758, pe: 68.2, volume: 3.1, spark: [770, 778, 781, 786, 790, 787, 798] },
  { symbol: "XOM", name: "Exxon Mobil Corp.", price: 108.37, change: -0.44, changePercent: -0.40, sector: "Energy", marketCap: 476, pe: 13.8, volume: 14.6, spark: [110, 109, 110, 108, 109, 108, 108] },
  { symbol: "COST", name: "Costco Wholesale", price: 916.71, change: 4.89, changePercent: 0.54, sector: "Consumer", marketCap: 406, pe: 55.2, volume: 1.7, spark: [900, 905, 902, 910, 912, 913, 917] },
];

const marketIndices = [
  { name: "S&P 500", symbol: "SPX", value: "5,982.47", change: 0.41 },
  { name: "Nasdaq 100", symbol: "NDX", value: "21,113.12", change: 0.68 },
  { name: "Dow Jones", symbol: "DJI", value: "43,287.03", change: -0.09 },
  { name: "Russell 2000", symbol: "RUT", value: "2,318.44", change: -0.32 },
];

const sectors = [
  ["Technology", 1.28], ["Communication", 0.74], ["Healthcare", 0.43],
  ["Industrials", 0.18], ["Utilities", -0.12], ["Financials", -0.39],
  ["Energy", -0.81], ["Real Estate", -1.04],
] as const;

const events = [
  { time: "10:30", tag: "MACRO", title: "EIA crude oil inventories", detail: "Actual -0.9M · Forecast -1.3M" },
  { time: "11:05", tag: "NEWS", title: "Large-cap technology leads morning trade", detail: "Semiconductors outperform while financials consolidate" },
  { time: "14:00", tag: "FED", title: "FOMC meeting minutes", detail: "Policy path and balance-sheet discussion" },
  { time: "16:05", tag: "EARN", title: "Salesforce earnings", detail: "Consensus EPS $2.44 · Revenue $9.35B" },
];

const holdings: Holding[] = [
  { symbol: "AAPL", shares: 120, avg: 184.20, price: 234.41, previousPrice: 231.57, sector: "Technology" },
  { symbol: "MSFT", shares: 52, avg: 371.40, price: 448.62, previousPrice: 450.15, sector: "Technology" },
  { symbol: "NVDA", shares: 140, avg: 91.72, price: 139.56, previousPrice: 135.89, sector: "Technology" },
  { symbol: "JPM", shares: 60, avg: 189.30, price: 244.82, previousPrice: 246.88, sector: "Financials" },
  { symbol: "LLY", shares: 14, avg: 623.10, price: 798.20, previousPrice: 787.84, sector: "Healthcare" },
  { symbol: "CASH", shares: 1, avg: 16241, price: 16241, previousPrice: 16241, sector: "Cash" },
];

const SNAPSHOT_DATE = "2026-07-21";

function buildResearchSnapshot(quote: Quote): ResearchSnapshot {
  const symbolSeed = [...quote.symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const history = Array.from({ length: 40 }, (_, index) => ({
    date: `W${index + 1}`,
    price: index === 39
      ? quote.price
      : +(quote.price * (0.78 + index * 0.0055 + Math.sin((index + symbolSeed) / 3) * 0.025)).toFixed(2),
    volume: +(quote.volume * (0.72 + Math.abs(Math.cos(index + symbolSeed)) * 0.55)).toFixed(1),
  }));
  const revenueBase = quote.marketCap / Math.max(quote.pe / 4, 3);
  const margin = Math.min(36, 12 + (symbolSeed % 19));
  const financials = ["FY21", "FY22", "FY23", "FY24", "FY25E"].map((year, index) => {
    const revenue = revenueBase * (0.72 + index * 0.075);
    return {
      year,
      revenue: +revenue.toFixed(1),
      income: +(revenue * margin / 100).toFixed(1),
      margin,
    };
  });

  return researchSchema.parse({
    quote,
    history,
    financials,
    metrics: {
      enterpriseValue: +(quote.marketCap * (0.96 + (symbolSeed % 12) / 100)).toFixed(1),
      evEbitda: +(quote.pe * 0.72).toFixed(1),
      dividendYield: +((symbolSeed % 17) / 10).toFixed(2),
      beta: +(0.75 + (symbolSeed % 70) / 100).toFixed(2),
      low52Week: +(quote.price * 0.72).toFixed(2),
      high52Week: +(quote.price * 1.08).toFixed(2),
    },
    events: [
      { time: "Jul 24", tag: "NEWS", title: `${quote.name} investor update`, detail: `Mock research event for ${quote.symbol}` },
      { time: "Aug 02", tag: "EARN", title: `${quote.symbol} earnings preview`, detail: `Consensus context based on the ${SNAPSHOT_DATE} mock snapshot` },
    ],
  });
}

export interface MarketRepository {
  getQuotes(): Quote[];
  getQuote(symbol: string): Quote | undefined;
  getOverview(): {
    snapshotDate: string;
    marketStatus: string;
    indices: typeof marketIndices;
    sectors: typeof sectors;
    events: z.infer<typeof eventSchema>[];
    watchlist: Quote[];
  };
  getResearch(symbol: string): ResearchSnapshot | undefined;
  getPortfolio(): { snapshotDate: string; holdings: Holding[]; events: z.infer<typeof eventSchema>[] };
}

export const marketRepository: MarketRepository = {
  getQuotes: () => quoteSchema.array().parse(quotes),
  getQuote: (symbol) => quoteSchema.array().parse(quotes).find((quote) => quote.symbol === symbol),
  getOverview: () => ({
    snapshotDate: SNAPSHOT_DATE,
    marketStatus: "Mock snapshot · US session shown open",
    indices: marketIndices,
    sectors,
    events: eventSchema.array().parse(events),
    watchlist: quoteSchema.array().parse(quotes).slice(0, 4),
  }),
  getResearch: (symbol) => {
    const quote = quoteSchema.array().parse(quotes).find((item) => item.symbol === symbol);
    return quote ? buildResearchSnapshot(quote) : undefined;
  },
  getPortfolio: () => ({
    snapshotDate: SNAPSHOT_DATE,
    holdings: holdingSchema.array().parse(holdings),
    events: eventSchema.array().parse([
      { time: "2026-07-18", tag: "BUY", title: "AAPL · 10 shares", detail: "Mock transaction" },
      { time: "2026-07-12", tag: "DIV", title: "MSFT · Cash dividend", detail: "Mock transaction" },
      { time: "2026-07-08", tag: "SELL", title: "XOM · 25 shares", detail: "Mock transaction" },
    ]),
  }),
};
