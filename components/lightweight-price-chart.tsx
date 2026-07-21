"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type ChartOptions,
  type DeepPartial,
  type IChartApi,
  type LineData,
  type Time,
} from "lightweight-charts";

export type PriceHistoryPoint = {
  date: string;
  price: number;
  volume?: number;
};

export const TRADINGVIEW_NOTICE =
  "TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc.";

export type PriceChartColors = {
  surface: string;
  grid: string;
  text: string;
  accent: string;
  border: string;
};

type CreateChartFactory = (
  container: HTMLElement,
  options?: DeepPartial<ChartOptions>,
) => IChartApi;

type ResizeTarget = {
  addEventListener(type: "resize", listener: () => void): void;
  removeEventListener(type: "resize", listener: () => void): void;
};

type ComputedStyleFactory = (element: HTMLElement) => {
  getPropertyValue(property: string): string;
};

export type PriceChartController = {
  update(data: LineData<Time>[]): void;
  dispose(): void;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizePriceSeries(data: PriceHistoryPoint[]): LineData<Time>[] {
  const pointsByDate = new Map<string, number>();

  for (const point of data) {
    if (isValidIsoDate(point.date) && Number.isFinite(point.price)) {
      pointsByDate.set(point.date, point.price);
    }
  }

  return [...pointsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([time, value]) => ({ time: time as Time, value }));
}

function cssColor(
  styles: ReturnType<ComputedStyleFactory>,
  property: string,
  fallback: string,
) {
  return styles.getPropertyValue(property).trim() || fallback;
}

function readPriceChartColors(
  container: HTMLElement,
  getComputedStyleFactory: ComputedStyleFactory,
): PriceChartColors {
  const styles = getComputedStyleFactory(container);
  return {
    surface: cssColor(styles, "--surface-raised", "#121920"),
    grid: cssColor(styles, "--line-subtle", "#192129"),
    text: cssColor(styles, "--muted", "#78858e"),
    accent: cssColor(styles, "--accent", "#6daeb8"),
    border: cssColor(styles, "--line", "#222c35"),
  };
}

export function mountPriceChart(options: {
  container: HTMLElement;
  data: LineData<Time>[];
  createChartFactory?: CreateChartFactory;
  getComputedStyleFactory?: ComputedStyleFactory;
  colors?: PriceChartColors;
  resizeObserverAvailable?: boolean;
  resizeTarget?: ResizeTarget;
}): PriceChartController {
  const {
    container,
    data,
    createChartFactory = createChart,
    resizeObserverAvailable = typeof ResizeObserver !== "undefined",
    resizeTarget = typeof window === "undefined" ? undefined : window,
  } = options;
  const colors = options.colors ?? readPriceChartColors(
    container,
    options.getComputedStyleFactory ?? getComputedStyle,
  );
  const { surface, grid, text, accent, border } = colors;
  const chart = createChartFactory(container, {
    autoSize: true,
    ...(!resizeObserverAvailable
      ? { width: container.clientWidth, height: container.clientHeight }
      : {}),
    layout: {
      background: { type: ColorType.Solid, color: surface },
      textColor: text,
      fontFamily: '"IBM Plex Mono", monospace',
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: grid },
      horzLines: { color: grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: accent, labelBackgroundColor: accent },
      horzLine: { color: accent, labelBackgroundColor: accent },
    },
    rightPriceScale: {
      borderColor: border,
      scaleMargins: { top: 0.12, bottom: 0.12 },
    },
    timeScale: {
      borderColor: border,
      timeVisible: false,
      secondsVisible: false,
      rightOffset: 1,
      barSpacing: 8,
      minBarSpacing: 3,
    },
    localization: {
      priceFormatter: (price: number) => price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
  });
  const series = chart.addSeries(AreaSeries, {
    lineColor: accent,
    topColor: `color-mix(in srgb, ${accent} 28%, transparent)`,
    bottomColor: `color-mix(in srgb, ${accent} 2%, transparent)`,
    lineWidth: 2,
    priceLineColor: accent,
    crosshairMarkerBackgroundColor: accent,
    crosshairMarkerBorderColor: surface,
  });
  let currentData = data;
  let disposed = false;

  series.setData(data);
  if (data.length > 0) chart.timeScale().fitContent();

  const handleResize = () => {
    chart.resize(container.clientWidth, container.clientHeight);
  };
  if (!resizeObserverAvailable && resizeTarget) {
    resizeTarget.addEventListener("resize", handleResize);
  }

  return {
    update(nextData) {
      if (disposed || nextData === currentData) return;
      currentData = nextData;
      series.setData(nextData);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!resizeObserverAvailable && resizeTarget) {
        resizeTarget.removeEventListener("resize", handleResize);
      }
      chart.remove();
    },
  };
}

export function LightweightPriceChart({ data }: { data: PriceHistoryPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<PriceChartController | null>(null);
  const normalizedData = useMemo(() => normalizePriceSeries(data), [data]);
  const latestPrice = normalizedData.at(-1)?.value;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = mountPriceChart({
      container,
      data: normalizedData,
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
    // Mounting is intentionally independent of data updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controllerRef.current?.update(normalizedData);
  }, [normalizedData]);

  const summary = latestPrice === undefined
    ? "Price history chart has no valid data"
    : `Price history chart ending at ${latestPrice.toFixed(2)}`;

  return (
    <div className="min-w-0 overflow-hidden bg-[var(--surface-raised)]">
      <div
        ref={containerRef}
        className="relative min-h-[330px] w-full"
        role="img"
        aria-label={summary}
      >
        {normalizedData.length === 0 ? (
          <div
            className="muted pointer-events-none absolute inset-0 z-10 grid place-items-center px-4 text-center text-sm"
            role="status"
          >
            No valid price history is available.
          </div>
        ) : null}
      </div>
      <div className="flex min-h-8 items-center justify-end border-t border-[var(--line-subtle)] px-3 py-1 text-right text-[.625rem] leading-4 text-[var(--muted)]">
        <a
          className="accent-link underline underline-offset-2"
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
        >
          {TRADINGVIEW_NOTICE}
        </a>
      </div>
    </div>
  );
}
