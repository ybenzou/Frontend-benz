import { z } from "zod";

const isoTimestampSchema = z.iso.datetime({ offset: true });
const isoDateSchema = z.iso.date();

export const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  sector: z.string(),
  marketCap: z.number(),
  pe: z.number(),
  volume: z.number().nonnegative(),
  spark: z.array(z.number()),
});

export type Quote = z.infer<typeof quoteSchema>;

export const realQuoteSchema = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  price: z.number().nullable(),
  previousClose: z.number().nullable(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
  sector: z.string().nullable(),
  marketCap: z.number().nullable(),
  pe: z.number().nullable(),
  volume: z.number().nonnegative().nullable(),
  spark: z.array(z.number()),
  source: z.literal("alpaca"),
  asOf: isoTimestampSchema.nullable(),
  stale: z.boolean(),
});

export type RealQuote = z.infer<typeof realQuoteSchema>;

export const fundamentalsSchema = z.object({
  symbol: z.string(),
  cik: z.string(),
  sharesOutstanding: z.number().nullable(),
  revenue: z.number().nullable(),
  netIncome: z.number().nullable(),
  fiscalYear: z.number().nullable(),
  source: z.literal("sec"),
  asOf: isoDateSchema.nullable(),
  stale: z.boolean(),
});

export type Fundamentals = z.infer<typeof fundamentalsSchema>;

export const eventSchema = z.object({
  time: z.string(),
  tag: z.string(),
  title: z.string(),
  detail: z.string(),
});

export type MarketEvent = z.infer<typeof eventSchema>;

export const holdingSchema = z.object({
  symbol: z.string(),
  shares: z.number().positive(),
  avg: z.number().nonnegative(),
  price: z.number().nonnegative(),
  previousPrice: z.number().nonnegative(),
  sector: z.string(),
});

export const researchSchema = z.object({
  quote: z.union([quoteSchema, realQuoteSchema]),
  history: z.array(
    z.object({ date: z.string(), price: z.number(), volume: z.number() }),
  ),
  financials: z.array(
    z.object({
      year: z.string(),
      revenue: z.number().nullable(),
      income: z.number().nullable(),
      margin: z.number().nullable(),
    }),
  ),
  metrics: z.object({
    enterpriseValue: z.number().nullable(),
    evEbitda: z.number().nullable(),
    dividendYield: z.number().nullable(),
    beta: z.number().nullable(),
    low52Week: z.number().nullable(),
    high52Week: z.number().nullable(),
  }),
  events: z.array(eventSchema),
  source: z.enum(["mock", "alpaca+sec"]).default("mock"),
  asOf: z.union([isoTimestampSchema, isoDateSchema]).nullable().default(null),
  stale: z.boolean().default(false),
  feed: z.enum(["mock", "iex"]).default("mock"),
  eventSource: z.literal("static").default("static"),
});

export type ResearchSnapshot = z.infer<typeof researchSchema>;
export type Holding = z.infer<typeof holdingSchema>;

export const alpacaBarSchema = z
  .object({
    c: z.number().nonnegative(),
    h: z.number().nonnegative().optional(),
    l: z.number().nonnegative().optional(),
    n: z.number().int().nonnegative().optional(),
    o: z.number().nonnegative().optional(),
    t: isoTimestampSchema,
    v: z.number().nonnegative().optional(),
    vw: z.number().nonnegative().optional(),
  })
  .passthrough();

export const alpacaTradeSchema = z
  .object({
    p: z.number().nonnegative(),
    s: z.number().nonnegative().optional(),
    t: isoTimestampSchema,
  })
  .passthrough();

export const alpacaSnapshotSchema = z
  .object({
    latestTrade: alpacaTradeSchema.optional(),
    minuteBar: alpacaBarSchema.optional(),
    dailyBar: alpacaBarSchema.optional(),
    prevDailyBar: alpacaBarSchema.optional(),
  })
  .passthrough();

export const alpacaSnapshotsResponseSchema = z.record(
  z.string(),
  alpacaSnapshotSchema,
);

export const alpacaBarsResponseSchema = z.object({
  bars: z.record(z.string(), z.array(alpacaBarSchema)),
  next_page_token: z.string().nullable().optional(),
});

export type AlpacaBar = z.infer<typeof alpacaBarSchema>;
export type AlpacaSnapshot = z.infer<typeof alpacaSnapshotSchema>;
export type AlpacaSnapshotsResponse = z.infer<typeof alpacaSnapshotsResponseSchema>;
export type AlpacaBarsResponse = z.infer<typeof alpacaBarsResponseSchema>;

export const secTickerEntrySchema = z.object({
  cik_str: z.number().int().nonnegative(),
  ticker: z.string(),
  title: z.string(),
});

export const secTickerMapResponseSchema = z.record(z.string(), secTickerEntrySchema);

export const secFactUnitSchema = z
  .object({
    val: z.number(),
    end: isoDateSchema,
    filed: isoDateSchema.optional(),
    form: z.string().optional(),
    fy: z.union([z.number(), z.string()]).optional(),
    fp: z.string().optional(),
    start: isoDateSchema.optional(),
  })
  .passthrough();

export const secFactSchema = z
  .object({
    label: z.string().optional(),
    units: z.record(z.string(), z.array(secFactUnitSchema)),
  })
  .passthrough();

export const secCompanyFactsSchema = z
  .object({
    cik: z.union([z.number(), z.string()]),
    entityName: z.string(),
    facts: z.record(z.string(), z.record(z.string(), secFactSchema)),
  })
  .passthrough();

const secReportDateSchema = z.union([isoDateSchema, z.literal("")]);

export const secRecentFilingsSchema = z
  .object({
    accessionNumber: z.array(
      z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
    ),
    filingDate: z.array(isoDateSchema),
    reportDate: z.array(secReportDateSchema),
    form: z.array(z.string()),
    primaryDocument: z.array(z.string()),
    acceptanceDateTime: z.array(z.string()).optional(),
    act: z.array(z.string()).optional(),
    fileNumber: z.array(z.string()).optional(),
    filmNumber: z.array(z.string()).optional(),
    items: z.array(z.string()).optional(),
    size: z.array(z.number().int().nonnegative()).optional(),
    isXBRL: z.array(z.number().int().nonnegative()).optional(),
    isInlineXBRL: z.array(z.number().int().nonnegative()).optional(),
    primaryDocDescription: z.array(z.string()).optional(),
  })
  .passthrough();

export const secSubmissionFileSchema = z
  .object({
    name: z.string(),
    filingCount: z.number().int().nonnegative(),
    filingFrom: isoDateSchema,
    filingTo: isoDateSchema,
  })
  .passthrough();

export const secFilingsSchema = z
  .object({
    recent: secRecentFilingsSchema,
    files: z.array(secSubmissionFileSchema),
  })
  .passthrough();

export const secSubmissionsSchema = z
  .object({
    cik: z.union([z.number(), z.string()]),
    name: z.string(),
    filings: secFilingsSchema,
  })
  .passthrough();

export type SecCompanyFacts = z.infer<typeof secCompanyFactsSchema>;
export type SecSubmissions = z.infer<typeof secSubmissionsSchema>;
export type SecFactUnit = z.infer<typeof secFactUnitSchema>;
