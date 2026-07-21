"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const ITEMS = [
  { symbol: "SPX", value: 5982.47, change: 0.41 },
  { symbol: "NDX", value: 21113.12, change: 0.68 },
  { symbol: "DJI", value: 43287.03, change: -0.09 },
  { symbol: "RUT", value: 2318.44, change: -0.32 },
] as const;

const TICKS = [0, 0.07, -0.03, 0.11, 0.04, -0.06] as const;

export function SimulatedTape() {
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const activeIndex = step % ITEMS.length;

  useEffect(() => {
    const interval = window.setInterval(
      () => setStep((value) => (value + 1) % (TICKS.length * ITEMS.length)),
      2800,
    );
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="market-tape ticker flex h-8 items-center border-t border-[var(--line-subtle)] bg-[var(--surface)] text-[.6875rem]"
      role="region"
      tabIndex={0}
      aria-label="Simulated market tape"
    >
      <span className="h-full shrink-0 border-r border-[var(--line)] px-3 py-2 font-sans font-semibold tracking-[.1em] text-[var(--muted)]">
        MARKET TAPE · MOCK
      </span>
      <div className="market-tape-track">
        {ITEMS.map((item, index) => {
          const tick = index === activeIndex ? TICKS[step % TICKS.length] : 0;
          const value = item.value + tick;
          const tickDirection = tick > 0 ? "positive" : tick < 0 ? "negative" : undefined;

          return (
            <motion.div
              key={item.symbol}
              animate={
                index === activeIndex && tick !== 0 && !reduceMotion
                  ? { backgroundColor: tick > 0 ? "var(--positive-dim)" : "var(--negative-dim)" }
                  : { backgroundColor: "rgba(0,0,0,0)" }
              }
              transition={{ duration: 0.3, repeat: 1, repeatType: "reverse" }}
              className="flex h-full min-w-max items-center justify-center gap-2 border-r border-[var(--line-subtle)] px-4"
            >
              <strong className="text-[var(--text-soft)]">{item.symbol}</strong>
              <motion.span
                key={value}
                initial={reduceMotion || tick === 0 ? false : { y: tick > 0 ? 5 : -5, opacity: 0.35 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={index === activeIndex ? tickDirection : undefined}
              >
                {value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.span>
              <span className={item.change >= 0 ? "positive" : "negative"}>
                {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
