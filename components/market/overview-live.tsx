"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { useMemo } from "react";
import { Sparkline } from "@/components/charts";
import {
  DataGroup,
  EmphasisSurface,
  OpenSection,
  SectionHeader,
  SegmentedRule,
  TableRegion,
} from "@/components/layout/terminal-surfaces";
import { useLiveQuotes } from "@/components/market/use-live-quotes";
import type { MarketEvent, Quote, RealQuote } from "@/lib/market/contracts";
import { aggregateQuoteSectors, mergeQuoteRows } from "@/lib/market/live-quotes";
import { formatCurrency, formatPercent, getDivergingBar } from "@/lib/market-utils";

type IndexRow = {
  name: string;
  symbol: string;
  value: number | null;
  change: number | null;
  proxy: boolean;
};

type Props = {
  mode: "mock" | "real";
  dataLabel: string;
  indices: IndexRow[];
  sectors: [string, number][];
  watchlist: (Quote | RealQuote)[];
  events: MarketEvent[];
  initialLive: RealQuote[];
};

function show(value: number | null, format: (value: number) => string) {
  return value === null ? "—" : format(value);
}

export function OverviewLive({
  mode,
  dataLabel,
  indices,
  sectors: initialSectors,
  watchlist: initialWatchlist,
  events,
  initialLive,
}: Props) {
  const symbols = useMemo(
    () => initialLive.map(({ symbol }) => symbol),
    [initialLive],
  );
  const live = useLiveQuotes({
    initial: initialLive,
    symbols,
    enabled: mode === "real",
  });
  const watchlist =
    mode === "real"
      ? mergeQuoteRows(initialWatchlist as RealQuote[], live.quotes)
      : initialWatchlist;
  const sectors =
    mode === "real"
      ? aggregateQuoteSectors(watchlist as RealQuote[])
      : initialSectors;
  const status = mode === "real" ? live.status : "MOCK";

  return <>
    <OpenSection className="index-grid">
      {indices.map((item, index) => {
        const quote = live.quotes[item.symbol];
        const value = mode === "real" ? quote?.price ?? item.value : item.value;
        const change = mode === "real" ? quote?.changePercent ?? item.change : item.change;
        return <div key={item.symbol} className={`index-cell ${index === 0 ? "sm:px-5" : ""}`}>
          <div className="flex items-center justify-between"><span className="muted text-[.75rem]">{item.name}</span><span className="eyebrow">{item.symbol}{item.proxy ? " · ETF PROXY" : ""}</span></div>
          <div className={`tnum mt-3 font-semibold tracking-[-.02em] ${index === 0 ? "text-[1.75rem]" : "text-[1.5rem]"}`}>{show(value, (number) => number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</div>
          <div className={`tnum mt-1 text-[.75rem] ${(change ?? 0) >= 0 ? "positive" : "negative"}`}>{show(change, formatPercent)} <span className="font-sans tracking-normal text-[var(--muted)]">session · {status}</span></div>
        </div>;
      })}
    </OpenSection>
    <SegmentedRule />
    <div className="overview-grid">
      <EmphasisSurface className="overview-primary">
        <SectionHeader className="px-4" title="Core watchlist" meta={`${dataLabel} · ${status}`} actions={<Link href="/watchlist" className="accent-link flex items-center gap-1 text-xs">Open full list <ArrowRight size={13}/></Link>} />
        <SegmentedRule />
        <TableRegion><table className="data-table tnum"><thead><tr><th>Symbol</th><th>Last</th><th>Change</th><th>Volume</th><th>1D trend</th></tr></thead><tbody>
          {watchlist.map((quote) => <tr key={quote.symbol}><td><Link href={`/research/${quote.symbol}`}><strong>{quote.symbol}</strong><span className="muted ml-2 text-xs">{quote.name ?? "—"}</span></Link></td><td>{show(quote.price, formatCurrency)}</td><td className={(quote.change ?? 0) >= 0 ? "positive" : "negative"}>{show(quote.changePercent, formatPercent)}</td><td>{show(quote.volume, (number) => `${number.toFixed(1)}M`)}</td><td><Sparkline data={quote.spark} positive={(quote.change ?? 0) >= 0}/></td></tr>)}
        </tbody></table></TableRegion>
      </EmphasisSurface>
      <OpenSection className="overview-secondary">
        <SectionHeader title="Sector breadth" actions={<span className="eyebrow">1D · {status}</span>} />
        <SegmentedRule />
        <DataGroup className="grid grid-cols-2">
          {sectors.map(([name, change]) => {
            const bar = getDivergingBar(change, 2);
            return <div key={name} className="border-b border-r border-[var(--line-subtle)] p-3"><div className="muted text-[.75rem]">{name}</div><div className={`tnum mt-1.5 font-medium ${change >= 0 ? "positive" : "negative"}`}>{formatPercent(change)}</div><div aria-hidden="true" data-direction={bar.direction} className={`sector-bar mt-2 h-[2px] ${change >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}><span style={{ width: `${bar.size}%` }}/></div></div>;
          })}
        </DataGroup>
      </OpenSection>
      <OpenSection className="overview-secondary">
        <SectionHeader title="Session events" actions={<span className="flex items-center gap-2"><span className="eyebrow">STATIC</span><CalendarClock size={15} className="muted"/></span>} />
        <SegmentedRule align="end" />
        <DataGroup>{events.map((event) => <div key={`${event.time}-${event.title}`} className="grid grid-cols-[42px_45px_1fr] items-start gap-2 border-b border-[var(--line-subtle)] px-3 py-2.5 last:border-0"><span className="tnum muted text-[.6875rem]">{event.time}</span><span className="eyebrow text-[var(--accent)]">{event.tag}</span><div><div className="text-xs font-medium">{event.title}</div><div className="muted mt-0.5 line-clamp-1 text-[.6875rem]">{event.detail}</div></div></div>)}</DataGroup>
      </OpenSection>
    </div>
  </>;
}
