const heat = [
  ["NVDA","Technology"],["MSFT","Technology"],["AAPL","Technology"],["AVGO","Technology"],
  ["AMD","Technology"],["ORCL","Technology"],["CRM","Technology"],["MU","Technology"],
  ["AMZN","Consumer"],["TSLA","Consumer"],["COST","Consumer"],["WMT","Consumer"],
  ["GOOGL","Communication"],["META","Communication"],["NFLX","Communication"],["JPM","Financials"],
  ["BAC","Financials"],["XOM","Energy"],["LLY","Health Care"],["CAT","Industrials"],
];

const sectors = ["Technology","Communication","Financials","Consumer Discr.","Health Care","Industrials","Staples","Energy","Utilities","Real Estate","Materials"];

const matrix = [
  ["ADV / DECL","—","Breadth"],
  ["UP / DOWN VOL","—","Volume"],
  ["NEW HIGHS","—","52W"],
  ["NEW LOWS","—","52W"],
  ["> 20D MA","—","Trend"],
  ["> 50D MA","—","Trend"],
  ["> 200D MA","—","Trend"],
  ["RSP / SPY","—","Equal wt"],
  ["PUT / CALL","—","Options"],
  ["VIX TERM","—","Volatility"],
  ["DXY","—","FX"],
  ["US10Y","—","Rates"],
];

const crossAsset = ["DXY","US02Y","US10Y","WTI","GOLD","COPPER","BTC","ETH"];
const events = ["Macro release","Fed speaker","Earnings event","Treasury auction","Energy inventory","Options expiry"];
const movers = ["Top gainers","Top losers","Rel volume","Gap up","Gap down","New highs"];

export default function MarketsWorkspace() {
  return (
    <div className="nt-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Markets / US Equities</div>
          <h1>Market Database</h1>
        </div>
        {["S&P 500","NASDAQ","DOW","RUSSELL","VIX","US10Y"].map((name) => (
          <div className="nt-index" key={name}>
            <div className="nt-index-name">{name}</div>
            <div className="nt-index-values"><span>—</span><span className="nt-muted">awaiting</span></div>
          </div>
        ))}
      </section>

      <div className="nt-dense-grid">
        {[
          ["Session","US Regular","Market clock"],
          ["Universe","US Equities","Coverage gated"],
          ["Breadth","—","Awaiting feed"],
          ["Volume","—","Awaiting feed"],
          ["Volatility","—","Awaiting feed"],
          ["Rates","—","Awaiting feed"],
          ["FX","—","Awaiting feed"],
          ["Commodities","—","Awaiting feed"],
          ["Options","—","Awaiting feed"],
          ["News","—","Timestamp gated"],
          ["Events","—","Calendar"],
          ["Data quality","PARTIAL","No inference"],
        ].map(([k,v,s]) => (
          <div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>
        ))}
      </div>

      <div className="nt-grid nt-grid-markets">
        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Sector breadth matrix</strong><span className="nt-panel-meta">chg · adv · MA · rvol</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th><th>&gt;50D</th><th>RVol</th></tr></thead>
              <tbody>{sectors.map((sector)=><tr key={sector}><td>{sector}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Cross-asset monitor</strong><span className="nt-panel-meta">macro context</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Asset</th><th>Last</th><th>Chg</th><th>Z</th></tr></thead>
              <tbody>{crossAsset.map((x)=><tr key={x}><td>{x}</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>
        </aside>

        <section className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Constituent heatmap / breadth surface</strong><span className="nt-panel-meta">price · sector · source</span></div>
            <div className="nt-panel-body">
              <div className="nt-heatmap">
                {heat.map(([symbol,sector])=>(
                  <div className="nt-heat-cell" key={symbol}>
                    <b>{symbol}</b><span className="nt-muted nt-mono">—</span><small>{sector}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="nt-kpi-row">
            {matrix.slice(0,6).map(([label,value,note])=>(
              <div className="nt-kpi" key={label}><div className="nt-label">{label}</div><div className="nt-kpi-value">{value}</div><div className="nt-kpi-note">{note}</div></div>
            ))}
          </div>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Market internals database</strong><span className="nt-panel-meta">breadth · vol · trend · options</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Field</th><th>Value</th><th>Prev</th><th>Δ</th><th>State</th><th>Source</th><th>As of</th></tr></thead>
              <tbody>{matrix.slice(6).map(([field])=><tr key={field}><td>{field}</td><td>—</td><td>—</td><td>—</td><td>Awaiting</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>
        </section>

        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Scan lists</strong><span className="nt-panel-meta">session</span></div>
            <table className="nt-microtable">
              <thead><tr><th>List</th><th>#</th><th>Lead</th></tr></thead>
              <tbody>{movers.map((m)=><tr key={m}><td>{m}</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Events / calendar</strong><span className="nt-panel-meta">ET · impact</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Event</th><th>Time</th><th>Impact</th></tr></thead>
              <tbody>{events.map((e)=><tr key={e}><td>{e}</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Feed health</strong><span className="nt-panel-meta">database coverage</span></div>
            <table className="nt-microtable">
              <tbody>
                {["Quotes","OHLC","Fundamentals","Estimates","Filings","News","Breadth","Options"].map(x=><tr key={x}><td>{x}</td><td className="nt-warning">PARTIAL</td><td>—</td></tr>)}
              </tbody>
            </table>
            <div className="nt-database-note">No directional state is generated from unavailable fields.</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
