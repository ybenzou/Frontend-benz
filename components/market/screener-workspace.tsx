"use client";

import Link from "next/link";
import { RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DataGroup,
  EmphasisSurface,
  OpenSection,
  SectionHeader,
  SegmentedRule,
  TableRegion,
} from "@/components/layout/terminal-surfaces";
import { useLiveQuotes } from "@/components/market/use-live-quotes";
import type { Quote, RealQuote } from "@/lib/market/contracts";
import { mergeQuoteRows } from "@/lib/market/live-quotes";
import { filterScreener, formatCurrency, formatPercent } from "@/lib/market-utils";

type Props = {
  initial: (Quote | RealQuote)[];
  mode: "mock" | "real";
};

function show(value: number | null, format: (value: number) => string) {
  return value === null ? "—" : format(value);
}

export function ScreenerWorkspace({ initial, mode }: Props) {
  const [sector, setSector] = useState("All sectors");
  const [cap, setCap] = useState(0);
  const [maxPe, setMaxPe] = useState(80);
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
  const rows = filterScreener(quotes, {
    sector,
    minMarketCap: cap,
    maxPe,
  }).toSorted(
    (left, right) =>
      (right.marketCap ?? Number.NEGATIVE_INFINITY) -
      (left.marketCap ?? Number.NEGATIVE_INFINITY),
  );
  const dataStatus = mode === "real" ? live.status : "MOCK";

  return <div className="page-grid pb-16 md:pb-0">
    <h1 className="sr-only">Stock screener</h1>
    <OpenSection>
      <SectionHeader className="flex-wrap py-2" title="Equity screener" meta={dataStatus} actions={<div className="flex items-center gap-3"><button onClick={() => { setSector("All sectors"); setCap(0); setMaxPe(80); }} className="muted flex items-center gap-1 text-xs hover:text-[var(--text)]"><RotateCcw size={13}/> Reset</button><button disabled title="Saving screens is unavailable in this demo" aria-label="Save screen unavailable in demo" className="control flex items-center gap-2"><Save size={14}/> Save screen</button></div>} />
      <SegmentedRule />
      <DataGroup className="grid gap-4 py-4 sm:grid-cols-3">
        <label><span className="eyebrow mb-2 block">Sector</span><select value={sector} onChange={(event) => setSector(event.target.value)} className="control w-full"><option>All sectors</option><option>Technology</option><option>Consumer Discretionary</option><option>Consumer Staples</option><option>Financials</option><option>Health Care</option><option>Energy</option></select></label>
        <label><span className="eyebrow mb-2 block">Minimum market cap</span><select value={cap} onChange={(event) => setCap(Number(event.target.value))} className="control w-full"><option value="0">Any size</option><option value="300">$300B+</option><option value="1000">$1T+</option><option value="3000">$3T+</option></select></label>
        <label><span className="eyebrow mb-2 flex justify-between">Maximum P/E <b className="tnum text-[var(--text)]">{maxPe}x</b></span><input className="w-full accent-[var(--accent)]" type="range" min="10" max="80" value={maxPe} onChange={(event) => setMaxPe(Number(event.target.value))}/></label>
      </DataGroup>
    </OpenSection>
    <EmphasisSurface><SectionHeader className="px-4" title="Results" actions={<span className="muted text-xs">{rows.length} companies · market cap order · {dataStatus}</span>} /><SegmentedRule /><TableRegion><table className="data-table tnum"><thead><tr><th>Company</th><th>Sector</th><th>Price</th><th>1D</th><th>Market cap</th><th>P/E</th><th>Volume</th></tr></thead><tbody>
      {rows.map((quote) => <tr key={quote.symbol}><td><Link href={`/research/${quote.symbol}`}><strong>{quote.symbol}</strong><span className="muted ml-3 text-xs">{quote.name ?? "—"}</span></Link></td><td>{quote.sector ?? "—"}</td><td>{show(quote.price, formatCurrency)}</td><td className={(quote.change ?? 0) >= 0 ? "positive" : "negative"}>{show(quote.changePercent, formatPercent)}</td><td>{show(quote.marketCap, (value) => `$${value.toLocaleString()}B`)}</td><td>{show(quote.pe, (value) => `${value.toFixed(1)}x`)}</td><td>{show(quote.volume, (value) => `${value.toFixed(1)}M`)}</td></tr>)}
    </tbody></table></TableRegion></EmphasisSurface>
  </div>;
}
