const heat = [
  ["NVDA", "Technology"], ["MSFT", "Technology"], ["AAPL", "Technology"],
  ["AVGO", "Technology"], ["AMZN", "Consumer"], ["GOOGL", "Communication"],
  ["META", "Communication"], ["JPM", "Financials"], ["XOM", "Energy"],
  ["LLY", "Health Care"], ["COST", "Consumer"], ["TSLA", "Consumer"],
];

const sectors = [
  "Technology", "Communication", "Financials", "Consumer Discretionary",
  "Health Care", "Industrials", "Staples", "Energy",
];

export default function MarketsWorkspace() {
  return (
    <div className="nt-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Markets</div>
          <h1>US Market Pulse</h1>
        </div>
        {["S&P 500", "NASDAQ", "DOW", "VIX"].map((name) => (
          <div className="nt-index" key={name}>
            <div className="nt-index-name">{name}</div>
            <div className="nt-index-values">
              <span>—</span>
              <span className="nt-muted">Awaiting feed</span>
            </div>
          </div>
        ))}
      </section>

      <div className="nt-grid nt-grid-markets">
        <aside className="nt-panel">
          <div className="nt-panel-title">
            <strong>Sector breadth</strong>
            <span className="nt-panel-meta">LIVE / DELAYED</span>
          </div>
          <div>
            {sectors.map((sector) => (
              <div className="nt-metric-row" key={sector}>
                <span>{sector}</span>
                <b>—</b>
                <span className="nt-muted">Awaiting</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="nt-section-stack">
          <div className="nt-panel">
            <div className="nt-panel-title">
              <strong>Market breadth & constituent heatmap</strong>
              <span className="nt-panel-meta">Source required</span>
            </div>
            <div className="nt-panel-body">
              <div className="nt-heatmap">
                {heat.map(([symbol, sector]) => (
                  <div className="nt-heat-cell" key={symbol}>
                    <b>{symbol}</b>
                    <span className="nt-muted nt-mono">—</span>
                    <small>{sector}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="nt-kpi-row">
            {[
              ["ADV / DECL", "—", "Awaiting breadth feed"],
              ["NEW HIGHS", "—", "Awaiting breadth feed"],
              ["UP VOLUME", "—", "Awaiting volume breadth"],
              ["ABOVE 50D", "—", "Awaiting history coverage"],
            ].map(([label, value, note]) => (
              <div className="nt-kpi" key={label}>
                <div className="nt-label">{label}</div>
                <div className="nt-kpi-value">{value}</div>
                <div className="nt-kpi-note">{note}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title">
              <strong>Top movers</strong>
              <span className="nt-panel-meta">Session</span>
            </div>
            <div className="nt-empty">No ranking is inferred until a valid session feed is available.</div>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title">
              <strong>Events & headlines</strong>
              <span className="nt-panel-meta">ET</span>
            </div>
            <div className="nt-empty">Event feed not connected to the new workspace yet.</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
