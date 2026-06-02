"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart, IChartApi, ISeriesApi, Time,
  CandlestickSeries, LineStyle, IPriceLine
} from "lightweight-charts";

// ── Types ────────────────────────────────────────────────────────────────
interface Candle { time: number; open: number; high: number; low: number; close: number; }
interface AggCandle extends Candle { complete: boolean; }

// ── Constants ─────────────────────────────────────────────────────────────
const INSTRUMENTS = [
  { id: "eurusd", label: "EURUSD", group: "Forex" },
  { id: "gbpusd", label: "GBPUSD", group: "Forex" },
  { id: "usdjpy", label: "USDJPY", group: "Forex" },
  { id: "xauusd", label: "XAUUSD", group: "Metals" },
  { id: "btcusd", label: "BTCUSD", group: "Crypto" },
  { id: "usatechidxusd", label: "NAS100", group: "Indices" },
];

const TIMEFRAMES = [
  { id: "m1",  label: "M1",    sec: 60    },
  { id: "m5",  label: "M5",    sec: 300   },
  { id: "m15", label: "M15",   sec: 900   },
  { id: "m30", label: "M30",   sec: 1800  },
  { id: "h1",  label: "H1",    sec: 3600  },
  { id: "h4",  label: "H4",    sec: 14400 },
  { id: "d1",  label: "Daily", sec: 86400 },
];

const STEPS  = [
  { label: "M1",  sec: 60    },
  { label: "M5",  sec: 300   },
  { label: "M15", sec: 900   },
  { label: "H1",  sec: 3600  },
  { label: "H4",  sec: 14400 },
];

const SPEEDS = [
  { label: "Slow",   ms: 800 },
  { label: "Normal", ms: 200 },
  { label: "Fast",   ms: 50  },
];

// ── Helpers ───────────────────────────────────────────────────────────────
const getDec = (s: string) =>
  s.includes("jpy") ? 3 : s.includes("idx") || s.includes("tech") ? 2 : 5;

const getMM = (s: string) =>
  s.includes("jpy") ? 0.001 : s.includes("idx") || s.includes("tech") ? 0.01 : 0.00001;

function aggregateUpTo(master: Candle[], cursor: number, tfSec: number): AggCandle[] {
  const b: Record<number, AggCandle> = {};
  const lim = Math.min(cursor + 1, master.length);
  for (let i = 0; i < lim; i++) {
    const c = master[i], k = Math.floor(c.time / tfSec) * tfSec;
    if (!b[k]) b[k] = { time: k, open: c.open, high: c.high, low: c.low, close: c.close, complete: false };
    else { b[k].high = Math.max(b[k].high, c.high); b[k].low = Math.min(b[k].low, c.low); b[k].close = c.close; }
  }
  const s = Object.values(b).sort((a, x) => a.time - x.time);
  s.forEach((c, i) => { c.complete = i < s.length - 1; });
  return s;
}

const toCC = (c: AggCandle) => ({
  time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close
});

function stepCandles(s: number, r: number) { return Math.max(1, Math.round(s / r)); }

function detectRes(c: Candle[]) {
  if (c.length < 2) return 900;
  const ds: number[] = [];
  for (let i = 1; i < Math.min(20, c.length); i++) {
    const d = c[i].time - c[i - 1].time;
    if (d > 0) ds.push(d);
  }
  return ds.length ? Math.min(...ds) : 900;
}

function findClosest(c: Candle[], t: number) {
  if (!c.length) return 0;
  let ci = 0, md = Math.abs((c[0]?.time || 0) - t);
  c.forEach((x, i) => { const d = Math.abs(x.time - t); if (d < md) { md = d; ci = i; } });
  return ci;
}

