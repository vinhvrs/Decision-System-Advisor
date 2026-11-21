"use client";

import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, HistogramSeries, createChart, type BusinessDay } from "lightweight-charts";

type Bar = { timestamps: string; open: number; high: number; low: number; close: number; volume: number | null };
const chartRanges: Record<string, number> = { "1M": 31, "3M": 93, "6M": 186, "1Y": 366, "5Y": 1830 };
const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const series=["AAPL","MSFT","SPY","QQQ","DXY","US10Y"];
import DataTable from "../DataTable";
import { labelText, valueText, type Calendar, type Correlation, type Metrics, type Universe } from "../feeds";
import { CurrencyContext, ImpactBadge, SymbolContext } from "../ContextBadges";
import type { MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";
const ohlcFields=["Open","High","Low","Close","Volume","VWAP","ATR","Gap","52W Pos","Beta","IV / Vol","Rel Vol"];

export default function ChartLabWorkspace({ initialSymbol = "AAPL" }: { initialSymbol?: string }){
  const [symbol, setSymbol] = useState(initialSymbol);
  const [range, setRange] = useState("6M");
  const [bars, setBars] = useState<Bar[]>([]);
  const [state, setState] = useState("Loading stored bars");
  const canvas = useRef<HTMLDivElement>(null);
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const stored = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const metrics = useFeed<Metrics>(`/api/v1/metrics/${encodeURIComponent(symbol)}?timeframe=daily`);
  const calendar = useFeed<Calendar>(`/api/v1/economic-calendar?symbol=${encodeURIComponent(symbol)}&limit=8`);
  const compared = [...new Set([symbol, "SPY", "QQQ", "BTC-USD"])];
  const correlation = useFeed<Correlation>(`/api/v1/correlation?symbols=${encodeURIComponent(compared.join(","))}&window=60`);

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

  useEffect(() => {
    if (!canvas.current || !bars.length) return;
    const chart = createChart(canvas.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#0b1016" }, textColor: "#aab8c8" },
      grid: { vertLines: { color: "#1d2937" }, horzLines: { color: "#1d2937" } },
    });
    const candle = chart.addSeries(CandlestickSeries);
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" } });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const daily = bars.map(bar => ({ ...bar, time: bar.timestamps.slice(0, 10) as unknown as BusinessDay }));
    candle.setData(daily);
    volume.setData(daily.flatMap(bar => bar.volume == null ? [] : [{ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? "#159b82" : "#c74e5b" }]));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  const latest = bars.at(-1);
  const first = bars[0];
  const values = [latest?.open, latest?.high, latest?.low, latest?.close, latest?.volume];
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

  return (
    <div className="nt-workspace nt-chart-workspace">
      <section className="nt-toolbar">
        <strong style={{fontSize:12}}>CHART LAB / TIME-SERIES DATABASE</strong><SymbolContext symbol={symbol} />
        <label className="nt-chip"><b>Symbol</b> <select value={symbol} onChange={event => { setBars([]); setState("Loading stored bars"); setSymbol(event.target.value); }}>
          {[...new Set([symbol, ...(universe.data?.data ?? []).map(row => row.symbol)])].map(item => <option key={item}>{item}</option>)}
        </select></label>
        {Object.keys(chartRanges).map(item => <button type="button" className="nt-tab" data-active={item===range} key={item} onClick={() => { if (item !== range) { setBars([]); setState("Loading stored bars"); setRange(item); } }}>{item}</button>)}
        <span className="nt-chip"><b>Bars</b>1D</span><span className="nt-chip"><b>Mode</b>Absolute</span>
        <span style={{marginLeft:"auto"}} className="nt-action">Templates</span>
      </section>

      <div className="nt-dense-grid">
        {ohlcFields.map((k,i)=><div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">{format(values[i])}</div><div className="s">{i < 5 && latest ? latest.timestamps.slice(0,10) : "Awaiting source"}</div></div>)}
      </div>

      <div className="nt-grid nt-grid-chart nt-chart-main-grid">
        <aside className="nt-section-stack nt-chart-rail">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Series matrix</strong><span className="nt-panel-meta">linked context</span></div>
            <table className="nt-microtable"><thead><tr><th>Series</th><th>Last</th><th>Chg</th></tr></thead><tbody>
              {series.map(s => {
                const row = stored.data?.data.find(item => item.symbol === s);
                return <tr key={s}><td>{s}</td><td>{format(row?.price)}</td><td>{format(row?.change_pct)}</td></tr>;
              })}
            </tbody></table>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Saved context</strong><span className="nt-panel-meta">workspace</span></div>
            <table className="nt-microtable"><tbody>
              <tr><td>Watchlist</td><td>Mega Cap</td></tr><tr><td>Screener</td><td>Current filter</td></tr><tr><td>Template</td><td>Price + Vol</td></tr><tr><td>Normalize</td><td>Absolute</td></tr>
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
              <div><strong>{symbol} · Price / Volume</strong><div className="nt-panel-meta">{range} · 1D · USD · Pi market history</div></div>
              <span className="nt-warning nt-mono">{state}</span>
            </div>
            <div className="nt-panel-body"><div ref={canvas} style={{ height: 370 }} aria-label={`${symbol} daily price and volume chart`}/></div>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>OHLC / indicator records</strong><span className="nt-panel-meta">selected visible range</span></div>
            <div className="nt-table-wrap"><table className="nt-table">
              <thead><tr>{["Time","Open","High","Low","Close","Volume","VWAP","SMA20","SMA50","RSI","ATR","Source"].map(x=><th key={x}>{x}</th>)}</tr></thead>
              <tbody>{bars.slice(-8).reverse().map(bar => <tr key={bar.timestamps}><td>{bar.timestamps.slice(0,10)}</td>{[bar.open,bar.high,bar.low,bar.close,bar.volume].map((value,index) => <td className="nt-mono" key={index}>{format(value)}</td>)}<td colSpan={5}>—</td><td>Stored OHLCV</td></tr>)}</tbody>
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
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Indicator registry</strong><span className="nt-panel-meta">active / source</span></div>
            <table className="nt-microtable"><thead><tr><th>Indicator</th><th>State</th><th>Value</th></tr></thead><tbody>
              {Object.entries(metrics.data?.metrics ?? {}).slice(0, 14).map(([key, result]) => <tr key={key}><td>{labelText(key)}</td><td title={result.reason ?? undefined}>{result.quality}</td><td>{valueText(result.value)}</td></tr>)}
              {!metrics.data && <tr><td colSpan={3}>{metrics.error ?? "Awaiting metric snapshot"}</td></tr>}
            </tbody></table>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Data health</strong><span className="nt-panel-meta">per series</span></div>
            <table className="nt-microtable"><tbody>
              {series.map(s=><tr key={s}><td>{s}</td><td className="nt-warning">PARTIAL</td><td>—</td></tr>)}
            </tbody></table>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Macro event records</strong><span className="nt-panel-meta">country · importance · chart range</span></div>
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
          { key: "metrics", cells: ["Derived indicators", metrics.data?.quality === "LICENSE_RESTRICTED" ? "Historical fallback lacks public redistribution permission" : metrics.data?.quality ?? metrics.error ?? "Awaiting source"] },
          { key: "correlation", cells: ["Correlation", correlation.data?.reason ?? correlation.error ?? "Requires overlapping licensed histories"] },
          { key: "events", cells: ["Earnings and corporate actions", "Dedicated issuer events feed required; available macro records are shown separately"] },
          { key: "intraday", cells: ["VWAP and volume profile", "Requires intraday bars or trade prints at a suitable resolution"] },
          { key: "options", cells: ["Implied volatility", "Requires option chains with quotes, expirations and greeks"] },
        ]} />
    </div>
  );
}
