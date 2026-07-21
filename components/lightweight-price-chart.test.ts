import { AreaSeries } from "lightweight-charts";
import { describe, expect, it, vi } from "vitest";

type PriceHistoryPoint = {
  date: string;
  price: number;
  volume?: number;
};

async function normalize(data: PriceHistoryPoint[]) {
  const chartModule = await import("./lightweight-price-chart");
  return chartModule.normalizePriceSeries(data);
}

type SeriesPoint = { time: string; value: number };
type ChartColors = {
  surface: string;
  grid: string;
  text: string;
  accent: string;
  border: string;
};
type ResizeTarget = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};
type Controller = {
  update: (data: SeriesPoint[]) => void;
  dispose: () => void;
};
type MountOptions = {
  container: HTMLElement;
  data: SeriesPoint[];
  createChartFactory: (container: HTMLElement, options?: unknown) => unknown;
  colors?: ChartColors;
  getComputedStyleFactory?: (element: HTMLElement) => {
    getPropertyValue: (property: string) => string;
  };
  resizeObserverAvailable?: boolean;
  resizeTarget?: ResizeTarget;
};

async function loadController() {
  const chartModule = await import("./lightweight-price-chart");
  return chartModule as typeof chartModule & {
    TRADINGVIEW_NOTICE?: string;
    mountPriceChart?: (options: MountOptions) => Controller;
  };
}

function createFakeChart() {
  const series = { setData: vi.fn() };
  const timeScale = { fitContent: vi.fn() };
  const chart = {
    addSeries: vi.fn(() => series),
    timeScale: vi.fn(() => timeScale),
    resize: vi.fn(),
    remove: vi.fn(),
  };
  const createChartFactory = vi.fn(() => chart);

  return { chart, createChartFactory, series, timeScale };
}

const colors: ChartColors = {
  surface: "#101820",
  grid: "#202c36",
  text: "#91a0aa",
  accent: "#62b5c1",
  border: "#30404b",
};

describe("normalizePriceSeries", () => {
  it("sorts price points by trading date", async () => {
    await expect(normalize([
      { date: "2026-07-21", price: 202 },
      { date: "2026-07-18", price: 198 },
      { date: "2026-07-20", price: 200 },
    ])).resolves.toEqual([
      { time: "2026-07-18", value: 198 },
      { time: "2026-07-20", value: 200 },
      { time: "2026-07-21", value: 202 },
    ]);
  });

  it("keeps the latest value for a duplicate trading date", async () => {
    await expect(normalize([
      { date: "2026-07-21", price: 200 },
      { date: "2026-07-21", price: 201.5 },
    ])).resolves.toEqual([
      { time: "2026-07-21", value: 201.5 },
    ]);
  });

  it("drops invalid dates", async () => {
    await expect(normalize([
      { date: "not-a-date", price: 100 },
      { date: "2026-02-30", price: 101 },
      { date: "07/21/2026", price: 102 },
      { date: "2026-07-21", price: 103 },
    ])).resolves.toEqual([
      { time: "2026-07-21", value: 103 },
    ]);
  });

  it("drops non-finite prices", async () => {
    await expect(normalize([
      { date: "2026-07-19", price: Number.NaN },
      { date: "2026-07-20", price: Number.POSITIVE_INFINITY },
      { date: "2026-07-21", price: 204 },
    ])).resolves.toEqual([
      { time: "2026-07-21", value: 204 },
    ]);
  });
});

