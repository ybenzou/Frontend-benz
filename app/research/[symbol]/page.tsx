import { Bell, Plus, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { FinancialChart, PriceChart } from "@/components/charts";
import { marketRepository } from "@/lib/market-data";
import { formatCurrency, formatPercent } from "@/lib/market-utils";

export default async function ResearchPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const research = marketRepository.getResearch(symbol.toUpperCase());
  if (!research) notFound();
  const { quote, metrics, history, financials, events } = research;
  const metricRows = [
    ["Market cap", `$${quote.marketCap.toLocaleString()}B`],
    ["Enterprise value", `$${metrics.enterpriseValue.toLocaleString()}B`],
    ["P/E (TTM)", `${quote.pe.toFixed(1)}x`],
    ["EV / EBITDA", `${metrics.evEbitda.toFixed(1)}x`],
    ["Dividend yield", `${metrics.dividendYield.toFixed(2)}%`],
    ["Beta (5Y)", metrics.beta.toFixed(2)],
    ["52W range", `${formatCurrency(metrics.low52Week)} — ${formatCurrency(metrics.high52Week)}`],
    ["Avg. volume", `${quote.volume.toFixed(1)}M`],
  ];
  const changeClass = quote.change >= 0 ? "positive" : "negative";
  return <div className="page-grid pb-16 md:pb-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="grid size-10 place-items-center bg-white font-bold text-black">{quote.symbol.slice(0, 1)}</div><div><div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{quote.name}</h1><span className="eyebrow border border-[#394451] px-1.5 py-0.5">NASDAQ</span></div><div className="muted mt-1 text-xs">{quote.symbol} · USD · Mock data</div></div></div>
      <div className="flex gap-2"><button disabled title="Price alerts are unavailable in this demo" aria-label="Price alerts unavailable in demo" className="control"><Bell size={15}/></button><button disabled title="Sharing is unavailable in this demo" aria-label="Sharing unavailable in demo" className="control"><Share2 size={15}/></button><button disabled title="Adding symbols is unavailable in this demo" aria-label="Add to watchlist unavailable in demo" className="control flex items-center gap-2"><Plus size={14}/> Watchlist</button></div>
    </div>
    <section className="panel">
      <div className="flex flex-wrap items-end gap-5 border-b border-[#26303c] p-4"><span className="tnum text-3xl font-semibold">{formatCurrency(quote.price)}</span><span className={`tnum pb-1 ${changeClass}`}>{formatCurrency(quote.change)} · {formatPercent(quote.changePercent)}</span><span className="muted ml-auto pb-1 text-xs">Mock snapshot · Jul 21, 2026</span></div>
      <div className="flex gap-5 border-b border-[#26303c] px-4 py-2 text-xs"><strong className="border-b-2 border-[#4e8cff] py-1 text-white">Price</strong>{["Financials", "Estimates", "Valuation", "Ownership"].map((x) => <button disabled title={`${x} tab is unavailable in this demo`} className="muted py-1" key={x}>{x}</button>)}</div>
      <PriceChart data={history}/>
    </section>
    <div className="desktop-grid grid grid-cols-[1fr_1fr] gap-3">
      <section className="panel"><div className="panel-header"><span className="font-semibold">Key metrics</span><span className="eyebrow">Mock TTM</span></div><div className="grid grid-cols-2">{metricRows.map(([label, value]) => <div key={label} className="border-b border-r border-[#202a35] p-3"><div className="muted text-xs">{label}</div><div className="tnum mt-1 font-medium">{value}</div></div>)}</div></section>
      <section className="panel"><div className="panel-header"><span className="font-semibold">Financial trend</span><span className="muted text-xs">Revenue / Net income · $B</span></div><div className="p-3"><FinancialChart data={financials}/></div></section>
    </div>
    <section className="panel"><div className="panel-header"><span className="font-semibold">Company events</span><span className="muted text-xs">Mock schedule</span></div><div className="divide-y divide-[#202a35]">{events.map((event) => <div className="flex gap-5 px-4 py-3" key={event.title}><span className="eyebrow w-14 text-[#76a7ff]">{event.tag}</span><div><strong>{event.title}</strong><div className="muted mt-1 text-xs">{event.time} · {event.detail}</div></div></div>)}</div></section>
  </div>;
}
