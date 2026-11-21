"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type BusinessDay,
} from "lightweight-charts";

type Bar = { timestamps: string; open: number; high: number; low: number; close: number; volume: number | null };
type IndicatorKey = "sma20" | "sma50" | "ema20" | "bb20";
type AlertCondition = "above" | "below";
type PriceAlert = {
  id: string;
  symbol: string;
  condition: AlertCondition;
  target: number;
  enabled: boolean;
  createdAt: number;
};

const chartRanges: Record<string, number> = { "1M": 31, "3M": 93, "6M": 186, "1Y": 366, "5Y": 1830 };
const ALERT_STORAGE = "dsa.chart.price-alerts.v1";

const format = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });

const pct = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const series = ["AAPL", "MSFT", "SPY", "QQQ", "DXY", "US10Y"];

import DataTable from "../DataTable";
import { labelText, valueText, type Calendar, type Correlation, type Metrics, type Universe } from "../feeds";
import { CurrencyContext, ImpactBadge, SymbolContext } from "../ContextBadges";
import type { MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";

const ohlcFields = ["Open","High","Low","Close","Volume","VWAP","ATR","Gap","52W Pos","Beta","IV / Vol","Rel Vol"];

function sma(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function ema(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = seed;
  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    result[index] = values[index] * multiplier + (result[index - 1] as number) * (1 - multiplier);
  }
  return result;
}

function bollinger(values: number[], period = 20, deviations = 2) {
  const mid = sma(values, period);
  const upper: Array<number | null> = Array(values.length).fill(null);
  const lower: Array<number | null> = Array(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    const slice = values.slice(index - period + 1, index + 1);
    const mean = mid[index] as number;
    const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    const deviation = Math.sqrt(variance) * deviations;
    upper[index] = mean + deviation;
    lower[index] = mean - deviation;
  }
  return { mid, upper, lower };
}

function atr(bars: Bar[], period = 14) {
  const tr = bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    const previous = bars[index - 1].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previous), Math.abs(bar.low - previous));
  });
  const result: Array<number | null> = Array(bars.length).fill(null);
  if (tr.length < period) return result;
  let average = tr.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = average;
  for (let index = period; index < tr.length; index += 1) {
    average = ((average * (period - 1)) + tr[index]) / period;
    result[index] = average;
  }
  return result;
}

