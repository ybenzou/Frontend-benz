"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/market-utils";

const OFFSETS = [0, 0.08, -0.04, 0.13, 0.03, -0.07, 0.06] as const;

export function SimulatedQuote({
  price,
  previousClose,
}: {
  price: number;
  previousClose: number;
}) {
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const currentPrice = +(price + OFFSETS[step]).toFixed(2);
  const previousStep = (step - 1 + OFFSETS.length) % OFFSETS.length;
  const direction = OFFSETS[step] >= OFFSETS[previousStep] ? "up" : "down";
  const change = currentPrice - previousClose;
  const changePercent = (change / previousClose) * 100;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStep((value) => (value + 1) % OFFSETS.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div aria-label="Simulated quote">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-[var(--warning)]" />
        <span className="eyebrow text-[var(--warning)]">Simulated quote · deterministic mock</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div className="quote-value-slot">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={currentPrice}
              initial={reduceMotion ? false : { y: direction === "up" ? 22 : -22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { y: direction === "up" ? -8 : 8, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
              className="tnum text-[clamp(2.875rem,6vw,3.25rem)] font-semibold leading-[1.08] tracking-[-.04em]"
            >
              {formatCurrency(currentPrice)}
            </motion.span>
          </AnimatePresence>
        </div>
        <motion.span
          key={`change-${step}`}
          initial={reduceMotion ? false : { backgroundColor: direction === "up" ? "var(--positive-dim)" : "var(--negative-dim)" }}
          animate={{ backgroundColor: "rgba(0,0,0,0)" }}
          transition={{ duration: reduceMotion ? 0 : 0.75 }}
          className={`tnum mb-1 rounded-[4px] px-2 py-1 text-sm ${change >= 0 ? "positive" : "negative"}`}
        >
          {formatCurrency(change)} · {formatPercent(changePercent)}
        </motion.span>
      </div>
    </div>
  );
}
