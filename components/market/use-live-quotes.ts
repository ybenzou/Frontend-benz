"use client";

import { useEffect, useRef, useState } from "react";
import type { RealQuote } from "@/lib/market/contracts";
import {
  createLiveQuoteController,
  type LiveQuoteState,
} from "@/lib/market/live-quotes";

type UseLiveQuotesOptions = {
  initial: RealQuote[];
  symbols: string[];
  enabled: boolean;
};

function initialState({
  initial,
  enabled,
}: Pick<UseLiveQuotesOptions, "initial" | "enabled">): LiveQuoteState {
  return {
    quotes: Object.fromEntries(initial.map((quote) => [quote.symbol, quote])),
    status: enabled ? "CONNECTING" : "MOCK",
  };
}

export function useLiveQuotes(options: UseLiveQuotesOptions) {
  const { enabled, initial, symbols } = options;
  const [state, setState] = useState(() => initialState(options));
  const buffer = useRef(new Map<string, RealQuote>());

  useEffect(() => {
    const controller = createLiveQuoteController({
      enabled,
      initial,
      symbols,
      buffer: buffer.current,
    });
    setState(controller.getState());
    const unsubscribe = controller.subscribe(setState);
    controller.start();
    return () => {
      unsubscribe();
      controller.stop();
    };
  }, [enabled, initial, symbols]);

  return state;
}