function rsi(values: number[], period = 14) {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    result[index] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function lineData(bars: Bar[], values: Array<number | null>) {
  return bars.flatMap((bar, index) =>
    values[index] == null ? [] : [{ time: bar.timestamps.slice(0, 10) as unknown as BusinessDay, value: values[index] as number }]
  );
}

export default function ChartLabWorkspace({ initialSymbol = "AAPL" }: { initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [range, setRange] = useState("6M");
  const [bars, setBars] = useState<Bar[]>([]);
  const [state, setState] = useState("Loading stored bars");
  const [activeIndicators, setActiveIndicators] = useState<Record<IndicatorKey, boolean>>({
    sma20: true,
    sma50: true,
    ema20: false,
    bb20: false,
  });
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [alertCondition, setAlertCondition] = useState<AlertCondition>("above");
  const [alertTarget, setAlertTarget] = useState("");
  const canvas = useRef<HTMLDivElement>(null);

  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const stored = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const metrics = useFeed<Metrics>(`/api/v1/metrics/${encodeURIComponent(symbol)}?timeframe=daily`);
  const calendar = useFeed<Calendar>(`/api/v1/economic-calendar?symbol=${encodeURIComponent(symbol)}&limit=8`);
  const compared = [...new Set([symbol, "SPY", "QQQ", "BTC-USD"])];
  const correlation = useFeed<Correlation>(`/api/v1/correlation?symbols=${encodeURIComponent(compared.join(","))}&window=60`);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ALERT_STORAGE);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setAlerts(parsed.filter(item => item && typeof item.symbol === "string" && Number.isFinite(item.target)));
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!alertsLoaded) return;
    window.localStorage.setItem(ALERT_STORAGE, JSON.stringify(alerts));
  }, [alerts, alertsLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    const to = new Date();
    const from = new Date(to.getTime() - chartRanges[range] * 86400000);
    const dates = new URLSearchParams({ from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) });
    fetch(`/api/instruments/data-history/${encodeURIComponent(symbol)}?${dates}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("History unavailable");
        const data: Bar[] = (await response.json()).data ?? [];
        if (controller.signal.aborted) return;
        setBars(data);
        setState(data.length ? "Stored daily bars" : "No bars in this range");
      })
      .catch(() => { if (!controller.signal.aborted) setState("History unavailable"); });
    return () => controller.abort();
  }, [symbol, range]);

  const closeValues = useMemo(() => bars.map(bar => bar.close), [bars]);
  const sma20Values = useMemo(() => sma(closeValues, 20), [closeValues]);
  const sma50Values = useMemo(() => sma(closeValues, 50), [closeValues]);
  const ema20Values = useMemo(() => ema(closeValues, 20), [closeValues]);
  const bb20Values = useMemo(() => bollinger(closeValues, 20, 2), [closeValues]);
  const atr14Values = useMemo(() => atr(bars, 14), [bars]);
  const rsi14Values = useMemo(() => rsi(closeValues, 14), [closeValues]);

  const currentAlerts = useMemo(() => alerts.filter(alert => alert.symbol === symbol), [alerts, symbol]);
  const activeIndicatorCount = Object.values(activeIndicators).filter(Boolean).length;

  useEffect(() => {
    if (!canvas.current || !bars.length) return;

    const chart = createChart(canvas.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#0b1016" }, textColor: "#aab8c8" },
      grid: { vertLines: { color: "#1d2937" }, horzLines: { color: "#1d2937" } },
      rightPriceScale: { borderColor: "#2a394b" },
      timeScale: { borderColor: "#2a394b" },
      crosshair: { vertLine: { color: "#536a83" }, horzLine: { color: "#536a83" } },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#29b99a",
      downColor: "#de626d",
      borderUpColor: "#29b99a",
      borderDownColor: "#de626d",
      wickUpColor: "#29b99a",
      wickDownColor: "#de626d",
    });

    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" } });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } });

    const daily = bars.map(bar => ({ ...bar, time: bar.timestamps.slice(0, 10) as unknown as BusinessDay }));
    candle.setData(daily);
    volume.setData(daily.flatMap(bar => bar.volume == null ? [] : [{
      time: bar.time,
      value: bar.volume,
      color: bar.close >= bar.open ? "#159b82" : "#c74e5b",
    }]));

    if (activeIndicators.sma20) {
      const line = chart.addSeries(LineSeries, { color: "#6ea7e8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "SMA20" });
      line.setData(lineData(bars, sma20Values));
    }
    if (activeIndicators.sma50) {
      const line = chart.addSeries(LineSeries, { color: "#d5a65d", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "SMA50" });
      line.setData(lineData(bars, sma50Values));
    }
    if (activeIndicators.ema20) {
      const line = chart.addSeries(LineSeries, { color: "#b58bdc", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "EMA20" });
      line.setData(lineData(bars, ema20Values));
    }
    if (activeIndicators.bb20) {
      const upper = chart.addSeries(LineSeries, { color: "#6f849c", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, title: "BB20 +" });
      const lower = chart.addSeries(LineSeries, { color: "#6f849c", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, title: "BB20 -" });
      upper.setData(lineData(bars, bb20Values.upper));
      lower.setData(lineData(bars, bb20Values.lower));
    }

    currentAlerts.filter(alert => alert.enabled).forEach(alert => {
      candle.createPriceLine({
        price: alert.target,
        color: alert.condition === "above" ? "#d9aa59" : "#76aef0",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `ALERT ${alert.condition.toUpperCase()}`,
      });
    });

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, activeIndicators, currentAlerts, sma20Values, sma50Values, ema20Values, bb20Values]);

  const latest = bars.at(-1);
  const first = bars[0];
  const latestIndex = bars.length - 1;
  const values = [
    latest?.open,
    latest?.high,
    latest?.low,
    latest?.close,
    latest?.volume,
    null,
    latestIndex >= 0 ? atr14Values[latestIndex] : null,
  ];

  useEffect(() => {
    if (!latest || alertTarget) return;
    setAlertTarget(latest.close.toFixed(2));
  }, [latest, alertTarget]);

  const rangeHigh = bars.length ? Math.max(...bars.map(bar => bar.high)) : null;
  const rangeLow = bars.length ? Math.min(...bars.map(bar => bar.low)) : null;
  const totalVolume = bars.reduce((sum, bar) => sum + (bar.volume ?? 0), 0);
  const volumeBars = bars.filter(bar => bar.volume != null);
  const avgVolume = volumeBars.length ? totalVolume / volumeBars.length : null;
  const rangeReturn = first && latest && first.close ? ((latest.close / first.close) - 1) * 100 : null;
  const upSessions = bars.filter(bar => bar.close > bar.open).length;
  const downSessions = bars.filter(bar => bar.close < bar.open).length;
  const flatSessions = bars.length - upSessions - downSessions;
  const avgDailyRange = bars.length ? bars.reduce((sum, bar) => sum + ((bar.high - bar.low) / Math.max(bar.close, 1)) * 100, 0) / bars.length : null;
  const latestChange = bars.length > 1 && latest ? ((latest.close / bars[bars.length - 2].close) - 1) * 100 : null;
  const recentBars = bars.slice(-12).reverse();

  function toggleIndicator(key: IndicatorKey) {
    setActiveIndicators(current => ({ ...current, [key]: !current[key] }));
  }

  function addAlert() {
    const target = Number(alertTarget);
    if (!Number.isFinite(target) || target <= 0) return;
    setAlerts(current => [...current, {
      id: `${symbol}-${Date.now()}`,
      symbol,
      condition: alertCondition,
      target,
      enabled: true,
      createdAt: Date.now(),
    }]);
    setAlertTarget(latest?.close?.toFixed(2) ?? "");
  }

  function alertState(alert: PriceAlert) {
    if (!latest || !alert.enabled) return alert.enabled ? "ARMED" : "OFF";
    const triggered = alert.condition === "above" ? latest.close >= alert.target : latest.close <= alert.target;
    return triggered ? "TRIGGERED" : "ARMED";
  }

  return (
    <div className="nt-workspace nt-chart-workspace">
      <section className="nt-toolbar nt-chart-toolbar">
        <strong className="nt-chart-title">CHART LAB / TIME-SERIES DATABASE</strong>
        <SymbolContext symbol={symbol} />

        <label className="nt-control-group">
          <span className="nt-control-caption">Symbol</span>
          <select className="nt-control nt-control-select" value={symbol} onChange={event => {
            setBars([]);
            setState("Loading stored bars");
            setSymbol(event.target.value);
            setAlertTarget("");
          }}>
            {[...new Set([symbol, ...(universe.data?.data ?? []).map(row => row.symbol)])].map(item => <option key={item}>{item}</option>)}
          </select>
        </label>

        <div className="nt-control-group">
          <span className="nt-control-caption">Range</span>
          <div className="nt-segmented">
            {Object.keys(chartRanges).map(item => <button type="button" className="nt-tab" data-active={item === range} key={item} onClick={() => {
              if (item !== range) {
                setBars([]);
                setState("Loading stored bars");
                setRange(item);
              }
            }}>{item}</button>)}
          </div>
        </div>

        <span className="nt-control-summary"><b>1D</b><small>BARS</small></span>
        <span className="nt-control-summary"><b>{activeIndicatorCount}</b><small>INDICATORS</small></span>
        <span className="nt-control-summary"><b>{currentAlerts.filter(alert => alert.enabled).length}</b><small>ALERTS</small></span>

        <button type="button" className="nt-action nt-toolbar-action" onClick={() => {
          document.getElementById("nt-indicator-panel")?.scrollIntoView({ block: "nearest" });
        }}>Indicators</button>
        <button type="button" className="nt-action nt-toolbar-action" onClick={() => {
          document.getElementById("nt-alert-panel")?.scrollIntoView({ block: "nearest" });
        }}>Alerts</button>

        <span className="nt-chart-state nt-mono">{state}</span>
      </section>

      <div className="nt-dense-grid">
        {ohlcFields.map((key, index) => <div className="nt-data-cell" key={key}>
          <div className="k">{key}</div>
          <div className="v">{format(values[index])}</div>
          <div className="s">{index < 5 && latest ? latest.timestamps.slice(0,10) : index === 6 ? "ATR14 · Wilder" : "Awaiting source"}</div>
        </div>)}
      </div>

      <div className="nt-grid nt-grid-chart nt-chart-main-grid">
        <aside className="nt-section-stack nt-chart-rail">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Series matrix</strong><span className="nt-panel-meta">linked context</span></div>
            <table className="nt-microtable"><thead><tr><th>Series</th><th>Last</th><th>Chg</th></tr></thead><tbody>
              {series.map(item => {
                const row = stored.data?.data.find(entry => entry.symbol === item);
                return <tr key={item}><td>{item}</td><td>{format(row?.price)}</td><td>{format(row?.change_pct)}</td></tr>;
              })}
            </tbody></table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Saved context</strong><span className="nt-panel-meta">workspace</span></div>
            <table className="nt-microtable"><tbody>
              <tr><td>Watchlist</td><td>Mega Cap</td></tr>
              <tr><td>Screener</td><td>Current filter</td></tr>
              <tr><td>Template</td><td>Price + Vol</td></tr>
              <tr><td>Normalize</td><td>Absolute</td></tr>
            </tbody></table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Correlation</strong><span className="nt-panel-meta">selected series</span></div>
            <table className="nt-microtable"><tbody>{(correlation.data?.symbols ?? compared).map((item,index) => {
              const value = correlation.data?.data[0]?.[index];
              return <tr key={item}><td>{item}</td><td title={value?.reason ?? undefined}>{value?.value == null ? value?.quality ?? "—" : valueText(value.value)}</td></tr>;
            })}</tbody></table>
          </section>
        </aside>

        <section className="nt-section-stack nt-chart-center">
          <section className="nt-panel nt-chart-primary-panel">
            <div className="nt-panel-title">
              <div>
                <strong>{symbol} · Price / Volume</strong>
                <div className="nt-panel-meta">{range} · 1D · USD · Pi market history · {activeIndicatorCount} overlays · {currentAlerts.filter(alert => alert.enabled).length} alerts</div>
              </div>
              <span className="nt-warning nt-mono">{state}</span>
            </div>
            <div className="nt-panel-body"><div ref={canvas} aria-label={`${symbol} daily price and volume chart`} /></div>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>OHLC / indicator records</strong><span className="nt-panel-meta">selected visible range</span></div>
            <div className="nt-table-wrap"><table className="nt-table">
              <thead><tr>{["Time","Open","High","Low","Close","Volume","VWAP","SMA20","SMA50","RSI14","ATR14","Source"].map(item => <th key={item}>{item}</th>)}</tr></thead>
              <tbody>{bars.slice(-8).reverse().map(bar => {
                const index = bars.indexOf(bar);
                return <tr key={bar.timestamps}>
                  <td>{bar.timestamps.slice(0,10)}</td>
                  {[bar.open,bar.high,bar.low,bar.close,bar.volume].map((value,itemIndex) => <td className="nt-mono" key={itemIndex}>{format(value)}</td>)}
                  <td>—</td>
                  <td>{format(sma20Values[index])}</td>
                  <td>{format(sma50Values[index])}</td>
                  <td>{format(rsi14Values[index])}</td>
                  <td>{format(atr14Values[index])}</td>
                  <td>Stored OHLCV</td>
                </tr>;
              })}</tbody>
            </table></div>
          </section>

          <div className="nt-chart-fill-grid">
            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Range statistics</strong><span className="nt-panel-meta">{range} observed bars</span></div>
              <table className="nt-microtable"><tbody>
                <tr><td>Bars</td><td>{bars.length || "—"}</td><td>Daily</td></tr>
                <tr><td>Range return</td><td className={rangeReturn != null && rangeReturn >= 0 ? "nt-positive" : "nt-negative"}>{pct(rangeReturn)}</td><td>{first?.timestamps.slice(0,10) ?? "—"} → {latest?.timestamps.slice(0,10) ?? "—"}</td></tr>
                <tr><td>Range high</td><td>{format(rangeHigh)}</td><td>Observed</td></tr>
                <tr><td>Range low</td><td>{format(rangeLow)}</td><td>Observed</td></tr>
                <tr><td>Avg daily H-L</td><td>{pct(avgDailyRange)}</td><td>Price range</td></tr>
                <tr><td>Latest session</td><td className={latestChange != null && latestChange >= 0 ? "nt-positive" : "nt-negative"}>{pct(latestChange)}</td><td>{latest?.timestamps.slice(0,10) ?? "—"}</td></tr>
              </tbody></table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Session distribution</strong><span className="nt-panel-meta">direction · volume</span></div>
              <table className="nt-microtable"><tbody>
                <tr><td>Up sessions</td><td className="nt-positive">{upSessions || "—"}</td><td>{bars.length ? pct((upSessions / bars.length) * 100) : "—"}</td></tr>
                <tr><td>Down sessions</td><td className="nt-negative">{downSessions || "—"}</td><td>{bars.length ? pct((downSessions / bars.length) * 100) : "—"}</td></tr>
                <tr><td>Flat sessions</td><td>{flatSessions || "—"}</td><td>{bars.length ? pct((flatSessions / bars.length) * 100) : "—"}</td></tr>
                <tr><td>Avg volume</td><td>{format(avgVolume)}</td><td>{volumeBars.length} bars</td></tr>
                <tr><td>Total volume</td><td>{format(totalVolume || null)}</td><td>{range}</td></tr>
                <tr><td>Latest volume</td><td>{format(latest?.volume)}</td><td>{latest?.timestamps.slice(0,10) ?? "—"}</td></tr>
              </tbody></table>
            </section>

            <section className="nt-panel nt-chart-recent-panel">
              <div className="nt-panel-title"><strong>Recent sessions</strong><span className="nt-panel-meta">last 12 bars</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Date</th><th>Close</th><th>Δ%</th><th>Volume</th></tr></thead>
                <tbody>{recentBars.map((bar,index) => {
                  const originalIndex = bars.length - 1 - index;
                  const previous = originalIndex > 0 ? bars[originalIndex - 1] : undefined;
                  const change = previous?.close ? ((bar.close / previous.close) - 1) * 100 : null;
                  return <tr key={bar.timestamps}><td>{bar.timestamps.slice(5,10)}</td><td>{format(bar.close)}</td><td className={change != null && change >= 0 ? "nt-positive" : "nt-negative"}>{pct(change)}</td><td>{format(bar.volume)}</td></tr>;
                })}</tbody>
              </table>
            </section>
          </div>
        </section>

        <aside className="nt-section-stack nt-chart-rail">
          <section className="nt-panel" id="nt-indicator-panel">
            <div className="nt-panel-title"><strong>Indicators</strong><span className="nt-panel-meta">overlay · derived locally</span></div>
            <div className="nt-indicator-list">
              {([
                ["sma20","SMA 20","#6ea7e8",sma20Values.at(-1)],
                ["sma50","SMA 50","#d5a65d",sma50Values.at(-1)],
                ["ema20","EMA 20","#b58bdc",ema20Values.at(-1)],
                ["bb20","Bollinger 20,2","#6f849c",bb20Values.mid.at(-1)],
              ] as Array<[IndicatorKey,string,string,number | null | undefined]>).map(([key,label,color,value]) => (
                <label className="nt-indicator-row" key={key}>
                  <input type="checkbox" checked={activeIndicators[key]} onChange={() => toggleIndicator(key)} />
                  <span className="nt-indicator-swatch" style={{ backgroundColor: color }} />
                  <span className="nt-indicator-name">{label}</span>
                  <span className="nt-mono">{format(value)}</span>
                </label>
              ))}
              <div className="nt-indicator-row nt-indicator-readonly">
                <span className="nt-indicator-swatch" style={{ backgroundColor: "#5fc3b4" }} />
                <span className="nt-indicator-name">RSI 14</span>
                <span className="nt-mono">{format(rsi14Values.at(-1))}</span>
              </div>
              <div className="nt-indicator-row nt-indicator-readonly">
                <span className="nt-indicator-swatch" style={{ backgroundColor: "#d68762" }} />
                <span className="nt-indicator-name">ATR 14</span>
                <span className="nt-mono">{format(atr14Values.at(-1))}</span>
              </div>
            </div>
            <div className="nt-database-note">SMA/EMA/Bollinger are calculated from stored close bars. RSI14 and ATR14 use Wilder-style smoothing. VWAP remains unavailable without intraday data.</div>
          </section>

          <section className="nt-panel" id="nt-alert-panel">
            <div className="nt-panel-title"><strong>Price alerts</strong><span className="nt-panel-meta">browser local · chart lines</span></div>
            <div className="nt-alert-form">
              <select className="nt-control nt-control-select" aria-label="Alert condition" value={alertCondition} onChange={event => setAlertCondition(event.target.value as AlertCondition)}>
                <option value="above">Crosses above</option>
                <option value="below">Crosses below</option>
              </select>
              <input className="nt-control nt-control-input" type="number" min="0" step="0.01" aria-label="Alert price" value={alertTarget} onChange={event => setAlertTarget(event.target.value)} />
              <button type="button" className="nt-action" onClick={addAlert}>Add</button>
            </div>
            <table className="nt-microtable">
              <thead><tr><th>Condition</th><th>Price</th><th>State</th><th /></tr></thead>
              <tbody>
                {currentAlerts.map(alert => {
                  const status = alertState(alert);
                  return <tr key={alert.id}>
                    <td>{alert.condition === "above" ? "Above" : "Below"}</td>
                    <td>{format(alert.target)}</td>
                    <td className={status === "TRIGGERED" ? "nt-warning" : alert.enabled ? "nt-positive" : "nt-muted"}>{status}</td>
                    <td><button type="button" className="nt-table-action" onClick={() => setAlerts(current => current.filter(item => item.id !== alert.id))}>×</button></td>
                  </tr>;
                })}
                {!currentAlerts.length && <tr><td colSpan={4}>No local alerts for {symbol}</td></tr>}
              </tbody>
            </table>
            <div className="nt-database-note">These alerts persist in this browser only. No server push/email/SMS is implied until a backend alerts service is connected.</div>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Metric registry</strong><span className="nt-panel-meta">source-backed</span></div>
            <table className="nt-microtable"><thead><tr><th>Metric</th><th>State</th><th>Value</th></tr></thead><tbody>
              {Object.entries(metrics.data?.metrics ?? {}).slice(0, 10).map(([key, result]) => <tr key={key}><td>{labelText(key)}</td><td title={result.reason ?? undefined}>{result.quality}</td><td>{valueText(result.value)}</td></tr>)}
              {!metrics.data && <tr><td colSpan={3}>{metrics.error ?? "Awaiting metric snapshot"}</td></tr>}
            </tbody></table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Data health</strong><span className="nt-panel-meta">per series</span></div>
            <table className="nt-microtable"><tbody>
              {series.map(item => <tr key={item}><td>{item}</td><td className="nt-warning">PARTIAL</td><td>—</td></tr>)}
            </tbody></table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Macro event records</strong><span className="nt-panel-meta">country · importance</span></div>
            <table className="nt-microtable"><thead><tr><th>Context</th><th>Event</th><th>Impact</th></tr></thead><tbody>
              {(calendar.data?.events ?? []).map(event => <tr key={event.id}><td><CurrencyContext currency={event.currency} /></td><td title={event.scheduled_at ?? undefined}>{event.title}</td><td><ImpactBadge impact={event.impact} /></td></tr>)}
              {!calendar.data?.events.length && <tr><td colSpan={3}>{calendar.error ?? "No macro calendar observations"}</td></tr>}
            </tbody></table>
          </section>
        </aside>
      </div>

      <DataTable title="Chart data coverage" columns={["Series", "Status"]}
        rows={[
          { key: "bars", cells: ["OHLCV", state] },
          { key: "indicators", cells: ["Local overlays", "SMA20 / SMA50 / EMA20 / Bollinger20 + RSI14 / ATR14 derived from stored bars"] },
          { key: "alerts", cells: ["Price alerts", "Browser-local persistence with chart price lines; server notification service not connected"] },
          { key: "metrics", cells: ["Source-backed derived metrics", metrics.data?.quality === "LICENSE_RESTRICTED" ? "Historical fallback lacks public redistribution permission" : metrics.data?.quality ?? metrics.error ?? "Awaiting source"] },
          { key: "correlation", cells: ["Correlation", correlation.data?.reason ?? correlation.error ?? "Requires overlapping licensed histories"] },
          { key: "events", cells: ["Earnings and corporate actions", "Dedicated issuer events feed required; available macro records are shown separately"] },
          { key: "intraday", cells: ["VWAP and volume profile", "Requires intraday bars or trade prints at a suitable resolution"] },
          { key: "options", cells: ["Implied volatility", "Requires option chains with quotes, expirations and greeks"] },
        ]} />
    </div>
  );
}
