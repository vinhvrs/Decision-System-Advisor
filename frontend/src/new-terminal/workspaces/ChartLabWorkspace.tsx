"use client";

import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, HistogramSeries, createChart, type BusinessDay } from "lightweight-charts";

type Bar = { timestamps: string; open: number; high: number; low: number; close: number; volume: number | null };
const chartRanges: Record<string, number> = { "1M": 31, "3M": 93, "6M": 186, "1Y": 366, "5Y": 1830 };
const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });

const series=["AAPL","MSFT","SPY","QQQ","DXY","US10Y"];
const indicators=["SMA 20","SMA 50","SMA 200","VWAP","RSI 14","MACD","Volume","ATR 14","Bollinger","Relative Strength"];
const ohlcFields=["Open","High","Low","Close","Volume","VWAP","ATR","Gap","52W Pos","Beta","IV / Vol","Rel Vol"];

export default function ChartLabWorkspace(){
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState("6M");
  const [bars, setBars] = useState<Bar[]>([]);
  const [state, setState] = useState("Loading stored bars");
  const canvas = useRef<HTMLDivElement>(null);

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
  const values = [latest?.open, latest?.high, latest?.low, latest?.close, latest?.volume];
  return (
    <div className="nt-workspace">
      <section className="nt-toolbar">
        <strong style={{fontSize:12}}>CHART LAB / TIME-SERIES DATABASE</strong>
        <label className="nt-chip"><b>Symbol</b> <select value={symbol} onChange={event => { setBars([]); setState("Loading stored bars"); setSymbol(event.target.value); }}>
          {["AAPL","MSFT","NVDA","AMZN","SPY","QQQ","AMD","ADBE","CRM","SNOW"].map(item => <option key={item}>{item}</option>)}
        </select></label>
        {Object.keys(chartRanges).map(item => <button type="button" className="nt-tab" data-active={item===range} key={item} onClick={() => { if (item !== range) { setBars([]); setState("Loading stored bars"); setRange(item); } }}>{item}</button>)}
        <span className="nt-chip"><b>Bars</b>1D</span><span className="nt-chip"><b>Mode</b>Absolute</span>
        <span style={{marginLeft:"auto"}} className="nt-action">Templates</span>
      </section>

      <div className="nt-dense-grid">
        {ohlcFields.map((k,i)=><div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">{format(values[i])}</div><div className="s">{i < 5 && latest ? latest.timestamps.slice(0,10) : "Awaiting source"}</div></div>)}
      </div>

      <div className="nt-grid nt-grid-chart">
        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Series matrix</strong><span className="nt-panel-meta">linked context</span></div>
            <table className="nt-microtable"><thead><tr><th>Series</th><th>Last</th><th>Chg</th></tr></thead><tbody>
              {series.map(s=><tr key={s}><td>{s}</td><td>—</td><td>—</td></tr>)}
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
            <table className="nt-microtable"><tbody>{series.slice(1).map(s=><tr key={s}><td>{s}</td><td>—</td></tr>)}</tbody></table>
          </section>
        </aside>

        <section className="nt-section-stack">
          <section className="nt-panel">
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
        </section>

        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Indicator registry</strong><span className="nt-panel-meta">active / source</span></div>
            <table className="nt-microtable"><thead><tr><th>Indicator</th><th>State</th><th>Value</th></tr></thead><tbody>
              {indicators.map(x=><tr key={x}><td>{x}</td><td>OFF</td><td>—</td></tr>)}
            </tbody></table>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Data health</strong><span className="nt-panel-meta">per series</span></div>
            <table className="nt-microtable"><tbody>
              {series.map(s=><tr key={s}><td>{s}</td><td className="nt-warning">PARTIAL</td><td>—</td></tr>)}
            </tbody></table>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Events overlay</strong><span className="nt-panel-meta">chart range</span></div>
            <table className="nt-microtable"><tbody>
              {["Earnings","Dividend","Filing","Macro","Fed","Corporate event"].map(x=><tr key={x}><td>{x}</td><td>—</td></tr>)}
            </tbody></table>
          </section>
        </aside>
      </div>
    </div>
  );
}
