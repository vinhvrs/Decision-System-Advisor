const filters = [
  ["Descriptive", ["Exchange", "Sector", "Industry", "Country"]],
  ["Fundamental", ["Market Cap", "P/E", "ROE", "Debt / Equity"]],
  ["Technical", ["Price above 50D", "RSI", "ATR", "52W range"]],
  ["Liquidity", ["Avg Volume", "Relative Volume", "Dollar Volume"]],
] as const;

const demoColumns = ["Symbol", "Company", "Price", "Chg", "Mkt Cap", "P/E", "ROE", "Volume"];

export default function ScreenerWorkspace() {
  return (
    <div className="nt-workspace">
      <section className="nt-toolbar">
        <strong style={{ fontSize: 13 }}>SCREENER</strong>
        <span className="nt-chip"><b>Universe</b> US Equities</span>
        <span className="nt-chip"><b>Market Cap</b> &gt; $10B</span>
        <span className="nt-chip"><b>ROE</b> &gt; 15%</span>
        <span className="nt-chip"><b>Avg Volume</b> &gt; 1M</span>
        <span style={{ marginLeft: "auto" }} className="nt-label">0 VALIDATED RESULTS</span>
      </section>

      <div className="nt-grid nt-grid-screener">
        <aside className="nt-filters">
          <div className="nt-label" style={{ marginBottom: 10 }}>Filters</div>
          {filters.map(([group, items]) => (
            <div className="nt-filter-group" key={group}>
              <div className="nt-label">{group}</div>
              {items.map((item) => (
                <div className="nt-filter-item" key={item}>
                  <span>{item}</span><span className="nt-muted">Add</span>
                </div>
              ))}
            </div>
          ))}
        </aside>

        <section className="nt-panel">
          <div className="nt-panel-title">
            <strong>Results grid</strong>
            <span className="nt-panel-meta">Filter-first · keyboard ready</span>
          </div>
          <div className="nt-table-wrap">
            <table className="nt-table">
              <thead>
                <tr>{demoColumns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td className="nt-symbol">—</td>
                    <td>Awaiting validated universe</td>
                    <td className="nt-mono">—</td>
                    <td className="nt-mono">—</td>
                    <td className="nt-mono">—</td>
                    <td className="nt-mono">—</td>
                    <td className="nt-mono">—</td>
                    <td className="nt-mono">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="nt-panel">
          <div className="nt-panel-title">
            <strong>Linked inspection</strong>
            <span className="nt-panel-meta">No route change</span>
          </div>
          <div className="nt-panel-body">
            <div className="nt-label">Selected symbol</div>
            <div style={{ marginTop: 5, fontWeight: 650 }}>No validated row selected</div>
            <div className="nt-chart-canvas" style={{ minHeight: 280, marginTop: 12 }} />
            <div className="nt-empty" style={{ minHeight: 70 }}>
              OHLC history appears here only after source data is available.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
