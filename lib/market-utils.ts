export function formatCurrency(
  value: number,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function getDivergingBar(value: number, maxMagnitude: number) {
  const direction = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  const scale = maxMagnitude > 0 ? maxMagnitude : 1;

  return {
    direction,
    size: Math.min(Math.abs(value) / scale, 1) * 50,
  };
}

export type ScreenerFilters = {
  sector?: string;
  minMarketCap?: number;
  maxPe?: number;
};

export function filterScreener<
  T extends {
    sector: string | null;
    marketCap: number | null;
    pe?: number | null;
  },
>(
  stocks: T[],
  filters: ScreenerFilters,
) {
  return stocks.filter(
    (stock) =>
      (!filters.sector ||
        filters.sector === "All sectors" ||
        stock.sector === filters.sector) &&
      (!filters.minMarketCap ||
        (stock.marketCap !== null &&
          stock.marketCap >= filters.minMarketCap)) &&
      (!filters.maxPe || (stock.pe != null && stock.pe <= filters.maxPe)),
  );
}

export type PortfolioHolding = {
  symbol: string;
  shares: number;
  avg: number;
  price: number;
  previousPrice: number;
  sector: string;
};

export function derivePortfolioSummary<T extends PortfolioHolding>(holdings: T[]) {
  const positions = holdings.map((holding) => ({
    ...holding,
    marketValue: holding.shares * holding.price,
    costBasis: holding.shares * holding.avg,
    dayGain: holding.shares * (holding.price - holding.previousPrice),
  }));
  const netValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const costBasis = positions.reduce((sum, position) => sum + position.costBasis, 0);
  const dayGain = positions.reduce((sum, position) => sum + position.dayGain, 0);
  const cashBalance = positions
    .filter((position) => position.sector === "Cash")
    .reduce((sum, position) => sum + position.marketValue, 0);
  const sectors = new Map<string, number>();

  for (const position of positions) {
    sectors.set(position.sector, (sectors.get(position.sector) ?? 0) + position.marketValue);
  }

  return {
    netValue,
    dayGain,
    dayReturn: netValue - dayGain === 0 ? 0 : (dayGain / (netValue - dayGain)) * 100,
    totalGain: netValue - costBasis,
    totalReturn: costBasis === 0 ? 0 : ((netValue - costBasis) / costBasis) * 100,
    cashBalance,
    cashWeight: netValue === 0 ? 0 : (cashBalance / netValue) * 100,
    positions: positions.map((position) => ({
      ...position,
      weight: netValue === 0 ? 0 : (position.marketValue / netValue) * 100,
      returnPercent:
        position.costBasis === 0
          ? 0
          : ((position.marketValue - position.costBasis) / position.costBasis) * 100,
    })),
    allocations: Array.from(sectors, ([sector, value]) => ({
      sector,
      value,
      weight: netValue === 0 ? 0 : (value / netValue) * 100,
    })),
  };
}
