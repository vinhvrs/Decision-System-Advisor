const series = ["AAPL", "MSFT", "SPY"];
const indicators = ["SMA 20", "SMA 50", "VWAP", "RSI 14", "Volume", "ATR 14"];

export default function ChartLabWorkspace() {
  return (
    <div className="nt-workspace">
      <section className="nt-toolbar">
        <strong style={{ fontSize: 13 }}>CHART LAB</strong>
        <span className="nt-chip"><b>Symbol</b> AAPL</span>
        <span className="nt-action">+ Compare</span>
        {["1D", "5D", "1M", "6M", "1Y"].map((x) => <span className="nt-tab" data-active={x === "6M"} key={x}>{x}</span>)}
        <span className="nt-chip"><b>Bars</b> 1D</span>
        <span className="nt-chip"><b>Mode</b> Absolute</span>
        <span style={{ marginLeft: "auto" }} className="nt-action">Templates</span>
      </section>

      <div className="nt-grid nt-grid-chart">
        <aside className="nt-filters">
          <div className="nt-label">Series</div>
          {series.map((s) => (
            <div className="nt-filter-item" key={s}>
              <span className="nt-mono">{s}</span>
              <span className="nt-muted">Awaiting</span>
            </div>
          ))}
          <div className="nt-label" style={{ marginTop: 18 }}>Linked context</div>
          <div className="nt-filter-item"><span>Watchlist</span><span className="nt-muted">Mega Cap</span></div>
          <div className="nt-filter-item"><span>Screener</span><span className="nt-muted">Current filter</span></div>
        </aside>

        <section className="nt-panel">
          <div className="nt-panel-title">
            <div>
              <strong>AAPL · Price</strong>
              <div className="nt-panel-meta" style={{ marginTop: 2 }}>6M · 1D · adjusted · USD</div>
            </div>
            <span className="nt-warning nt-mono">OHLC awaiting validated history</span>
          </div>
          <div className="nt-panel-body">
            <div className="nt-chart-canvas" />
            <div className="nt-panel-meta" style={{ marginTop: 8 }}>Crosshair · zoom · pan · measure · source timestamp</div>
          </div>
        </section>

        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Indicators</strong><span className="nt-panel-meta">Chart scope</span></div>
            {indicators.map((x) => (
              <div className="nt-metric-row" key={x}>
                <span>{x}</span><b>OFF</b><span className="nt-muted">Add</span>
              </div>
            ))}
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Data health</strong><span className="nt-panel-meta">Per series</span></div>
            <div className="nt-empty">Each series reports Live / Delayed / Historical / Partial / Unavailable independently.</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