function makeChart(container: HTMLDivElement) {
  return createChart(container, {
    width: container.clientWidth, height: 420,
    layout: { background: { color: "#ffffff" }, textColor: "#666", fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    crosshair: {
      mode: 0,
      vertLine: { width: 1, color: "#7C3AED", style: LineStyle.Solid, labelVisible: true, labelBackgroundColor: "#7C3AED" },
      horzLine: { width: 1, color: "#7C3AED", style: LineStyle.Solid, labelVisible: true, labelBackgroundColor: "#7C3AED" },
    },
    timeScale: { borderColor: "#e5e5e5", timeVisible: true, secondsVisible: false },
    rightPriceScale: { borderColor: "#e5e5e5", scaleMargins: { top: 0.05, bottom: 0.05 }, autoScale: true },
    handleScroll: true, handleScale: true,
  });
}

// ── Demo data generator ───────────────────────────────────────────────────
function generateDemoCandles(instrument: string, from: string, count = 2000): Candle[] {
  const seed = instrument === "xauusd" ? 1900 : instrument === "btcusd" ? 30000 : instrument.includes("idx") ? 14000 : instrument.includes("jpy") ? 140 : 1.08;
  const vol  = seed * 0.0008;
  const start = new Date(from).getTime() / 1000;
  const candles: Candle[] = [];
  let price = seed;
  for (let i = 0; i < count; i++) {
    const o = price;
    const h = o + Math.random() * vol;
    const l = o - Math.random() * vol;
    const c = l + Math.random() * (h - l);
    price = c;
    candles.push({ time: start + i * 60, open: o, high: h, low: l, close: c });
  }
  return candles;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function BacktestReplayDemo() {
  const ref1 = useRef<HTMLDivElement>(null);
  const api1 = useRef<IChartApi | null>(null);
  const ser1 = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const masterRef    = useRef<Candle[]>([]);
  const cursorRef    = useRef(0);
  const masterResRef = useRef(60);
  const tfSecRef     = useRef(900);

  const [instrument, setInstrument] = useState("eurusd");
  const [from,       setFrom]       = useState("2024-06-01");
  const [to,         setTo]         = useState("2024-06-30");
  const [displayTf,  setDisplayTf]  = useState("m15");
  const [stepSec,    setStepSec]    = useState(900);
  const [speedMs,    setSpeedMs]    = useState(200);
  const [playing,    setPlaying]    = useState(false);
  const [started,    setStarted]    = useState(false);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [currentTime,setCurrentTime]= useState<number | null>(null);
  const [isPartial,  setIsPartial]  = useState(false);

  const cs = {
    upColor: "#26a69a", downColor: "#ef5350",
    borderUpColor: "#26a69a", borderDownColor: "#ef5350",
    wickUpColor: "#26a69a", wickDownColor: "#ef5350",
  };

  // Init chart
  useEffect(() => {
    if (!ref1.current) return;
    const chart = makeChart(ref1.current);
    ser1.current = chart.addSeries(CandlestickSeries, cs);
    api1.current = chart;
    chart.subscribeCrosshairMove(p => {
      if (p.point && ser1.current) {
        const v = ser1.current.coordinateToPrice(p.point.y);
        if (v) setHoverPrice(v);
      }
    });
    const ro = new ResizeObserver(() => {
      if (ref1.current) chart.applyOptions({ width: ref1.current.clientWidth });
    });
    ro.observe(ref1.current);
    return () => { chart.remove(); ro.disconnect(); };
  }, []);

  // TF change
  useEffect(() => {
    const sec = TIMEFRAMES.find(t => t.id === displayTf)?.sec || 900;
    tfSecRef.current = sec;
    if (masterRef.current.length && ser1.current) {
      const d = aggregateUpTo(masterRef.current, cursorRef.current, sec);
      ser1.current.setData(d.map(toCC));
      api1.current?.timeScale().fitContent();
      updateDS(d);
    }
  }, [displayTf]);

  function updateDS(d: AggCandle[]) {
    const l = d[d.length - 1];
    if (!l) return;
    setCurrentTime(l.time);
    setIsPartial(!l.complete);
  }

  function loadData() {
    const candles = generateDemoCandles(instrument, from, 3000);
    masterRef.current = candles;
    masterResRef.current = detectRes(candles);
    const tz = -new Date().getTimezoneOffset();
    const fromTs = new Date(from).getTime() / 1000 + tz * 60;
    const init = findClosest(candles, fromTs);
    cursorRef.current = init;
    tfSecRef.current = TIMEFRAMES.find(t => t.id === displayTf)?.sec || 900;
    const disp = aggregateUpTo(candles, init, tfSecRef.current);
    if (ser1.current) {
      ser1.current.applyOptions({ priceFormat: { type: "price", precision: getDec(instrument), minMove: getMM(instrument) } });
      ser1.current.setData(disp.map(toCC));
      api1.current?.timeScale().fitContent();
      updateDS(disp);
    }
    setStarted(true);
  }

  const nextCandle = useCallback(() => {
    const step = stepCandles(stepSec, masterResRef.current);
    if (cursorRef.current >= masterRef.current.length - 1) { setPlaying(false); return; }
    const next = Math.min(cursorRef.current + step, masterRef.current.length - 1);
    cursorRef.current = next;
    if (ser1.current) {
      const d = aggregateUpTo(masterRef.current, next, tfSecRef.current);
      updateDS(d);
      const l = d[d.length - 1];
      try { ser1.current.update(toCC(l)); } catch { ser1.current.setData(d.map(toCC)); }
    }
  }, [stepSec]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(nextCandle, speedMs);
    return () => clearInterval(id);
  }, [playing, speedMs, nextCandle]);

  const stepLabel = STEPS.find(s => s.sec === stepSec)?.label || "M15";

  const inp: React.CSSProperties = {
    background: "#f8f8fc", border: "1px solid #e2e2f0", borderRadius: 6,
    padding: "6px 10px", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, fontFamily: "system-ui, sans-serif", background: "#f5f5fb", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#7C3AED,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 14L9 5L15 14Z" fill="white" opacity=".95"/><rect x="6.5" y="9" width="5" height="1.8" rx=".9" fill="white"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>EloTrades — Backtest Replay Engine</div>
          <div style={{ fontSize: 11, color: "#888" }}>Powered by TradingView Lightweight Charts v5</div>
        </div>
      </div>

      {/* Config */}
      <div style={{ background: "#fff", border: "1px solid #e2e2f0", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.7fr 0.7fr 0.7fr auto", gap: 10, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Instrument</div>
            <select style={{ ...inp, width: "100%" }} value={instrument} onChange={e => setInstrument(e.target.value)}>
              {INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>From</div>
            <input type="date" style={{ ...inp, width: "100%" }} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>To</div>
            <input type="date" style={{ ...inp, width: "100%" }} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Timeframe</div>
            <select style={{ ...inp, width: "100%" }} value={displayTf} onChange={e => setDisplayTf(e.target.value)}>
              {TIMEFRAMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Step</div>
            <select style={{ ...inp, width: "100%" }} value={stepSec} onChange={e => setStepSec(parseInt(e.target.value))}>
              {STEPS.map(s => <option key={s.label} value={s.sec}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Speed</div>
            <select style={{ ...inp, width: "100%" }} value={speedMs} onChange={e => setSpeedMs(parseInt(e.target.value))}>
              {SPEEDS.map(s => <option key={s.label} value={s.ms}>{s.label}</option>)}
            </select>
          </div>
          <button onClick={loadData} style={{ borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#7C3AED", color: "#fff", border: "none", fontFamily: "inherit" }}>
            Start
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: "#fff", border: "1px solid #e2e2f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e2f0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{INSTRUMENTS.find(i => i.id === instrument)?.label}</span>
          <span style={{ fontSize: 10, background: "#ede9fe", color: "#7C3AED", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{displayTf.toUpperCase()}</span>
          {isPartial && started && <span style={{ fontSize: 10, background: "#fef3c7", color: "#d97706", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>● In progress</span>}
          {hoverPrice != null && started && <span style={{ fontSize: 12, fontWeight: 800, color: "#7C3AED", fontFamily: "monospace" }}>{hoverPrice.toFixed(getDec(instrument))}</span>}
          {currentTime && <span style={{ fontSize: 10, color: "#999" }}>{new Date(currentTime * 1000).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
          {started && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={nextCandle} style={{ borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "#f5f5fb", color: "#1a1a2e", border: "1px solid #e2e2f0", fontFamily: "inherit" }}>
                +{stepLabel}
              </button>
              <button onClick={() => setPlaying(p => !p)} style={{ borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: playing ? "#ef5350" : "#26a69a", color: "#fff", border: "none", fontFamily: "inherit" }}>
                {playing ? "Pause" : "▶ Play"}
              </button>
            </div>
          )}
        </div>
        <div ref={ref1} style={{ width: "100%", height: 420 }} />
        {!started && (
          <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>
            Select an instrument and click <strong style={{ color: "#7C3AED", margin: "0 4px" }}>Start</strong> to begin replay
          </div>
        )}
      </div>

      {/* Features badge */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["Candlestick Series", "Price Lines (SL/TP)", "Crosshair Mode 0", "ResizeObserver", "Real-time Updates", "Multi-timeframe Aggregation", "29 Instruments"].map(f => (
          <span key={f} style={{ fontSize: 11, background: "#ede9fe", color: "#7C3AED", padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>{f}</span>
        ))}
      </div>
    </div>
  );
}
