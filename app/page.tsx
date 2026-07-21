import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { marketRepository } from "@/lib/market-data";
import { formatCurrency, formatPercent } from "@/lib/market-utils";
import { Sparkline } from "@/components/charts";

export default function Overview() {
  const overview = marketRepository.getOverview();
  return <div className="page-grid pb-16 md:pb-0">
    <div className="flex items-end justify-between">
      <div><p className="eyebrow">Mock snapshot · {overview.snapshotDate}</p><h1 className="mt-1 text-xl font-semibold">Market overview</h1></div>
      <span className="muted text-xs">Demonstration data · Not real-time · USD</span>
    </div>
    <section className="grid grid-cols-2 border-l border-t border-[#26303c] lg:grid-cols-4">
      {overview.indices.map((item) => <div key={item.symbol} className="border-b border-r border-[#26303c] bg-[#10151d] p-4">
        <div className="flex justify-between"><span className="muted text-xs">{item.name}</span><span className="eyebrow">{item.symbol}</span></div>
        <div className="tnum mt-3 text-lg font-semibold">{item.value}</div><div className={`tnum mt-1 text-xs ${item.change >= 0 ? "positive" : "negative"}`}>{formatPercent(item.change)} today</div>
      </div>)}
    </section>
    <div className="desktop-grid grid grid-cols-[minmax(0,1.6fr)_minmax(300px,.8fr)] gap-3">
      <section className="panel overflow-hidden">
        <div className="panel-header"><div><span className="font-semibold">Watchlist</span><span className="muted ml-2 text-xs">Core holdings</span></div><Link href="/watchlist" className="flex items-center gap-1 text-xs text-[#76a7ff]">View all <ArrowRight size={13}/></Link></div>
        <div className="overflow-x-auto"><table className="data-table tnum"><thead><tr><th>Symbol</th><th>Last</th><th>Change</th><th>Volume</th><th>1D trend</th></tr></thead><tbody>
          {overview.watchlist.map((q) => <tr key={q.symbol}><td><Link href={`/research/${q.symbol}`}><strong>{q.symbol}</strong><span className="muted ml-2 text-xs">{q.name}</span></Link></td><td>{formatCurrency(q.price)}</td><td className={q.change >= 0 ? "positive" : "negative"}>{formatPercent(q.changePercent)}</td><td>{q.volume.toFixed(1)}M</td><td><Sparkline data={q.spark} positive={q.change >= 0}/></td></tr>)}
        </tbody></table></div>
      </section>
      <section className="panel">
        <div className="panel-header"><span className="font-semibold">Market pulse</span><span className="eyebrow">Sectors</span></div>
        <div className="grid grid-cols-2 gap-px bg-[#26303c]">
          {overview.sectors.map(([name, change]) => <div key={name} className="bg-[#10151d] p-3"><div className="muted text-xs">{name}</div><div className={`tnum mt-2 font-semibold ${change >= 0 ? "positive" : "negative"}`}>{formatPercent(change)}</div><div className="mt-2 h-1 bg-[#222c37]"><div className={`h-full ${change >= 0 ? "bg-[#38c98b]" : "bg-[#f26b6b]"}`} style={{ width: `${Math.min(Math.abs(change) * 55, 100)}%` }}/></div></div>)}
        </div>
      </section>
    </div>
    <section className="panel">
      <div className="panel-header"><span className="font-semibold">Snapshot events</span><CalendarClock size={16} className="muted"/></div>
      <div className="divide-y divide-[#202a35]">{overview.events.map((event) => <div key={event.time} className="grid grid-cols-[48px_58px_1fr] items-start gap-3 px-4 py-3"><span className="tnum muted text-xs">{event.time}</span><span className="eyebrow text-[#76a7ff]">{event.tag}</span><div><div className="text-sm font-medium">{event.title}</div><div className="muted mt-1 text-xs">{event.detail}</div></div></div>)}</div>
    </section>
  </div>;
}
