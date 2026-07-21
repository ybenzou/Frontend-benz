import { ArrowDownToLine, Plus } from "lucide-react";
import { marketRepository } from "@/lib/market-data";
import { derivePortfolioSummary, formatCurrency, formatPercent } from "@/lib/market-utils";

const allocationColors: Record<string, string> = {
  Technology: "#6daeb8",
  Financials: "#8795aa",
  Healthcare: "#56b894",
  Cash: "#78858e",
};

export default function PortfolioPage() {
  const portfolio = marketRepository.getPortfolio();
  const summary = derivePortfolioSummary(portfolio.holdings);
  const cards = [
    ["Net value", formatCurrency(summary.netValue), `Mock snapshot · ${portfolio.snapshotDate}`],
    ["Day gain", formatCurrency(summary.dayGain), formatPercent(summary.dayReturn)],
    ["Total return", formatCurrency(summary.totalGain), formatPercent(summary.totalReturn)],
    ["Cash balance", formatCurrency(summary.cashBalance), `${summary.cashWeight.toFixed(2)}% of portfolio`],
  ];
  return <div className="page-grid pb-16 md:pb-0">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Portfolio / Mock account</p><h1 className="page-title">Portfolio</h1></div><div className="flex gap-2"><button disabled title="Portfolio import is unavailable in this demo" aria-label="Portfolio import unavailable in demo" className="control flex items-center gap-2"><ArrowDownToLine size={14}/> Import</button><button disabled title="Transactions are unavailable in this demo" aria-label="Add transaction unavailable in demo" className="control flex items-center gap-2"><Plus size={14}/> Transaction</button></div></div>
    <section className="panel grid overflow-hidden sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
      {cards.map(([label,value,detail], i) => <div className={`border-b border-r border-[var(--line-subtle)] p-4 ${i === 0 ? "bg-[var(--surface-raised)]" : ""}`} key={label}><div className="eyebrow">{label}</div><div className={`tnum mt-3 text-[24px] font-semibold ${i === 1 ? summary.dayGain >= 0 ? "positive" : "negative" : i === 2 ? summary.totalGain >= 0 ? "positive" : "negative" : ""}`}>{value}</div><div className="muted tnum mt-1 text-xs">{detail}</div></div>)}
    </section>
    <div className="desktop-grid grid grid-cols-[minmax(0,1.6fr)_minmax(280px,.6fr)] gap-3">
      <section className="panel overflow-hidden"><div className="panel-header"><span className="section-label">Holdings</span><span className="muted text-xs">{summary.positions.length} positions</span></div><div className="overflow-x-auto"><table className="data-table tnum"><thead><tr><th>Symbol</th><th>Shares</th><th>Avg. cost</th><th>Last</th><th>Market value</th><th>Return</th><th>Weight</th></tr></thead><tbody>
        {summary.positions.map((h) => <tr key={h.symbol}><td><strong>{h.symbol}</strong></td><td>{h.symbol === "CASH" ? "—" : h.shares}</td><td>{formatCurrency(h.avg)}</td><td>{formatCurrency(h.price)}</td><td>{formatCurrency(h.marketValue)}</td><td className={h.returnPercent >= 0 ? "positive" : "negative"}>{h.symbol === "CASH" ? "—" : formatPercent(h.returnPercent)}</td><td>{h.weight.toFixed(1)}%</td></tr>)}
      </tbody></table></div></section>
      <div className="page-grid">
        <section className="panel"><div className="panel-header"><span className="section-label">Allocation</span><span className="eyebrow">Derived sector</span></div><div className="p-4"><div className="mb-5 flex h-2 overflow-hidden rounded-[2px]" role="img" aria-label={summary.allocations.map((item) => `${item.sector} ${item.weight.toFixed(1)}%`).join(", ")}>{summary.allocations.map((item) => <div title={item.sector} key={item.sector} style={{ width: `${item.weight}%`, background: allocationColors[item.sector] ?? "#78858e" }}/>)}</div><div className="space-y-3">{summary.allocations.map((item) => <div className="flex items-center" key={item.sector}><span className="mr-2 size-2" style={{ background: allocationColors[item.sector] ?? "#78858e" }}/><span className="muted flex-1">{item.sector}</span><strong className="tnum">{item.weight.toFixed(1)}%</strong></div>)}</div></div></section>
        <section className="panel"><div className="panel-header"><span className="section-label">Recent activity</span><span className="eyebrow">Mock</span></div><div>{portfolio.events.map((event) => <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] p-3 last:border-0" key={event.title}><span className="eyebrow w-8 text-[var(--accent)]">{event.tag}</span><span className="flex-1 text-xs">{event.title}</span><span className="muted tnum text-xs">{event.time.slice(5)}</span></div>)}</div></section>
      </div>
    </div>
  </div>;
}
