"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts";
import {
  DataGroup,
  OpenSection,
  SectionHeader,
  SegmentedRule,
  TableRegion,
} from "@/components/layout/terminal-surfaces";
import { useLiveQuotes } from "@/components/market/use-live-quotes";
import type { Quote, RealQuote } from "@/lib/market/contracts";
import { mergeQuoteRows } from "@/lib/market/live-quotes";
import { formatCurrency, formatPercent } from "@/lib/market-utils";

type Props = {
  initial: (Quote | RealQuote)[];
  mode: "mock" | "real";
};

function show(value: number | null, format: (value: number) => string) {
  return value === null ? "—" : format(value);
}

export function WatchlistWorkspace({ initial, mode }: Props) {
  const [query, setQuery] = useState("");
  const realInitial = useMemo(
    () => (mode === "real" ? (initial as RealQuote[]) : []),
    [initial, mode],
  );
  const symbols = useMemo(
    () => realInitial.map(({ symbol }) => symbol),
    [realInitial],
  );
  const live = useLiveQuotes({
    initial: realInitial,
    symbols,
    enabled: mode === "real",
  });
  const quotes =
    mode === "real" ? mergeQuoteRows(realInitial, live.quotes) : initial;
  const rows = quotes.filter((quote) =>
    `${quote.symbol} ${quote.name ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return <div className="page-grid pb-16 md:pb-0">
    <h1 className="sr-only">Watchlist</h1>
    <OpenSection>
      <SectionHeader title="Core watchlist" meta={mode === "real" ? live.status : "MOCK"} actions={<div className="flex gap-2"><button disabled title="Column customization is unavailable in this demo" aria-label="Column customization unavailable in demo" className="control flex items-center gap-2"><SlidersHorizontal size={14}/> Columns</button><button disabled title="Adding symbols is unavailable in this demo" aria-label="Add symbol unavailable in demo" className="control">+ Add symbol</button></div>} />
      <SegmentedRule />
      <DataGroup className="data-toolbar">
        <div className="flex min-w-0 max-w-xl basis-64 flex-1 items-center gap-2"><Search size={15} className="muted"/><input aria-label="Filter watchlist by symbol or company" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm" placeholder="Filter watchlist by symbol or company"/></div>
        <span className="muted text-xs">{rows.length} securities · {mode === "real" ? live.status : "MOCK"}</span>
      </DataGroup>
      <TableRegion><table className="data-table"><thead><tr><th>Security</th><th>Last</th><th>Net change</th><th>Change %</th><th>Market cap</th><th>P/E</th><th>Volume</th><th>5D trend</th></tr></thead><tbody>
        {rows.map((quote) => {
          const positive = (quote.change ?? 0) >= 0;
          return <tr key={quote.symbol}><td className="min-w-[220px]"><Link href={`/research/${quote.symbol}`} className="flex items-baseline gap-3"><strong className="ticker text-[.9375rem] text-[var(--text)]">{quote.symbol}</strong><span className="muted text-xs">{quote.name ?? "—"}</span></Link></td><td className="text-[.9375rem] font-medium">{show(quote.price, formatCurrency)}</td><td className={positive ? "positive" : "negative"}>{show(quote.change, formatCurrency)}</td><td className={positive ? "positive" : "negative"}>{show(quote.changePercent, formatPercent)}</td><td>{show(quote.marketCap, (value) => `$${value.toLocaleString()}B`)}</td><td>{show(quote.pe, (value) => `${value.toFixed(1)}x`)}</td><td>{show(quote.volume, (value) => `${value.toFixed(1)}M`)}</td><td><Sparkline data={quote.spark} positive={positive}/></td></tr>;
        })}
      </tbody></table>{rows.length === 0 && <div className="muted p-10 text-center">No securities match “{query}”.</div>}</TableRegion>
    </OpenSection>
  </div>;
}
