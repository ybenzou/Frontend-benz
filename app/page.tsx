import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { marketRepository } from "@/lib/market-data";
import { formatCurrency, formatPercent } from "@/lib/market-utils";
import { Sparkline } from "@/components/charts";

export default function Overview() {
  const overview = marketRepository.getOverview();
  return <div className="page-grid pb-16 md:pb-0">
    <h1 className="sr-only">Market overview</h1>
    <section className="index-grid panel overflow-hidden">
      {overview.indices.map((item, index) => <div key={item.symbol} className={`min-h-[112px] border-b border-r border-[var(--line-subtle)] p-4 ${index === 0 ? "bg-[var(--surface-raised)] sm:p-5" : ""}`}>
        <div className="flex items-center justify-between"><span className="muted text-[.75rem]">{item.name}</span><span className="eyebrow">{item.symbol}</span></div>
        <div className={`tnum mt-3 font-semibold tracking-[-.02em] ${index === 0 ? "text-[1.75rem]" : "text-[1.5rem]"}`}>{item.value}</div>
        <div className={`tnum mt-1 text-[.75rem] ${item.change >= 0 ? "positive" : "negative"}`}>{formatPercent(item.change)} <span className="font-sans tracking-normal text-[var(--muted)]">session</span></div>
      </div>)}
    </section>
    <div className="overview-grid">
      <section className="overview-primary panel overflow-hidden">
        <div className="panel-header"><div><span className="section-label">Core watchlist</span><span className="muted ml-2 text-xs">Decision set</span></div><Link href="/watchlist" className="accent-link flex items-center gap-1 text-xs">Open full list <ArrowRight size={13}/></Link></div>
        <div className="overflow-x-auto"><table className="data-table tnum"><thead><tr><th>Symbol</th><th>Last</th><th>Change</th><th>Volume</th><th>1D trend</th></tr></thead><tbody>
          {overview.watchlist.map((q) => <tr key={q.symbol}><td><Link href={`/research/${q.symbol}`}><strong>{q.symbol}</strong><span className="muted ml-2 text-xs">{q.name}</span></Link></td><td>{formatCurrency(q.price)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatPercent(q.changePercent)}</td><td>{q.volume.toFixed(1)}M</td><td><Sparkline data={q.spark} positive={q.change >= 0}/></td></tr>)}
        </tbody></table></div>
      </section>
      <section className="overview-secondary panel">
        <div className="panel-header"><span className="section-label">Sector breadth</span><span className="eyebrow">1D performance</span></div>
        <div className="grid grid-cols-2">
          {overview.sectors.map(([name, change]) => <div key={name} className="border-b border-r border-[var(--line-subtle)] p-3"><div className="muted text-[.75rem]">{name}</div><div className={`tnum mt-1.5 font-medium ${change >= 0 ? "positive" : "negative"}`}>{formatPercent(change)}</div><div className={`sector-bar mt-2 h-[2px] ${change >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}><span style={{ width: `${Math.min(Math.abs(change) * 55, 100)}%` }}/></div></div>)}
        </div>
      </section>
      <section className="overview-secondary panel">
        <div className="panel-header"><span className="section-label">Session events</span><CalendarClock size={15} className="muted"/></div>
        <div>{overview.events.map((event) => <div key={event.time} className="grid grid-cols-[42px_45px_1fr] items-start gap-2 border-b border-[var(--line-subtle)] px-3 py-2.5 last:border-0"><span className="tnum muted text-[.6875rem]">{event.time}</span><span className="eyebrow text-[var(--accent)]">{event.tag}</span><div><div className="text-xs font-medium">{event.title}</div><div className="muted mt-0.5 line-clamp-1 text-[.6875rem]">{event.detail}</div></div></div>)}</div>
      </section>
    </div>
  </div>;
}
