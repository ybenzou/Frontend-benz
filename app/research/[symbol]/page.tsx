import { Bell, Plus, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { FinancialChart, PriceChart } from "@/components/charts";
import { SimulatedQuote } from "@/components/simulated-quote";
import { marketRepository } from "@/lib/market-data";
import { formatCurrency } from "@/lib/market-utils";

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
  return <div className="page-grid pb-16 md:pb-0">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">Equity research / NASDAQ / {quote.symbol}</p><div className="mt-1 flex items-baseline gap-3"><h1 className="page-title">{quote.name}</h1><span className="ticker text-sm font-medium text-[var(--accent)]">{quote.symbol}</span></div></div>
      <div className="flex gap-2"><button disabled title="Price alerts are unavailable in this demo" aria-label="Price alerts unavailable in demo" className="control"><Bell size={15}/></button><button disabled title="Sharing is unavailable in this demo" aria-label="Sharing unavailable in demo" className="control"><Share2 size={15}/></button><button disabled title="Adding symbols is unavailable in this demo" aria-label="Add to watchlist unavailable in demo" className="control flex items-center gap-2"><Plus size={14}/> Watchlist</button></div>
    </div>
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-5 bg-[var(--surface-raised)] px-5 py-5 sm:px-6">
        <SimulatedQuote price={quote.price} previousClose={quote.price - quote.change} />
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-right">
          <div><span className="eyebrow block">Currency</span><strong className="ticker mt-1 block text-xs">USD</strong></div>
          <div><span className="eyebrow block">Venue</span><strong className="ticker mt-1 block text-xs">XNAS</strong></div>
          <div><span className="eyebrow block">As of</span><strong className="ticker mt-1 block text-xs">10:42 ET</strong></div>
        </div>
      </div>
      <div className="flex gap-6 border-y border-[var(--line-subtle)] px-5 py-2 text-xs"><strong className="border-b-2 border-[var(--accent)] py-1 text-[var(--text)]">Price</strong>{["Financials", "Estimates", "Valuation", "Ownership"].map((x) => <button disabled title={`${x} tab is unavailable in this demo`} aria-label={`${x} tab unavailable in demo`} className="muted py-1" key={x}>{x}</button>)}</div>
      <PriceChart data={history}/>
    </section>
    <div className="desktop-grid grid grid-cols-[minmax(320px,5fr)_minmax(0,7fr)] gap-[14px]">
      <section className="panel"><div className="panel-header"><span className="section-label">Key metrics</span><span className="eyebrow">Mock TTM</span></div><div className="grid grid-cols-2">{metricRows.map(([label, value]) => <div key={label} className="border-b border-r border-[var(--line-subtle)] p-3"><div className="muted text-[11px]">{label}</div><div className="tnum mt-1.5 font-medium">{value}</div></div>)}</div></section>
      <section className="panel"><div className="panel-header"><span className="section-label">Financial trend</span><span className="muted text-xs">Revenue / Net income · $B</span></div><div className="p-3"><FinancialChart data={financials}/></div></section>
    </div>
    <section className="panel"><div className="panel-header"><span className="section-label">Company events</span><span className="muted text-xs">Mock schedule</span></div><div>{events.map((event) => <div className="flex gap-5 border-b border-[var(--line-subtle)] px-4 py-3 last:border-0" key={event.title}><span className="eyebrow w-14 text-[var(--accent)]">{event.tag}</span><div><strong>{event.title}</strong><div className="muted mt-1 text-xs">{event.time} · {event.detail}</div></div></div>)}</div></section>
  </div>;
}
