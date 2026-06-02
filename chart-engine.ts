import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  LineStyle,
  IPriceLine,
} from "lightweight-charts";

/**
 * EloTrades Chart Engine
 * Powers the backtest replay system with dual-chart layout,
 * virtual order price lines, and real-time candle updates.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OrderLines {
  entry: IPriceLine | null;
  sl: IPriceLine;
  tp: IPriceLine;
  limit?: IPriceLine;
}

/**
 * Creates a themed candlestick chart
 */
export function createTradingChart(container: HTMLDivElement): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height: 420,
    layout: {
      background: { color: "#ffffff" },
      textColor: "#666",
      fontSize: 11,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        width: 1,
        color: "#7C3AED",
        style: LineStyle.Solid,
        labelVisible: true,
        labelBackgroundColor: "#7C3AED",
      },
      horzLine: {
        width: 1,
        color: "#7C3AED",
        style: LineStyle.Solid,
        labelVisible: true,
        labelBackgroundColor: "#7C3AED",
      },
    },
    timeScale: {
      borderColor: "#e5e5e5",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: "#e5e5e5",
      scaleMargins: { top: 0.05, bottom: 0.05 },
      autoScale: true,
    },
    handleScroll: true,
    handleScale: true,
  });
}

/**
 * Draws Entry, SL, TP price lines on the chart
 * Used during virtual trade placement in backtest mode
 */
export function drawOrderLines(
  series: ISeriesApi<"Candlestick", Time>,
  trade: {
    entry: number;
    sl: number;
    tp: number;
    limitPrice?: number;
  }
): OrderLines {
  const entryLine = series.createPriceLine({
    price: trade.entry,
    color: "rgba(255,200,0,0.4)",
    lineWidth: 1,
    lineStyle: LineStyle.Dotted,
    axisLabelVisible: false,
    title: "",
  });

  const slLine = series.createPriceLine({
    price: trade.sl,
    color: "#ef5350",
    lineWidth: 2,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
    title: "SL",
  });

  const tpLine = series.createPriceLine({
    price: trade.tp,
    color: "#26a69a",
    lineWidth: 2,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
    title: "TP",
  });

  let limitLine: IPriceLine | undefined;
  if (trade.limitPrice != null) {
    limitLine = series.createPriceLine({
      price: trade.limitPrice,
      color: "#6366f1",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "Limit",
    });
  }

  return { entry: entryLine, sl: slLine, tp: tpLine, limit: limitLine };
}

/**
 * Aggregates M1 candles into any higher timeframe
 * Enables multi-timeframe analysis from a single data source
 */
export function aggregateCandles(
  candles: Candle[],
  cursorIndex: number,
  timeframeSec: number
): Candle[] {
  const buckets: Record<number, Candle & { complete: boolean }> = {};
  const limit = Math.min(cursorIndex + 1, candles.length);

  for (let i = 0; i < limit; i++) {
    const c = candles[i];
    const key = Math.floor(c.time / timeframeSec) * timeframeSec;

    if (!buckets[key]) {
      buckets[key] = { ...c, time: key, complete: false };
    } else {
      buckets[key].high  = Math.max(buckets[key].high, c.high);
      buckets[key].low   = Math.min(buckets[key].low, c.low);
      buckets[key].close = c.close;
    }
  }

  const sorted = Object.values(buckets).sort((a, b) => a.time - b.time);
  sorted.forEach((c, i) => { c.complete = i < sorted.length - 1; });
  return sorted;
}

/**
 * Candlestick color scheme
 */
export const CANDLE_STYLE = {
  upColor:        "#26a69a",
  downColor:      "#ef5350",
  borderUpColor:  "#26a69a",
  borderDownColor:"#ef5350",
  wickUpColor:    "#26a69a",
  wickDownColor:  "#ef5350",
};
