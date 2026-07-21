import {
  alpacaBarSchema,
  alpacaSnapshotSchema,
  fundamentalsSchema,
  realQuoteSchema,
  secCompanyFactsSchema,
  type Fundamentals,
  type RealQuote,
  type SecFactUnit,
} from "./contracts";

const QUOTE_STALE_AFTER_MS = 15 * 60 * 1000;
const FUNDAMENTALS_STALE_AFTER_MS = 18 * 30 * 24 * 60 * 60 * 1000;

function normalizeCik(cik: string | number) {
  return String(cik).replace(/^CIK/i, "").padStart(10, "0");
}

type MapAlpacaQuoteInput = {
  symbol: string;
  name?: string;
  sector?: string;
  snapshot: unknown;
  bars: unknown;
  now?: Date;
  staleAfterMs?: number;
};

function isStale(
  asOf: string | null,
  now: Date,
  staleAfterMs: number,
): boolean {
  if (!asOf) return true;
  const timestamp = Date.parse(asOf);
  const age = now.getTime() - timestamp;
  return !Number.isFinite(timestamp) || age < 0 || age > staleAfterMs;
}

export function mapAlpacaQuote(input: MapAlpacaQuoteInput): RealQuote {
  const snapshot = alpacaSnapshotSchema.parse(input.snapshot);
  const bars = alpacaBarSchema.array().parse(input.bars);
  const price =
    snapshot.latestTrade?.p ??
    snapshot.minuteBar?.c ??
    snapshot.dailyBar?.c ??
    null;
  const previousClose = snapshot.prevDailyBar?.c;
  const rawChange =
    price !== null && previousClose !== undefined
      ? price - previousClose
      : null;
  const change =
    rawChange === null ? null : Math.round(rawChange * 100) / 100;
  const changePercent =
    rawChange !== null && previousClose !== undefined && previousClose !== 0
      ? (rawChange / previousClose) * 100
      : null;
  const asOf =
    snapshot.latestTrade?.t ??
    snapshot.minuteBar?.t ??
    snapshot.dailyBar?.t ??
    null;
  const now = input.now ?? new Date();

  return realQuoteSchema.parse({
    symbol: input.symbol.toUpperCase(),
    name: input.name ?? null,
    price,
    previousClose: previousClose ?? null,
    change,
    changePercent,
    sector: input.sector ?? null,
    marketCap: null,
    pe: null,
    volume:
      snapshot.dailyBar?.v === undefined
        ? null
        : snapshot.dailyBar.v / 1_000_000,
    spark: bars.map((bar) => bar.c),
    source: "alpaca",
    asOf,
    stale: isStale(
      asOf,
      now,
      input.staleAfterMs ?? QUOTE_STALE_AFTER_MS,
    ),
  });
}

type ExtractFundamentalsOptions = {
  now?: Date;
  staleAfterMs?: number;
};

function factsForTag(
  facts: ReturnType<typeof secCompanyFactsSchema.parse>,
  namespace: string,
  tag: string,
  unit: string,
) {
  return facts.facts[namespace]?.[tag]?.units[unit] ?? [];
}

function latest(
  facts: SecFactUnit[],
  predicate: (fact: SecFactUnit) => boolean = () => true,
) {
  return facts
    .filter(predicate)
    .sort((a, b) =>
      `${b.end}|${b.filed ?? ""}`.localeCompare(`${a.end}|${a.filed ?? ""}`),
    )[0];
}

function durationDays(fact: SecFactUnit) {
  if (!fact.start) return null;
  return (Date.parse(fact.end) - Date.parse(fact.start)) / (24 * 60 * 60 * 1000);
}

function annualFacts(
  facts: ReturnType<typeof secCompanyFactsSchema.parse>,
  tags: string[],
) {
  const candidates = tags.flatMap((tag) =>
    factsForTag(facts, "us-gaap", tag, "USD"),
  );

  return candidates.filter((fact) => {
    const duration = durationDays(fact);
    return (
      (fact.form === "10-K" || fact.form === "10-K/A") &&
      fact.fp === "FY" &&
      duration !== null &&
      duration >= 300 &&
      duration <= 430
    );
  });
}

function latestByPeriod(facts: SecFactUnit[]) {
  const periods = new Map<string, SecFactUnit>();
  for (const fact of facts) {
    const period = `${fact.start}|${fact.end}`;
    const existing = periods.get(period);
    if (!existing || (fact.filed ?? "") > (existing.filed ?? "")) {
      periods.set(period, fact);
    }
  }
  return periods;
}

function latestCommonAnnual(
  revenueFacts: SecFactUnit[],
  netIncomeFacts: SecFactUnit[],
): [SecFactUnit | undefined, SecFactUnit | undefined] {
  const revenues = latestByPeriod(revenueFacts);
  const netIncomes = latestByPeriod(netIncomeFacts);
  const period = [...revenues.entries()]
    .filter(([key]) => netIncomes.has(key))
    .sort(([, a], [, b]) =>
      b.end.localeCompare(a.end) || (b.filed ?? "").localeCompare(a.filed ?? ""),
    )[0]?.[0];

  if (period) return [revenues.get(period), netIncomes.get(period)];

  const fallbackPeriod = [...new Set([...revenues.keys(), ...netIncomes.keys()])]
    .sort((left, right) => {
      const leftFact = revenues.get(left) ?? netIncomes.get(left);
      const rightFact = revenues.get(right) ?? netIncomes.get(right);
      return (
        (rightFact?.end ?? "").localeCompare(leftFact?.end ?? "") ||
        (rightFact?.filed ?? "").localeCompare(leftFact?.filed ?? "")
      );
    })[0];
  return fallbackPeriod
    ? [revenues.get(fallbackPeriod), netIncomes.get(fallbackPeriod)]
    : [undefined, undefined];
}

export function extractSecFundamentals(
  symbol: string,
  input: unknown,
  options: ExtractFundamentalsOptions = {},
): Fundamentals {
  const companyFacts = secCompanyFactsSchema.parse(input);
  const shares = latest(
    factsForTag(
      companyFacts,
      "dei",
      "EntityCommonStockSharesOutstanding",
      "shares",
    ),
  );
  const [revenue, netIncome] = latestCommonAnnual(
    annualFacts(companyFacts, [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]),
    annualFacts(companyFacts, ["NetIncomeLoss", "ProfitLoss"]),
  );
  const financialFiledDates = [revenue?.filed, netIncome?.filed].filter(
    (value): value is string => Boolean(value),
  );
  const asOf = financialFiledDates.length
    ? financialFiledDates.sort()[0]
    : [shares?.filed]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const now = options.now ?? new Date();

  return fundamentalsSchema.parse({
    symbol: symbol.toUpperCase(),
    cik: normalizeCik(companyFacts.cik),
    sharesOutstanding: shares?.val ?? null,
    revenue: revenue?.val ?? null,
    netIncome: netIncome?.val ?? null,
    fiscalYear:
      revenue || netIncome
        ? Number((revenue ?? netIncome)?.end.slice(0, 4))
        : null,
    source: "sec",
    asOf,
    stale: isStale(
      asOf,
      now,
      options.staleAfterMs ?? FUNDAMENTALS_STALE_AFTER_MS,
    ),
  });
}
