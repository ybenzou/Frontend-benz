"use client";

import { ArrowDownToLine, Plus } from "lucide-react";
import { useMemo } from "react";
import {
  DataGroup,
  EmphasisSurface,
  OpenSection,
  SectionHeader,
  SegmentedRule,
  TableRegion,
} from "@/components/layout/terminal-surfaces";
import { useLiveQuotes } from "@/components/market/use-live-quotes";
import type { Holding, MarketEvent, RealQuote } from "@/lib/market/contracts";
import { mergePortfolioQuotes } from "@/lib/market/live-quotes";
import { derivePortfolioSummary, formatCurrency, formatPercent } from "@/lib/market-utils";

const allocationColors: Record<string, string> = {
  Technology: "#6daeb8",
  Financials: "#8795aa",
  Healthcare: "#56b894",
  "Health Care": "#56b894",
  Cash: "#78858e",
};

type Props = {
  portfolio: {
    snapshotDate: string;
    holdings: Holding[];
    events: MarketEvent[];
    mode: "mock" | "real";
    dataLabel: "MOCK" | "IEX";
    quotes: RealQuote[];
  };
};

export function PortfolioWorkspace({ portfolio }: Props) {
  const symbols = useMemo(
    () =>
      portfolio.holdings
        .filter(({ symbol }) => symbol !== "CASH")
        .map(({ symbol }) => symbol),
    [portfolio.holdings],
  );
  const live = useLiveQuotes({
    initial: portfolio.quotes,
    symbols,
    enabled: portfolio.mode === "real",
  });
  const holdings = useMemo(
    () => mergePortfolioQuotes(portfolio.holdings, live.quotes),
    [live.quotes, portfolio.holdings],
  );
  const summary = useMemo(
    () => derivePortfolioSummary(holdings),
    [holdings],
  );
  const dataStatus = portfolio.mode === "real" ? live.status : "MOCK";
  const cards = [
    ["Net value", formatCurrency(summary.netValue), `${dataStatus} · ${portfolio.snapshotDate}`],
    ["Day gain", formatCurrency(summary.dayGain), formatPercent(summary.dayReturn)],
    ["Total return", formatCurrency(summary.totalGain), formatPercent(summary.totalReturn)],
    ["Cash balance", formatCurrency(summary.cashBalance), `${summary.cashWeight.toFixed(2)}% of portfolio`],
  ];

  return <div className="page-grid pb-16 md:pb-0">
    <h1 className="sr-only">Portfolio</h1>
    <EmphasisSurface>
      <SectionHeader className="flex-wrap px-4 py-2" title="Main account" meta={dataStatus} actions={<div className="flex gap-2"><button disabled title="Portfolio import is unavailable in this demo" aria-label="Portfolio import unavailable in demo" className="control flex items-center gap-2"><ArrowDownToLine size={14}/> Import</button><button disabled title="Transactions are unavailable in this demo" aria-label="Add transaction unavailable in demo" className="control flex items-center gap-2"><Plus size={14}/> Transaction</button></div>} />
      <SegmentedRule />
      <div className="grid sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
        {cards.map(([label, value, detail], index) => <div className={`border-b border-r border-[var(--line-subtle)] p-4 ${index === 0 ? "bg-[var(--surface-raised)]" : ""}`} key={label}><div className="eyebrow">{label}</div><div className={`tnum mt-3 text-[1.5rem] font-semibold ${index === 1 ? summary.dayGain >= 0 ? "positive" : "negative" : index === 2 ? summary.totalGain >= 0 ? "positive" : "negative" : ""}`}>{value}</div><div className="muted tnum mt-1 text-xs">{detail}</div></div>)}
      </div>
    </EmphasisSurface>
    <div className="desktop-grid grid grid-cols-[minmax(0,1.6fr)_minmax(280px,.6fr)] gap-3">
      <EmphasisSurface><SectionHeader className="px-4" title="Holdings" actions={<span className="muted text-xs">{summary.positions.length} positions · {dataStatus}</span>} /><SegmentedRule /><TableRegion><table className="data-table tnum"><thead><tr><th>Symbol</th><th>Shares</th><th>Avg. cost</th><th>Last</th><th>Market value</th><th>Return</th><th>Weight</th></tr></thead><tbody>
        {summary.positions.map((holding) => <tr key={holding.symbol}><td><strong>{holding.symbol}</strong></td><td>{holding.symbol === "CASH" ? "—" : holding.shares}</td><td>{formatCurrency(holding.avg)}</td><td>{formatCurrency(holding.price)}</td><td>{formatCurrency(holding.marketValue)}</td><td className={holding.returnPercent >= 0 ? "positive" : "negative"}>{holding.symbol === "CASH" ? "—" : formatPercent(holding.returnPercent)}</td><td>{holding.weight.toFixed(1)}%</td></tr>)}
      </tbody></table></TableRegion></EmphasisSurface>
      <div className="page-grid">
        <OpenSection><SectionHeader title="Allocation" actions={<span className="eyebrow">Derived sector</span>} /><SegmentedRule /><DataGroup className="py-3"><div className="mb-5 flex h-2 overflow-hidden rounded-[2px]" role="img" aria-label={summary.allocations.map((item) => `${item.sector} ${item.weight.toFixed(1)}%`).join(", ")}>{summary.allocations.map((item) => <div title={item.sector} key={item.sector} style={{ width: `${item.weight}%`, background: allocationColors[item.sector] ?? "#78858e" }}/>)}</div><div className="space-y-3">{summary.allocations.map((item) => <div className="flex items-center" key={item.sector}><span className="mr-2 size-2" style={{ background: allocationColors[item.sector] ?? "#78858e" }}/><span className="muted flex-1">{item.sector}</span><strong className="tnum">{item.weight.toFixed(1)}%</strong></div>)}</div></DataGroup></OpenSection>
        <OpenSection><SectionHeader title="Recent activity" actions={<span className="eyebrow">STATIC</span>} /><SegmentedRule align="end" /><DataGroup>{portfolio.events.map((event) => <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] p-3 last:border-0" key={`${event.time}-${event.title}`}><span className="eyebrow w-8 text-[var(--accent)]">{event.tag}</span><span className="flex-1 text-xs">{event.title}</span><span className="muted tnum text-xs">{event.time.slice(5)}</span></div>)}</DataGroup></OpenSection>
      </div>
    </div>
  </div>;
}
