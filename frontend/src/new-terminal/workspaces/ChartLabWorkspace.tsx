"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type Time,
} from "lightweight-charts";

export type ChartBar = { timestamps: string; open: number; high: number; low: number; close: number; volume: number | null };
type Bar = ChartBar;
type HistoryState = {
  symbol: string;
  range: string;
  bars: Bar[];
  visibleStart: string;
  status: string;
};
const EMPTY_BARS: Bar[] = [];
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
const INDICATOR_LOOKBACK_DAYS = 120;
const ALERT_STORAGE = "dsa.chart.price-alerts.v1";

const format = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });

const pct = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const series = ["AAPL", "MSFT", "SPY", "QQQ", "DXY", "US10Y"];

import DataTable from "../DataTable";
import { calendarCoverageState, calendarEventsInDeclaredCoverage, labelText, sourceLink, valueText, type Calendar, type Correlation, type Metrics, type DailyAnalytics, type Universe } from "../feeds";
import { CurrencyContext, ImpactBadge, SymbolContext } from "../ContextBadges";
import type { MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";

const ohlcFields = ["Open","High","Low","Adj. close","Volume","VWAP","ATR","Gap","52W Pos","Beta","IV / Vol","Rel Vol"];

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
    values[index] == null ? [] : [{ time: bar.timestamps.slice(0, 10) as Time, value: values[index] as number }]
  );
}

