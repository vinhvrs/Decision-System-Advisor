"use client";

import Link from "next/link";
import { useMemo } from "react";

const tabs=["Overview","Financials","KPIs","Estimates","Valuation","Earnings","Ownership","Filings","News","Chart"];

type Props={symbol?:string;activeTab?:string};

function MicroRows({rows}:{rows:Array<[string,string,string]>}) {
  return <>{rows.map(([a,b,c])=><tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</>;
}

export default function CompanyWorkspace({symbol="AAPL",activeTab="Overview"}:Props){
  const normalized=useMemo(()=>symbol.toUpperCase(),[symbol]);
  const overview=activeTab.toLowerCase()==="overview";

  return (
    <div className="nt-workspace">
      <header className="nt-company-head">
        <div className="nt-company-summary">
          <div className="nt-company-name">
            <span className="nt-company-mark">{normalized.slice(0,1)}</span>
            <div><h1>{normalized}</h1><p>Company database · identity / quote / filing / coverage</p></div>
          </div>
          <div><div className="nt-price">—</div><div className="nt-label" style={{marginTop:3}}>Price · awaiting source</div></div>
          <div className="nt-top-context"><span>NASDAQ</span><span>USD</span><span>Watchlist</span><span>Compare</span><span className="nt-status-warn">PARTIAL</span></div>
        </div>
        <nav className="nt-tabs">
          {tabs.map(tab=><Link key={tab} href={tab==="Overview"?`/companies/profile/${normalized.toLowerCase()}`:`/companies/profile/${normalized.toLowerCase()}?view=${tab.toLowerCase()}`} className="nt-tab" data-active={activeTab.toLowerCase()===tab.toLowerCase()}>{tab}</Link>)}
        </nav>
      </header>

      <div className="nt-dense-grid">
        {[
          ["Symbol",normalized,"Primary ID"],["Exchange","NASDAQ","Pending verify"],["Sector","—","Profile"],
          ["Industry","—","Profile"],["Market cap","—","Quote/fundamental"],["Enterprise value","—","Derived"],
          ["Shares out","—","Reported"],["Float","—","Reported"],["Short interest","—","Coverage gated"],
          ["Next earnings","—","Calendar"],["Latest filing","—","SEC"],["Data quality","PARTIAL","No inference"]
        ].map(([k,v,s])=><div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
      </div>

      {overview ? (
        <div className="nt-grid nt-grid-company">
          <div className="nt-section-stack">
            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Financial statement snapshot</strong><span className="nt-panel-meta">reported · annual / TTM</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Metric</th><th>Latest</th><th>Prev</th><th>YoY</th><th>5Y</th></tr></thead>
                <tbody><MicroRows rows={[
                  ["Revenue","—","—","—"],["Gross profit","—","—","—"],["Operating income","—","—","—"],
                  ["Net income","—","—","—"],["Diluted EPS","—","—","—"],["Free cash flow","—","—","—"],
                  ["Gross margin","—","—","—"],["Operating margin","—","—","—"],["FCF margin","—","—","—"],
                ].map(r=>[r[0],r[1],r[2]]) as Array<[string,string,string]>}/></tbody>
              </table>
            </section>

            <div className="nt-split-2">
              <section className="nt-panel">
                <div className="nt-panel-title"><strong>Operating KPI database</strong><span className="nt-panel-meta">company-specific</span></div>
                <table className="nt-microtable"><tbody>
                  <MicroRows rows={[
                    ["Primary KPI","—","Awaiting"],["Secondary KPI","—","Awaiting"],["Units / users","—","Awaiting"],
                    ["ARPU / pricing","—","Awaiting"],["Retention","—","If available"],["Capacity / utilization","—","If available"],
                    ["Margin KPI","—","Awaiting"],["Geographic mix","—","Awaiting"]
                  ]}/>
                </tbody></table>
              </section>
              <section className="nt-panel">
                <div className="nt-panel-title"><strong>Growth / efficiency</strong><span className="nt-panel-meta">trend matrix</span></div>
                <table className="nt-microtable"><tbody>
                  <MicroRows rows={[
                    ["Revenue CAGR 3Y","—","—"],["EPS CAGR 3Y","—","—"],["FCF CAGR 3Y","—","—"],["ROE","—","—"],
                    ["ROIC","—","—"],["Asset turnover","—","—"],["R&D / Sales","—","—"],["Capex / Sales","—","—"]
                  ]}/>
                </tbody></table>
              </section>
            </div>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Quarterly trend database</strong><span className="nt-panel-meta">8 periods · source aligned</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Metric</th><th>Q-7</th><th>Q-6</th><th>Q-5</th><th>Q-4</th><th>Q-3</th><th>Q-2</th><th>Q-1</th><th>Latest</th></tr></thead>
                <tbody>{["Revenue","EPS","Gross margin","Op margin","FCF","Shares"].map(x=><tr key={x}><td>{x}</td>{Array.from({length:8}).map((_,i)=><td key={i}>—</td>)}</tr>)}</tbody>
              </table>
            </section>
          </div>

          <div className="nt-section-stack">
            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Valuation database</strong><span className="nt-panel-meta">current · history · peers</span></div>
              <table className="nt-microtable"><thead><tr><th>Multiple</th><th>Now</th><th>5Y med</th><th>Pctl</th></tr></thead><tbody>
                {["P/E","Fwd P/E","EV/EBITDA","P/S","P/B","FCF Yield","PEG"].map(x=><tr key={x}><td>{x}</td><td>—</td><td>—</td><td>—</td></tr>)}
              </tbody></table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Estimates / revisions</strong><span className="nt-panel-meta">actual vs consensus</span></div>
              <table className="nt-microtable"><thead><tr><th>Period</th><th>EPS</th><th>Rev</th><th>30D</th></tr></thead><tbody>
                {["Q+1","Q+2","FY+1","FY+2"].map(x=><tr key={x}><td>{x}</td><td>—</td><td>—</td><td>—</td></tr>)}
              </tbody></table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Capital structure</strong><span className="nt-panel-meta">balance sheet</span></div>
              <table className="nt-microtable"><tbody>
                <MicroRows rows={[["Cash","—","—"],["Total debt","—","—"],["Net debt","—","—"],["D/E","—","—"],["Current ratio","—","—"],["Buyback TTM","—","—"],["Dividend yield","—","—"]]}/>
              </tbody></table>
            </section>
          </div>

          <aside className="nt-section-stack">
            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Ownership / flow</strong><span className="nt-panel-meta">13F · Form 4</span></div>
              <table className="nt-microtable"><tbody>
                <MicroRows rows={[["Institutional","—","—"],["Insider","—","—"],["13F net flow","—","—"],["Top holder","—","—"],["Insider buys","—","—"],["Insider sells","—","—"]]}/>
              </tbody></table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Earnings / events</strong><span className="nt-panel-meta">calendar</span></div>
              <table className="nt-microtable"><tbody>
                <MicroRows rows={[["Next earnings","—","—"],["EPS consensus","—","—"],["Revenue consensus","—","—"],["Last surprise","—","—"],["Ex-dividend","—","—"],["Investor event","—","—"]]}/>
              </tbody></table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Filings / documents</strong><span className="nt-panel-meta">SEC</span></div>
              <table className="nt-microtable"><tbody>
                <MicroRows rows={[["Latest 10-K","—","—"],["Latest 10-Q","—","—"],["Latest 8-K","—","—"],["Latest Form 4","—","—"],["Transcript","—","—"],["Presentation","—","—"]]}/>
              </tbody></table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Coverage matrix</strong><span className="nt-panel-meta">provenance</span></div>
              <table className="nt-microtable"><tbody>
                {["Quote","OHLC","Financials","KPIs","Estimates","Ownership","Filings","News"].map(x=><tr key={x}><td>{x}</td><td className="nt-warning">PARTIAL</td><td>—</td></tr>)}
              </tbody></table>
              <div className="nt-database-note">Every important metric carries source / as-of / coverage state before production.</div>
            </section>
          </aside>
        </div>
      ):<ResearchSection activeTab={activeTab}/>}
    </div>
  );
}

function ResearchSection({activeTab}:{activeTab:string}){
  const fields=["Metric / Period","Reported","Previous","Change","Consensus","Low","High","Coverage","Source","As of"];
  return (
    <div className="nt-grid" style={{gridTemplateColumns:"minmax(0,1fr) 290px"}}>
      <section className="nt-panel">
        <div className="nt-panel-title"><strong>{activeTab} database</strong><span className="nt-panel-meta">dense source-aligned table</span></div>
        <div className="nt-table-wrap"><table className="nt-table" style={{minWidth:1200}}>
          <thead><tr>{fields.map(x=><th key={x}>{x}</th>)}</tr></thead>
          <tbody>{Array.from({length:22}).map((_,i)=><tr key={i}><td>Awaiting source field</td>{fields.slice(1).map((x,j)=><td className="nt-mono" key={x+j}>—</td>)}</tr>)}</tbody>
        </table></div>
        <div className="nt-database-note">No zero-fill, no inferred signal, no synthetic consensus when coverage is insufficient.</div>
      </section>
      <aside className="nt-section-stack">
        <section className="nt-panel"><div className="nt-panel-title"><strong>Selected record</strong><span className="nt-panel-meta">metadata</span></div><table className="nt-microtable"><tbody>
          <MicroRows rows={[["Value","—","—"],["Period","—","—"],["Source","—","—"],["As of","—","—"],["Coverage","—","—"],["Quality","—","—"]]}/>
        </tbody></table></section>
        <section className="nt-panel"><div className="nt-panel-title"><strong>History</strong><span className="nt-panel-meta">time series</span></div><div className="nt-panel-body"><div className="nt-chart-canvas" style={{minHeight:240}}/></div></section>
      </aside>
    </div>
  );
}
