"use client";

import Link from "next/link";
import { RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { marketRepository } from "@/lib/market-data";
import { filterScreener, formatCurrency, formatPercent } from "@/lib/market-utils";

export default function ScreenerPage() {
  const [sector, setSector] = useState("All sectors");
  const [cap, setCap] = useState(0);
  const [maxPe, setMaxPe] = useState(80);
  const rows = useMemo(() => filterScreener(marketRepository.getQuotes(), { sector, minMarketCap: cap, maxPe }), [sector, cap, maxPe]);
  return <div className="page-grid pb-16 md:pb-0">
    <div className="flex items-end justify-between"><div><p className="eyebrow">Equity tools · Mock universe</p><h1 className="page-title">Stock screener</h1></div><button disabled title="Saving screens is unavailable in this demo" aria-label="Save screen unavailable in demo" className="control flex items-center gap-2"><Save size={14}/> Save screen</button></div>
    <section className="panel">
      <div className="panel-header"><span className="section-label">Criteria</span><button onClick={() => { setSector("All sectors"); setCap(0); setMaxPe(80); }} className="muted flex items-center gap-1 text-xs hover:text-[var(--text)]"><RotateCcw size={13}/> Reset</button></div>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        <label><span className="eyebrow mb-2 block">Sector</span><select value={sector} onChange={(e) => setSector(e.target.value)} className="control w-full"><option>All sectors</option><option>Technology</option><option>Consumer</option><option>Financials</option><option>Healthcare</option><option>Energy</option></select></label>
        <label><span className="eyebrow mb-2 block">Minimum market cap</span><select value={cap} onChange={(e) => setCap(Number(e.target.value))} className="control w-full"><option value="0">Any size</option><option value="300">$300B+</option><option value="1000">$1T+</option><option value="3000">$3T+</option></select></label>
        <label><span className="eyebrow mb-2 flex justify-between">Maximum P/E <b className="tnum text-[var(--text)]">{maxPe}x</b></span><input className="w-full accent-[var(--accent)]" type="range" min="10" max="80" value={maxPe} onChange={(e) => setMaxPe(Number(e.target.value))}/></label>
      </div>
    </section>
    <section className="panel overflow-hidden"><div className="panel-header"><span className="section-label">Results</span><span className="muted text-xs">{rows.length} companies · sorted by market cap</span></div><div className="overflow-x-auto"><table className="data-table tnum"><thead><tr><th>Company</th><th>Sector</th><th>Price</th><th>1D</th><th>Market cap</th><th>P/E</th><th>Volume</th></tr></thead><tbody>
      {rows.sort((a,b) => b.marketCap-a.marketCap).map((q) => <tr key={q.symbol}><td><Link href={`/research/${q.symbol}`}><strong>{q.symbol}</strong><span className="muted ml-3 text-xs">{q.name}</span></Link></td><td>{q.sector}</td><td>{formatCurrency(q.price)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatPercent(q.changePercent)}</td><td>${q.marketCap.toLocaleString()}B</td><td>{q.pe.toFixed(1)}x</td><td>{q.volume.toFixed(1)}M</td></tr>)}
    </tbody></table></div></section>
  </div>;
}