describe("mountPriceChart", () => {
  it("creates an auto-sized AreaSeries with CSS-derived colors and fits initial data", async () => {
    const { mountPriceChart } = await loadController();
    const fake = createFakeChart();
    const data = [{ time: "2026-07-21", value: 204 }];
    const cssVariables = new Map([
      ["--surface-raised", colors.surface],
      ["--line-subtle", colors.grid],
      ["--muted", colors.text],
      ["--accent", colors.accent],
      ["--line", colors.border],
    ]);

    expect(mountPriceChart).toBeTypeOf("function");
    mountPriceChart!({
      container: {} as HTMLElement,
      data,
      createChartFactory: fake.createChartFactory,
      getComputedStyleFactory: vi.fn(() => ({
        getPropertyValue: (property: string) => cssVariables.get(property) ?? "",
      })),
      resizeObserverAvailable: true,
    });

    expect(fake.createChartFactory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        autoSize: true,
        layout: expect.objectContaining({
          background: expect.objectContaining({ color: colors.surface }),
          textColor: colors.text,
        }),
        grid: {
          vertLines: { color: colors.grid },
          horzLines: { color: colors.grid },
        },
        rightPriceScale: expect.objectContaining({ borderColor: colors.border }),
      }),
    );
    expect(fake.chart.addSeries).toHaveBeenCalledWith(
      AreaSeries,
      expect.objectContaining({ lineColor: colors.accent }),
    );
    expect(fake.series.setData).toHaveBeenCalledWith(data);
    expect(fake.timeScale.fitContent).toHaveBeenCalledTimes(1);
  });

  it("updates changed data without resetting zoom for the same data reference", async () => {
    const { mountPriceChart } = await loadController();
    const fake = createFakeChart();
    const initial = [{ time: "2026-07-20", value: 200 }];
    const updated = [{ time: "2026-07-21", value: 204 }];
    const controller = mountPriceChart!({
      container: {} as HTMLElement,
      data: initial,
      createChartFactory: fake.createChartFactory,
      colors,
      resizeObserverAvailable: true,
    });

    controller.update(initial);
    controller.update(updated);

    expect(fake.series.setData).toHaveBeenCalledTimes(2);
    expect(fake.series.setData).toHaveBeenLastCalledWith(updated);
    expect(fake.timeScale.fitContent).toHaveBeenCalledTimes(1);
  });

  it("clears the series when data becomes empty", async () => {
    const { mountPriceChart } = await loadController();
    const fake = createFakeChart();
    const controller = mountPriceChart!({
      container: {} as HTMLElement,
      data: [{ time: "2026-07-21", value: 204 }],
      createChartFactory: fake.createChartFactory,
      colors,
      resizeObserverAvailable: true,
    });

    controller.update([]);

    expect(fake.series.setData).toHaveBeenLastCalledWith([]);
  });

  it("disposes idempotently and remounts with a fresh chart", async () => {
    const { mountPriceChart } = await loadController();
    const first = createFakeChart();
    const second = createFakeChart();
    const createChartFactory = vi.fn()
      .mockReturnValueOnce(first.chart)
      .mockReturnValueOnce(second.chart);
    const options = {
      container: {} as HTMLElement,
      data: [] as SeriesPoint[],
      createChartFactory,
      colors,
      resizeObserverAvailable: true,
    };

    const firstController = mountPriceChart!(options);
    firstController.dispose();
    firstController.dispose();
    const secondController = mountPriceChart!(options);
    secondController.dispose();

    expect(createChartFactory).toHaveBeenCalledTimes(2);
    expect(first.chart.remove).toHaveBeenCalledTimes(1);
    expect(second.chart.remove).toHaveBeenCalledTimes(1);
  });

  it("uses and cleans a window resize fallback without ResizeObserver", async () => {
    const { mountPriceChart } = await loadController();
    const fake = createFakeChart();
    const listeners = new Map<string, () => void>();
    const resizeTarget: ResizeTarget = {
      addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type, listener) => {
        if (listeners.get(type) === listener) listeners.delete(type);
      }),
    };
    const container = { clientWidth: 720, clientHeight: 330 } as HTMLElement;
    const controller = mountPriceChart!({
      container,
      data: [],
      createChartFactory: fake.createChartFactory,
      colors,
      resizeObserverAvailable: false,
      resizeTarget,
    });

    listeners.get("resize")?.();
    expect(fake.chart.resize).toHaveBeenCalledWith(720, 330);

    controller.dispose();
    expect(resizeTarget.removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(listeners.has("resize")).toBe(false);
  });
});

describe("TradingView notice", () => {
  it("contains the complete required copyright notice", async () => {
    const { TRADINGVIEW_NOTICE } = await loadController();

    expect(TRADINGVIEW_NOTICE).toBe(
      "TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc.",
    );
  });
});
