const filters = [
  ["Descriptive",["Exchange","Sector","Industry","Country","Index"]],
  ["Fundamental",["Market Cap","P/E","Fwd P/E","ROE","Gross Margin","FCF Yield","Debt/Equity"]],
  ["Technical",["Above 20D","Above 50D","Above 200D","RSI","ATR%","52W Range"]],
  ["Liquidity",["Avg Volume","Rel Volume","Dollar Volume","Spread"]],
] as const;

const columns = ["Symbol","Company","Price","Chg%","Volume","RVol","Mkt Cap","P/E","Fwd P/E","ROE","GM","FCF Yld","D/E","RSI","ATR%","20D","50D","200D","52W","Source"];

export default function ScreenerWorkspace() {
  return (
    <div className="nt-workspace">
      <section className="nt-toolbar">
        <strong style={{fontSize:12}}>SCREENER / EQUITY DATABASE</strong>
        <span className="nt-chip"><b>Universe</b> US Equities</span>
        <span className="nt-chip"><b>Cap</b> &gt;$10B</span>
        <span className="nt-chip"><b>ROE</b> &gt;15%</span>
        <span className="nt-chip"><b>Avg Vol</b> &gt;1M</span>
        <span className="nt-chip"><b>Price</b> &gt;50D</span>
        <span style={{marginLeft:"auto"}} className="nt-label">0 VALIDATED / — TOTAL</span>
      </section>

      <div className="nt-dense-grid">
        {[
          ["Preset","Quality / Liquid","Screen"],
          ["Universe","US Equities","Primary"],
          ["Filters","5 active","Local state"],
          ["Sort","RVol desc","Pending"],
          ["Columns","20","Dense"],
          ["Selected","—","No row"],
          ["Compare","0","Max 4"],
          ["Export","Ready","CSV"],
          ["Price feed","PARTIAL","Status"],
          ["Fundamentals","PARTIAL","Status"],
          ["History","PARTIAL","Status"],
          ["Last refresh","—","Timestamp"],
        ].map(([k,v,s])=><div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
      </div>

      <div className="nt-grid nt-grid-screener">
        <aside className="nt-filters">
          <div className="nt-label" style={{marginBottom:7}}>Filter database</div>
          {filters.map(([group,items])=>(
            <div className="nt-filter-group" key={group}>
              <div className="nt-label">{group}</div>
              {items.map(item=><div className="nt-filter-item" key={item}><span>{item}</span><span className="nt-muted">+</span></div>)}
            </div>
          ))}
        </aside>

        <section className="nt-panel">
          <div className="nt-panel-title"><strong>Result database</strong><span className="nt-panel-meta">sortable · keyboard · compare</span></div>
          <div className="nt-table-wrap">
            <table className="nt-table" style={{minWidth:1850}}>
              <thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {Array.from({length:22}).map((_,i)=>(
                  <tr key={i}>
                    <td className="nt-symbol">—</td><td>Awaiting validated universe</td>
                    {columns.slice(2).map((c,j)=><td className="nt-mono" key={c+j}>—</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="nt-database-note">Missing fundamentals remain —. Missing price never becomes $0. No ranking is inferred from incomplete rows.</div>
        </section>

        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Linked symbol inspector</strong><span className="nt-panel-meta">same workspace</span></div>
            <div className="nt-panel-body">
              <div className="nt-split-3">
                {["Price","Chg%","RVol","Mkt Cap","P/E","ROE"].map(k=><div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">—</div></div>)}
              </div>
              <div className="nt-chart-canvas" style={{minHeight:180,marginTop:4}} />
            </div>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Fundamental quick scan</strong><span className="nt-panel-meta">selected row</span></div>
            <table className="nt-microtable"><tbody>
              {["Revenue growth","EPS growth","Gross margin","Operating margin","FCF margin","ROIC","Debt/EBITDA","Current ratio"].map(x=><tr key={x}><td>{x}</td><td>—</td><td>—</td></tr>)}
            </tbody></table>
          </section>
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Coverage / provenance</strong><span className="nt-panel-meta">selected row</span></div>
            <table className="nt-microtable"><tbody>
              {["Quote source","OHLC source","Fundamentals","Estimates","Filings","Last refresh"].map(x=><tr key={x}><td>{x}</td><td>—</td></tr>)}
            </tbody></table>
          </section>
        </aside>
      </div>
    </div>
  );
}
