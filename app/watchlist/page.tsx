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
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Lists / Core holdings · Mock snapshot</p><h1 className="mt-1 text-xl font-semibold">Watchlist</h1></div><div className="flex gap-2"><button disabled title="Column customization is unavailable in this demo" aria-label="Column customization unavailable in demo" className="control flex items-center gap-2"><SlidersHorizontal size={14}/> Columns</button><button disabled title="Adding symbols is unavailable in this demo" aria-label="Add symbol unavailable in demo" className="control">+ Add symbol</button></div></div>
    <div className="panel overflow-hidden">
      <div className="panel-header"><div className="flex w-full max-w-sm items-center gap-2"><Search size={15} className="muted"/><input aria-label="Filter watchlist by symbol or company" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm" placeholder="Filter by symbol or company"/></div><span className="muted text-xs">{rows.length} securities</span></div>
      <div className="overflow-x-auto"><table className="data-table tnum"><thead><tr><th>Symbol</th><th>Last</th><th>Change</th><th>Change %</th><th>Market cap</th><th>P/E</th><th>Volume</th><th>5D trend</th></tr></thead><tbody>
        {rows.map((q) => <tr key={q.symbol}><td><Link href={`/research/${q.symbol}`}><strong>{q.symbol}</strong><span className="muted ml-3 text-xs">{q.name}</span></Link></td><td>{formatCurrency(q.price)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatCurrency(q.change)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatPercent(q.changePercent)}</td><td>${q.marketCap.toLocaleString()}B</td><td>{q.pe.toFixed(1)}x</td><td>{q.volume.toFixed(1)}M</td><td><Sparkline data={q.spark} positive={q.change >= 0}/></td></tr>)}
      </tbody></table>{rows.length === 0 && <div className="muted p-10 text-center">No securities match “{query}”.</div>}</div>
    </div>
  </div>;
}
