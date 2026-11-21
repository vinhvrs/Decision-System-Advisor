const series=["AAPL","MSFT","SPY","QQQ","DXY","US10Y"];
const indicators=["SMA 20","SMA 50","SMA 200","VWAP","RSI 14","MACD","Volume","ATR 14","Bollinger","Relative Strength"];
const ohlcFields=["Open","High","Low","Close","Volume","VWAP","ATR","Gap","52W Pos","Beta","IV / Vol","Rel Vol"];

export default function ChartLabWorkspace(){
  return (
    <div className="nt-workspace">
      <section className="nt-toolbar">
        <strong style={{fontSize:12}}>CHART LAB / TIME-SERIES DATABASE</strong>
        <span className="nt-chip"><b>Symbol</b> AAPL</span><span className="nt-action">+Compare</span>
        {["1D","5D","1M","3M","6M","1Y","5Y"].map(x=><span className="nt-tab" data-active={x==="6M"} key={x}>{x}</span>)}
        <span className="nt-chip"><b>Bars</b>1D</span><span className="nt-chip"><b>Mode</b>Absolute</span>
        <span style={{marginLeft:"auto"}} className="nt-action">Templates</span>
      </section>

      <div className="nt-dense-grid">
        {ohlcFields.map(k=><div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">—</div><div className="s">Awaiting source</div></div>)}
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
              <div><strong>AAPL · Price / Volume</strong><div className="nt-panel-meta">6M · 1D · adjusted · USD · source timestamp required</div></div>
              <span className="nt-warning nt-mono">OHLC PARTIAL</span>
            </div>
            <div className="nt-panel-body"><div className="nt-chart-canvas"/><div className="nt-database-note">Crosshair · zoom · pan · measure · compare · normalized mode · event overlay</div></div>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>OHLC / indicator records</strong><span className="nt-panel-meta">selected visible range</span></div>
            <div className="nt-table-wrap"><table className="nt-table">
              <thead><tr>{["Time","Open","High","Low","Close","Volume","VWAP","SMA20","SMA50","RSI","ATR","Source"].map(x=><th key={x}>{x}</th>)}</tr></thead>
              <tbody>{Array.from({length:8}).map((_,i)=><tr key={i}><td>—</td>{Array.from({length:11}).map((_,j)=><td className="nt-mono" key={j}>—</td>)}</tr>)}</tbody>
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
