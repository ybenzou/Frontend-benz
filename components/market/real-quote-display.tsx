"use client";

import { useMemo } from "react";
import { useLiveQuotes } from "@/components/market/use-live-quotes";
import type { Quote, RealQuote } from "@/lib/market/contracts";
import { formatCurrency, formatPercent } from "@/lib/market-utils";

type Props = {
  quote: Quote | RealQuote;
  mode: "mock" | "real";
};

function show(value: number | null, format: (value: number) => string) {
  return value === null ? "—" : format(value);
}

export function RealQuoteDisplay({ quote, mode }: Props) {
  const initial = useMemo(
    () => (mode === "real" ? [quote as RealQuote] : []),
    [mode, quote],
  );
  const symbols = useMemo(() => [quote.symbol], [quote.symbol]);
  const live = useLiveQuotes({
    initial,
    symbols,
    enabled: mode === "real",
  });
  const current =
    mode === "real" ? (live.quotes[quote.symbol] ?? quote) : quote;
  const positive = (current.change ?? 0) >= 0;
  const asOf = "asOf" in current ? current.asOf : null;
  const stale = "stale" in current ? current.stale : false;

  return (
    <>
      <div>
        <div className="tnum text-4xl font-semibold tracking-[-.04em]">
          {show(current.price, formatCurrency)}
        </div>
        <div
          className={`tnum mt-2 text-sm ${
            positive ? "positive" : "negative"
          }`}
        >
          {show(
            current.change,
            (value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`,
          )}{" "}
          <span className="ml-2">
            {show(current.changePercent, formatPercent)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-right">
        <div>
          <span className="eyebrow block">Currency</span>
          <strong className="ticker mt-1 block text-xs">USD</strong>
        </div>
        <div>
          <span className="eyebrow block">Feed</span>
          <strong className="ticker mt-1 block text-xs">
            {mode === "real" ? live.status : "MOCK"}
          </strong>
        </div>
        <div>
          <span className="eyebrow block">As of</span>
          <strong className="ticker mt-1 block text-xs">
            {asOf ?? "—"}
            {stale ? " · STALE" : ""}
          </strong>
        </div>
      </div>
    </>
  );
}
