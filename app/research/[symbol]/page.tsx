import { Bell, Plus, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { FinancialChart } from "@/components/charts";
import { LightweightPriceChart } from "@/components/lightweight-price-chart";
import { RealQuoteDisplay } from "@/components/market/real-quote-display";
import {
  DataGroup,
  EmphasisSurface,
  OpenSection,
  SectionHeader,
  SegmentedRule,
} from "@/components/layout/terminal-surfaces";
import { MarketDataUnavailableError } from "@/lib/market/cache.server";
import { getMarketServerRepository } from "@/lib/market/repository.server";
import { formatCurrency } from "@/lib/market-utils";

export const dynamic = "force-dynamic";

function displayNumber(value: number | null, format: (number: number) => string) {
  return value === null ? "—" : format(value);
}

export default async function ResearchPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let research;
  try {
    research = await getMarketServerRepository().getResearch(symbol.toUpperCase());
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) {
      console.error(`Research page failed for ${symbol}`, error);
    }
    return <div className="page-grid"><OpenSection className="p-6"><h1 className="text-lg font-semibold">Research data unavailable</h1><p className="muted mt-2 text-sm">Alpaca or SEC data could not be loaded from the provider or cache. Mock research was not substituted.</p></OpenSection></div>;
  }
  if (!research) notFound();
  const { quote, metrics, history, financials, events, source, eventSource } = research;
  const metricRows = [
    ["Market cap", displayNumber(quote.marketCap, (value) => `$${value.toLocaleString()}B`)],
    ["Enterprise value", displayNumber(metrics.enterpriseValue, (value) => `$${value.toLocaleString()}B`)],
    ["P/E (TTM)", displayNumber(quote.pe, (value) => `${value.toFixed(1)}x`)],
    ["EV / EBITDA", displayNumber(metrics.evEbitda, (value) => `${value.toFixed(1)}x`)],
    ["Dividend yield", displayNumber(metrics.dividendYield, (value) => `${value.toFixed(2)}%`)],
    ["Beta (5Y)", displayNumber(metrics.beta, (value) => value.toFixed(2))],
    ["52W range", metrics.low52Week === null || metrics.high52Week === null ? "—" : `${formatCurrency(metrics.low52Week)} — ${formatCurrency(metrics.high52Week)}`],
    ["Volume", displayNumber(quote.volume, (value) => `${value.toFixed(1)}M`)],
  ];
  return <div className="page-grid pb-16 md:pb-0">
    <h1 className="sr-only">{quote.name ?? quote.symbol} research</h1>
    <EmphasisSurface>
      <SectionHeader className="flex-wrap px-4 py-2" title={<span className="flex flex-wrap items-baseline gap-2">{quote.name ?? quote.symbol}<span className="ticker text-xs font-medium text-[var(--accent)]">{quote.symbol}</span></span>} meta={`${source.toUpperCase()} · Equity research`} actions={<div className="flex gap-2"><button disabled title="Price alerts are unavailable in this demo" aria-label="Price alerts unavailable in demo" className="control"><Bell size={15}/></button><button disabled title="Sharing is unavailable in this demo" aria-label="Sharing unavailable in demo" className="control"><Share2 size={15}/></button><button disabled title="Adding symbols is unavailable in this demo" aria-label="Add to watchlist unavailable in demo" className="control flex items-center gap-2"><Plus size={14}/> Watchlist</button></div>} />
      <SegmentedRule />
      <div className="flex flex-wrap items-end justify-between gap-5 bg-[var(--surface-raised)] px-5 py-5 sm:px-6">
        <RealQuoteDisplay quote={quote} mode={source === "mock" ? "mock" : "real"} />
      </div>
      <div className="flex gap-6 border-y border-[var(--line-subtle)] px-5 py-2 text-xs"><strong className="border-b-2 border-[var(--accent)] py-1 text-[var(--text)]">Price</strong>{["Financials", "Estimates", "Valuation", "Ownership"].map((x) => <button disabled title={`${x} tab is unavailable in this demo`} aria-label={`${x} tab unavailable in demo`} className="muted py-1" key={x}>{x}</button>)}</div>
      <LightweightPriceChart data={history}/>
    </EmphasisSurface>
    <div className="desktop-grid grid grid-cols-[minmax(320px,5fr)_minmax(0,7fr)] gap-[14px]">
      <OpenSection><SectionHeader title="Key metrics" actions={<span className="eyebrow">{source === "mock" ? "MOCK TTM" : "ALPACA + SEC"}</span>} /><SegmentedRule /><DataGroup className="data-grid data-grid--2">{metricRows.map(([label, value]) => <div key={label} className="p-3"><div className="muted text-[.6875rem]">{label}</div><div className="tnum mt-1.5 font-medium">{value}</div></div>)}</DataGroup></OpenSection>
      <OpenSection><SectionHeader title="Financial trend" actions={<span className="muted text-xs">SEC annual revenue / net income · $B</span>} /><SegmentedRule align="end" /><DataGroup className="px-3">{financials.length ? <FinancialChart data={financials}/> : <div className="muted p-6 text-sm">Reliable annual SEC financials unavailable.</div>}</DataGroup></OpenSection>
    </div>
    <OpenSection><SectionHeader title="Company events" actions={<span className="muted text-xs">{eventSource.toUpperCase()} source</span>} /><SegmentedRule /><DataGroup>{events.length ? events.map((event) => <div className="flex gap-5 border-b border-[var(--line-subtle)] px-4 py-3 last:border-0" key={event.title}><span className="eyebrow w-14 text-[var(--accent)]">{event.tag}</span><div><strong>{event.title}</strong><div className="muted mt-1 text-xs">{event.time} · {event.detail}</div></div></div>) : <div className="muted p-4 text-sm">No static company events available.</div>}</DataGroup></OpenSection>
  </div>;
}