export default function ChartLabWorkspace({
  initialSymbol = "AAPL",
  initialHistory,
  initialUniverse = [],
  initialRows = [],
  initialMetrics,
  initialDaily,
  initialCalendar,
  initialCalendarTime = 0,
  initialCorrelation,
}: {
  initialSymbol?: string;
  initialHistory?: { bars: ChartBar[]; visibleStart: string };
  initialUniverse?: Universe[];
  initialRows?: MarketRow[];
  initialMetrics?: Metrics;
  initialDaily?: DailyAnalytics;
  initialCalendar?: Calendar;
  initialCalendarTime?: number;
  initialCorrelation?: Correlation;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [range, setRange] = useState("6M");
  const [history, setHistory] = useState<HistoryState>({
    symbol: initialSymbol,
    range: "6M",
    bars: initialHistory?.bars ?? EMPTY_BARS,
    visibleStart: initialHistory?.visibleStart ?? "",
    status: initialHistory?.bars.length ? "Stored daily bars" : "Loading stored bars",
  });
  const [activeIndicators, setActiveIndicators] = useState<Record<IndicatorKey, boolean>>({
    sma20: true,
    sma50: true,
    ema20: false,
    bb20: false,
  });
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [calendarTime, setCalendarTime] = useState(initialCalendarTime);
  const [alertCondition, setAlertCondition] = useState<AlertCondition>("above");
  const [alertTarget, setAlertTarget] = useState("");
  const canvas = useRef<HTMLDivElement>(null);

  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const stored = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const metrics = useFeed<Metrics>(`/api/v1/metrics/${encodeURIComponent(symbol)}?timeframe=daily`);
  const daily = useFeed<DailyAnalytics>("/api/market/daily-analytics", 300000);
  const calendar = useFeed<Calendar>(`/api/v1/economic-calendar?symbol=${encodeURIComponent(symbol)}&limit=1000`, 300000);
  const compared = [...new Set([symbol, "SPY", "QQQ", "BTC-USD"])];
  const correlation = useFeed<Correlation>(`/api/v1/correlation?symbols=${encodeURIComponent(compared.join(","))}&window=60`);

  const universeRows = universe.data?.data ?? initialUniverse;
  const storedRows = stored.data?.data ?? initialRows;
  const metricData = metrics.data ?? (symbol === initialSymbol ? initialMetrics : undefined);
  const dailyData = daily.data ?? initialDaily;
  const calendarData = calendar.data ?? (symbol === initialSymbol ? initialCalendar : undefined);
  const calendarState = calendar.error
    ? { valid: false, label: "Calendar feed unavailable" }
    : calendarCoverageState(calendarData);
  const upcomingEvents = calendarState.valid
    ? calendarEventsInDeclaredCoverage(calendarData)
      .filter(event => event.scheduled_at && new Date(event.scheduled_at).getTime() >= calendarTime)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 12)
    : [];
  const eventTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const correlationData = correlation.data ?? (symbol === initialSymbol ? initialCorrelation : undefined);
  const correlationSummary = useMemo(() => {
    const symbols = correlationData?.symbols ?? [...new Set([symbol, "SPY", "QQQ", "BTC-USD"])];
    const pairs: Array<{ left: string; right: string; value: number }> = [];
    for (let row = 0; row < symbols.length; row += 1) {
      for (let column = row + 1; column < symbols.length; column += 1) {
        const value = correlationData?.data[row]?.[column]?.value;
        if (value != null && Number.isFinite(value)) pairs.push({ left: symbols[row], right: symbols[column], value });
      }
    }
    const strongestPositive = [...pairs].sort((a,b) => b.value - a.value)[0];
    const strongestInverse = [...pairs].sort((a,b) => a.value - b.value)[0];
    const averageAbsolute = pairs.length ? pairs.reduce((sum,pair) => sum + Math.abs(pair.value), 0) / pairs.length : null;
    return { strongestPositive, strongestInverse, averageAbsolute };
  }, [correlationData, symbol]);
  const dailyMetrics = dailyData?.data[symbol]?.metrics;
  const registry = [
    ...["sma20", "sma50", "sma200", "rvol20", "trading_52w_high", "trading_52w_low"]
      .flatMap(key => dailyMetrics?.[key] ? [[key, dailyMetrics[key]] as const] : []),
    ...Object.entries(metricData?.metrics ?? {}).filter(([key]) => !dailyMetrics?.[key]),
  ].slice(0, 14);

  useEffect(() => {
    const timer = window.setInterval(() => setCalendarTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
    const rangeStart = new Date(to.getTime() - chartRanges[range] * 86400000);
    const warmupStart = new Date(rangeStart.getTime() - INDICATOR_LOOKBACK_DAYS * 86400000);
    const visibleStart = rangeStart.toISOString().slice(0, 10);
    const dates = new URLSearchParams({ from: warmupStart.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    function finish(bars: Bar[], status: string) {
      if (!controller.signal.aborted) setHistory({ symbol, range, bars, visibleStart, status });
    }
    fetch(`/api/market/daily-history/${encodeURIComponent(symbol)}?${dates}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("History unavailable");
        const payload: { data?: Bar[]; quality?: string } = await response.json();
        if (payload.quality === "LICENSE_RESTRICTED") {
          finish(EMPTY_BARS, "History source is restricted");
          return;
        }
        const data = payload.data ?? [];
        if (controller.signal.aborted) return;
        const dated = new Map<string, Bar>();
        for (const bar of data) {
          if (typeof bar?.timestamps !== "string") continue;
          const day = bar.timestamps.slice(0, 10);
          const { open, high, low, close } = bar;
          if (![open, high, low, close].every(Number.isFinite) ||
              low > Math.min(open, close) || high < Math.max(open, close)) continue;
          dated.set(day, bar);
        }
        const clean = [...dated.values()].sort((a, b) => a.timestamps.localeCompare(b.timestamps));
        finish(clean, clean.some(bar => bar.timestamps.slice(0, 10) >= visibleStart)
          ? "Stored daily bars" : "No bars in this range");
      })
      .catch(() => finish(EMPTY_BARS, "History unavailable"));
    return () => controller.abort();
  }, [symbol, range]);

  // Identity checks also cover a response that resolves between a selection
  // change and the previous effect's abort cleanup. Never relabel old bars.
  const historyMatchesSelection = history.symbol === symbol && history.range === range;
  const fullBars = historyMatchesSelection ? history.bars : EMPTY_BARS;
  const state = historyMatchesSelection ? history.status : "Loading stored bars";
  const firstVisible = fullBars.findIndex(bar => bar.timestamps.slice(0, 10) >= history.visibleStart);
  const bars = useMemo(() => firstVisible < 0 ? [] : fullBars.slice(firstVisible), [firstVisible, fullBars]);
  const indicators = useMemo(() => {
    const closes = fullBars.map(bar => bar.close);
    const visible = (values: Array<number | null>) => firstVisible < 0 ? [] : values.slice(firstVisible);
    const bb = bollinger(closes, 20, 2);
    return {
      sma20: visible(sma(closes, 20)),
      sma50: visible(sma(closes, 50)),
      ema20: visible(ema(closes, 20)),
      bb: { mid: visible(bb.mid), upper: visible(bb.upper), lower: visible(bb.lower) },
      atr14: visible(atr(fullBars, 14)),
      rsi14: visible(rsi(closes, 14)),
    };
  }, [firstVisible, fullBars]);
  const { sma20: sma20Values, sma50: sma50Values, ema20: ema20Values, bb: bb20Values,
    atr14: atr14Values, rsi14: rsi14Values } = indicators;

  const currentAlerts = useMemo(() => alerts.filter(alert => alert.symbol === symbol), [alerts, symbol]);
  const activeIndicatorCount = Object.values(activeIndicators).filter(Boolean).length;

  useEffect(() => {
    if (!canvas.current || !bars.length) return;

    const chartStyle = window.getComputedStyle(canvas.current);
    const chartBackground = chartStyle.getPropertyValue("--nt-chart-bg").trim() || "#101923";
    const chartGrid = chartStyle.getPropertyValue("--nt-chart-grid").trim() || "#263543";
    const chartBorder = chartStyle.getPropertyValue("--nt-chart-border").trim() || "#3a4c5e";
    const chartText = chartStyle.getPropertyValue("--nt-chart-text").trim() || "#b8c5d2";

    const chart = createChart(canvas.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: chartBackground },
        textColor: chartText,
        fontFamily: chartStyle.fontFamily,
        fontSize: 11,
        panes: { separatorColor: chartBorder, separatorHoverColor: "#5b7b98" },
      },
      grid: { vertLines: { color: chartGrid }, horzLines: { color: chartGrid } },
      rightPriceScale: { borderColor: chartBorder, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: chartBorder, rightOffset: 2 },
      crosshair: { vertLine: { color: "#6486a5" }, horzLine: { color: "#6486a5" } },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#29b99a",
      downColor: "#de626d",
      borderUpColor: "#29b99a",
      borderDownColor: "#de626d",
      wickUpColor: "#29b99a",
      wickDownColor: "#de626d",
    });

    const daily = bars.map(bar => ({ ...bar, time: bar.timestamps.slice(0, 10) as Time }));
    candle.setData(daily);
    const volumeData = daily.flatMap(bar => bar.volume == null ? [] : [{
      time: bar.time,
      value: bar.volume,
      color: bar.close >= bar.open ? "#159b82" : "#c74e5b",
    }]);
    if (volumeData.length) {
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      }, 1);
      volume.setData(volumeData);
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.02 } });
      chart.panes()[1]?.setHeight(92);
    }

    if (activeIndicators.sma20) {
      const line = chart.addSeries(LineSeries, { color: "#6ea7e8", lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false });
      line.setData(lineData(bars, sma20Values));
    }
    if (activeIndicators.sma50) {
      const line = chart.addSeries(LineSeries, { color: "#d5a65d", lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false });
      line.setData(lineData(bars, sma50Values));
    }
    if (activeIndicators.ema20) {
      const line = chart.addSeries(LineSeries, { color: "#b58bdc", lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false });
      line.setData(lineData(bars, ema20Values));
    }
    if (activeIndicators.bb20) {
      const upper = chart.addSeries(LineSeries, { color: "#6f849c", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      const lower = chart.addSeries(LineSeries, { color: "#6f849c", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
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
  const prior = fullBars.at(-2);
  const latestDay = latest?.timestamps.slice(0, 10);
  const relativeVolume = dailyMetrics?.rvol20;
  const currency = universeRows.find(row => row.symbol === symbol)?.quote_currency;
  const hasVolume = bars.some(bar => bar.volume != null && bar.volume > 0);
  const values = [
    latest?.open,
    latest?.high,
    latest?.low,
    latest?.close,
    latest?.volume,
    null,
    latestIndex >= 0 ? atr14Values[latestIndex] : null,
    latest && prior?.close ? (latest.open / prior.close - 1) * 100 : null,
    null, null, null,
    relativeVolume?.as_of === latestDay ? relativeVolume?.value : null,
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
      <section className="nt-toolbar nt-chart-toolbar" data-layout-key="chart:toolbar">
        <strong className="nt-chart-title">Chart Lab</strong>
        <SymbolContext symbol={symbol} />

        <label className="nt-control-group">
          <span className="nt-control-caption">Symbol</span>
          <select className="nt-control nt-control-select" value={symbol} onChange={event => {
            setSymbol(event.target.value);
            setAlertTarget("");
          }}>
            {[...new Set([symbol, ...universeRows.map(row => row.symbol)])].map(item => <option key={item}>{item}</option>)}
          </select>
        </label>

        <div className="nt-control-group">
          <span className="nt-control-caption">Range</span>
          <div className="nt-segmented">
            {Object.keys(chartRanges).map(item => <button type="button" className="nt-tab" data-active={item === range} key={item} onClick={() => {
              if (item !== range) {
                setRange(item);
              }
            }}>{item}</button>)}
          </div>
        </div>

        <span className="nt-control-summary"><b>{bars.length || "—"}</b><small>SESSIONS</small></span>
        <span className="nt-control-summary"><b>{activeIndicatorCount}</b><small>OVERLAYS</small></span>
        <span className="nt-control-summary"><b>{currentAlerts.filter(alert => alert.enabled).length}</b><small>ALERTS</small></span>

        <button type="button" className="nt-action nt-toolbar-action" onClick={() => {
          document.getElementById("nt-indicator-panel")?.scrollIntoView({ block: "nearest" });
        }}>Indicators</button>
        <button type="button" className="nt-action nt-toolbar-action" onClick={() => {
          document.getElementById("nt-alert-panel")?.scrollIntoView({ block: "nearest" });
        }}>Alerts</button>
      </section>

      <div className="nt-dense-grid nt-financial-strip" data-layout-key="chart:metrics">
        {ohlcFields.map((key, index) => <div className="nt-data-cell" key={key}>
          <div className="k">{key}</div>
          <div className="v">{index === 7 ? pct(values[index]) : index === 11 && values[index] != null ? `${format(values[index])}×` : format(values[index])}</div>
          <div className="s">{index < 5 && latest ? latestDay : index === 6 && values[index] != null ? "ATR14" : index === 7 && values[index] != null ? "Open gap" : index === 11 && values[index] != null ? "20D" : ""}</div>
        </div>)}
      </div>

      <div className="nt-grid nt-grid-chart nt-chart-main-grid">
        <aside className="nt-chart-rail nt-flat-rail">
          <section className="nt-flat-surface">
            <div className="nt-subsection" data-layout-key="chart:linked-series">
              <div className="nt-subsection-title"><strong>Linked series</strong><span>Stored quotes</span></div>
              <table className="nt-microtable"><thead><tr><th>Series</th><th>Last</th><th>Chg%</th><th>As of</th></tr></thead><tbody>
                {series.map(item => {
                  const row = storedRows.find(entry => entry.symbol === item);
                  return <tr key={item}><td>{item}</td><td>{format(row?.price)}</td><td className={(row?.change_pct ?? 0) > 0 ? "nt-positive" : (row?.change_pct ?? 0) < 0 ? "nt-negative" : ""}>{pct(row?.change_pct)}</td><td>{row?.session_date ?? "—"}</td></tr>;
                })}
              </tbody></table>
            </div>

            <div className="nt-subsection" data-layout-key="chart:structural-context">
              <div className="nt-subsection-title"><strong>Structural context</strong><span>{symbol}</span></div>
              <table className="nt-microtable"><tbody>
                <tr><td>SMA 200</td><td>{valueText(dailyMetrics?.sma200?.value)}</td></tr>
                <tr><td>52W high</td><td>{valueText(dailyMetrics?.trading_52w_high?.value)}</td></tr>
                <tr><td>52W low</td><td>{valueText(dailyMetrics?.trading_52w_low?.value)}</td></tr>
                <tr><td>Rel volume</td><td>{dailyMetrics?.rvol20?.value == null ? "—" : `${valueText(dailyMetrics.rvol20.value)}×`}</td></tr>
              </tbody></table>
            </div>

            <div className="nt-subsection" data-layout-key="chart:range-statistics">
              <div className="nt-subsection-title"><strong>Range statistics</strong><span>{range}</span></div>
              <table className="nt-microtable"><tbody>
                <tr><td>Range return</td><td className={rangeReturn != null && rangeReturn >= 0 ? "nt-positive" : "nt-negative"}>{pct(rangeReturn)}</td></tr>
                <tr><td>Range high</td><td>{format(rangeHigh)}</td></tr>
                <tr><td>Range low</td><td>{format(rangeLow)}</td></tr>
                <tr><td>Avg daily H-L</td><td>{pct(avgDailyRange)}</td></tr>
                <tr><td>Latest session</td><td className={latestChange != null && latestChange >= 0 ? "nt-positive" : "nt-negative"}>{pct(latestChange)}</td></tr>
              </tbody></table>
            </div>

            <div className="nt-subsection" data-layout-key="chart:session-distribution">
              <div className="nt-subsection-title"><strong>Session distribution</strong><span>{bars.length} bars</span></div>
              <table className="nt-microtable"><tbody>
                <tr><td>Up sessions</td><td className="nt-positive">{upSessions || "—"}</td><td>{bars.length ? pct((upSessions / bars.length) * 100) : "—"}</td></tr>
                <tr><td>Down sessions</td><td className="nt-negative">{downSessions || "—"}</td><td>{bars.length ? pct((downSessions / bars.length) * 100) : "—"}</td></tr>
                <tr><td>Flat sessions</td><td>{flatSessions || "—"}</td><td>{bars.length ? pct((flatSessions / bars.length) * 100) : "—"}</td></tr>
                <tr><td>Avg volume</td><td>{format(avgVolume)}</td><td></td></tr>
                <tr><td>Total volume</td><td>{format(totalVolume || null)}</td><td></td></tr>
              </tbody></table>
            </div>
          </section>
        </aside>

        <section className="nt-chart-center">
          <section className="nt-panel nt-chart-primary-panel" data-layout-key="chart:price-chart">
            <div className="nt-panel-title">
              <div>
                <strong>{symbol} · Price / Volume</strong>
                <div className="nt-panel-meta">{range} · 1D{currency ? ` · ${currency}` : ""} · {bars.length ? `${bars.length} sessions · ${latestDay}` : state}</div>
              </div>
            </div>
            <div className="nt-chart-legend" aria-label="Chart series">
              <span>OHLC</span>
              {activeIndicators.sma20 && <span style={{ color: "#6ea7e8" }}>SMA 20 <b>{format(sma20Values.at(-1))}</b></span>}
              {activeIndicators.sma50 && <span style={{ color: "#d5a65d" }}>SMA 50 <b>{format(sma50Values.at(-1))}</b></span>}
              {activeIndicators.ema20 && <span style={{ color: "#b58bdc" }}>EMA 20 <b>{format(ema20Values.at(-1))}</b></span>}
              {activeIndicators.bb20 && <span style={{ color: "#a0b1c4" }}>BB 20,2 <b>{format(bb20Values.mid.at(-1))}</b></span>}
              {hasVolume && <span>Volume <b>{format(latest?.volume)}</b></span>}
            </div>
            <div className="nt-panel-body"><div ref={canvas} aria-label={`${symbol} daily price and volume chart`} aria-hidden={!bars.length} style={{ visibility: bars.length ? "visible" : "hidden" }} /></div>
          </section>

          <section className="nt-panel" data-layout-key="chart:ohlc">
            <div className="nt-panel-title"><strong>OHLC / indicators</strong><span className="nt-panel-meta">last 10 sessions</span></div>
            <div className="nt-table-wrap"><table className="nt-table">
              <thead><tr>{["Time","Open","High","Low","Close","Volume","SMA20","SMA50","RSI14","ATR14"].map(item => <th key={item}>{item}</th>)}</tr></thead>
              <tbody>{bars.slice(-10).reverse().map(bar => {
                const index = bars.indexOf(bar);
                return <tr key={bar.timestamps}>
                  <td>{bar.timestamps.slice(0,10)}</td>
                  {[bar.open,bar.high,bar.low,bar.close,bar.volume].map((value,itemIndex) => <td className="nt-mono" key={itemIndex}>{format(value)}</td>)}
                  <td>{format(sma20Values[index])}</td>
                  <td>{format(sma50Values[index])}</td>
                  <td>{format(rsi14Values[index])}</td>
                  <td>{format(atr14Values[index])}</td>
                </tr>;
              })}</tbody>
            </table></div>
          </section>

        </section>

        <aside className="nt-chart-rail nt-flat-rail">
          <section className="nt-flat-surface">
            <div className="nt-subsection" id="nt-indicator-panel" data-layout-key="chart:indicators">
              <div className="nt-subsection-title"><strong>Indicators</strong><span>overlay</span></div>
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
                <div className="nt-indicator-row nt-indicator-readonly"><span className="nt-indicator-swatch" style={{ backgroundColor: "#5fc3b4" }} /><span className="nt-indicator-name">RSI 14</span><span className="nt-mono">{format(rsi14Values.at(-1))}</span></div>
                <div className="nt-indicator-row nt-indicator-readonly"><span className="nt-indicator-swatch" style={{ backgroundColor: "#d68762" }} /><span className="nt-indicator-name">ATR 14</span><span className="nt-mono">{format(atr14Values.at(-1))}</span></div>
              </div>
            </div>

            <div className="nt-subsection" id="nt-alert-panel" data-layout-key="chart:alerts">
              <div className="nt-subsection-title"><strong>Price alerts</strong><span>{currentAlerts.length}</span></div>
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
                    return <tr key={alert.id}><td>{alert.condition === "above" ? "Above" : "Below"}</td><td>{format(alert.target)}</td><td className={status === "TRIGGERED" ? "nt-warning" : alert.enabled ? "nt-positive" : "nt-muted"}>{status}</td><td><button type="button" className="nt-table-action" onClick={() => setAlerts(current => current.filter(item => item.id !== alert.id))}>×</button></td></tr>;
                  })}
                  {!currentAlerts.length && <tr><td colSpan={4}>No price alerts</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="nt-subsection" data-layout-key="chart:macro-events">
              <div className="nt-subsection-title"><strong>Macro events</strong><span className={calendarState.valid ? "" : "nt-warning"}>{calendarState.valid ? "next · ET" : "SOURCE GAP"}</span></div>
              <table className="nt-microtable"><thead><tr><th>Time (ET)</th><th>Context</th><th>Event</th><th>Impact</th></tr></thead><tbody>
                {upcomingEvents.map(event => <tr key={event.id}><td>{eventTime.format(new Date(event.scheduled_at!))}</td><td><CurrencyContext currency={event.currency} /></td><td title={event.scheduled_at ?? undefined}>{event.title}</td><td><ImpactBadge impact={event.impact} /></td></tr>)}
                {!upcomingEvents.length && <tr><td colSpan={4}>{calendarState.valid ? "No upcoming events in current coverage." : calendarState.label}</td></tr>}
              </tbody></table>
              <div className="nt-database-note">Source: <a href={sourceLink(calendarData?.source_url) || "https://www.forexfactory.com/calendar"} rel="noreferrer">{calendarData?.source || "ForexFactory"}</a>{calendarData?.coverage?.start && calendarData.coverage.end ? ` · ${calendarData.coverage.start} → ${calendarData.coverage.end}` : ""}</div>
            </div>
          </section>
        </aside>
      </div>

      <section className="nt-flat-surface nt-chart-correlation-matrix" data-layout-key="chart:correlation">
        <div className="nt-subsection-title"><strong>Cross-asset correlation · 60D</strong><span>{correlationData?.symbols?.length ?? compared.length} series</span></div>
        <div className="nt-table-wrap"><table className="nt-table nt-correlation-matrix-table">
          <thead><tr><th>Series</th>{(correlationData?.symbols ?? compared).map(item => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>{(correlationData?.symbols ?? compared).map((rowSymbol,rowIndex) => <tr key={rowSymbol}>
            <td>{rowSymbol}</td>
            {(correlationData?.symbols ?? compared).map((columnSymbol,columnIndex) => {
              const value = correlationData?.data[rowIndex]?.[columnIndex]?.value;
              return <td key={columnSymbol} className={value != null && value >= .5 ? "nt-positive" : value != null && value <= -.5 ? "nt-negative" : ""}>{value == null ? "—" : valueText(value)}</td>;
            })}
          </tr>)}</tbody>
        </table></div>
        <div className="nt-correlation-summary">
          <div><span>Strongest positive</span><b>{correlationSummary.strongestPositive ? `${correlationSummary.strongestPositive.left} / ${correlationSummary.strongestPositive.right} · ${valueText(correlationSummary.strongestPositive.value)}` : "—"}</b></div>
          <div><span>Strongest inverse</span><b>{correlationSummary.strongestInverse ? `${correlationSummary.strongestInverse.left} / ${correlationSummary.strongestInverse.right} · ${valueText(correlationSummary.strongestInverse.value)}` : "—"}</b></div>
          <div><span>Average |corr|</span><b>{correlationSummary.averageAbsolute == null ? "—" : valueText(correlationSummary.averageAbsolute)}</b></div>
        </div>
      </section>
    </div>
  );
}
