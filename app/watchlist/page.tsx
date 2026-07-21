"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts";
import { marketRepository } from "@/lib/market-data";
import { formatCurrency, formatPercent } from "@/lib/market-utils";

export default function WatchlistPage() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => marketRepository.getQuotes().filter((q) => `${q.symbol} ${q.name}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div className="page-grid pb-16 md:pb-0">
    <h1 className="sr-only">Watchlist</h1>
    <div className="panel overflow-hidden">
      <div className="flex min-h-[3rem] flex-wrap items-center gap-3 border-b border-[var(--line-subtle)] px-3 py-2 sm:px-4">
        <div className="flex min-w-[240px] max-w-xl flex-1 items-center gap-2"><Search size={15} className="muted"/><input aria-label="Filter watchlist by symbol or company" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm" placeholder="Filter watchlist by symbol or company"/></div>
        <span className="muted text-xs">{rows.length} securities · mock snapshot</span>
        <div className="ml-auto flex gap-2"><button disabled title="Column customization is unavailable in this demo" aria-label="Column customization unavailable in demo" className="control flex items-center gap-2"><SlidersHorizontal size={14}/> Columns</button><button disabled title="Adding symbols is unavailable in this demo" aria-label="Add symbol unavailable in demo" className="control">+ Add symbol</button></div>
      </div>
      <div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Security</th><th>Last</th><th>Net change</th><th>Change %</th><th>Market cap</th><th>P/E</th><th>Volume</th><th>5D trend</th></tr></thead><tbody>
        {rows.map((q) => <tr key={q.symbol}><td className="min-w-[220px]"><Link href={`/research/${q.symbol}`} className="flex items-baseline gap-3"><strong className="ticker text-[.9375rem] text-[var(--text)]">{q.symbol}</strong><span className="muted text-xs">{q.name}</span></Link></td><td className="text-[.9375rem] font-medium">{formatCurrency(q.price)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatCurrency(q.change)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatPercent(q.changePercent)}</td><td>${q.marketCap.toLocaleString()}B</td><td>{q.pe.toFixed(1)}x</td><td>{q.volume.toFixed(1)}M</td><td><Sparkline data={q.spark} positive={q.change >= 0}/></td></tr>)}
      </tbody></table>{rows.length === 0 && <div className="muted p-10 text-center">No securities match “{query}”.</div>}</div>
    </div>
  </div>;
}
