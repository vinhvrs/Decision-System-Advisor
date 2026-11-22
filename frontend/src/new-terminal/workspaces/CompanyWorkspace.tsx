"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DataTable from "../DataTable";
import { labelText, sourceLink, valueText, type Calendar, type Filing, type Metrics, type News, type Positioning } from "../feeds";
import { CurrencyContext, ImpactBadge, SourceBadge, SymbolContext } from "../ContextBadges";
import type { MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";

export type CompanyOverview = { profile?: { company_name?: string; industry?: string; exchange?: string; sector?: string; description?: string; website?: string }; similar?: { symbol: string; company_name: string }[] };
export type CompanyStatement = { id: number; fiscal_year: number; fiscal_quarter?: number; period_end: string; filing_date: string | null; source: string; revenue: string | null; gross_profit: string | null; operating_income: string | null; net_income: string | null; eps_diluted: string | null; fcf: string | null };
export type CompanyPriceBar = { timestamps: string; open: number; high: number; low: number; close: number; volume: number | null };
export type CompanyPeer = { symbol: string; name?: string; metrics?: Metrics; quote?: MarketRow };

type Props = {
  symbol?: string;
  activeTab?: string;
  initialOverview?: CompanyOverview;
  initialRows?: MarketRow[];
  initialFund?: Metrics;
  initialFinancials?: CompanyStatement[];
  initialOverviewFinancials?: CompanyStatement[];
  initialFilings?: Filing[];
  initialNews?: News[];
  initialHistory?: CompanyPriceBar[];
  initialPeers?: CompanyPeer[];
};

const tabs = ["Overview","Financials","KPIs","Estimates","Valuation","Earnings","Ownership","Filings","News","Chart"];
const valuation = new Set(["pe_ttm", "ev_ebitda", "ps_ratio", "pb_ratio", "fcf_yield", "market_cap"]);
const overviewMetrics = ["market_cap", "pe_ttm", "roe", "gross_margin", "fcf_yield", "debt_to_equity"];

const n = (value: string | number | null | undefined) => {
  const parsed = typeof value === "number" ? value : value == null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const compact = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(value);
const metricPercent = (metrics: Metrics | undefined, key: string) => {
  const datum = metrics?.metrics[key];
  if (datum?.value == null) return null;
  const value = datum.value;
  return datum.unit === "fraction" ? value * 100 : value;
};
const clamp = (value: number, min: number, max: number) => Math.max(0, Math.min(1, (value - min) / (max - min)));

function Sparkline({ values, width = 92, height = 24 }: { values: Array<number | null>; width?: number; height?: number }) {
  const valid = values.map((value,index)=>({value,index})).filter((item): item is {value:number;index:number} => item.value != null && Number.isFinite(item.value));
  if (valid.length < 2) return <span className="nt-muted">—</span>;
  const min = Math.min(...valid.map(item=>item.value));
  const max = Math.max(...valid.map(item=>item.value));
  const span = max - min || 1;
  const points = valid.map(item => {
    const x = 2 + item.index * ((width - 4) / Math.max(1, values.length - 1));
    const y = height - 3 - ((item.value - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <svg className="nt-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend sparkline"><polyline points={points} /></svg>;
}

function PriceMonitor({ bars, symbol }: { bars: CompanyPriceBar[]; symbol: string }) {
  const rows = bars.slice(-64);
  if (rows.length < 2) return <div className="nt-empty nt-empty-compact">No price history</div>;
  const closes = rows.map(row=>row.close);
  const min = Math.min(...closes), max = Math.max(...closes), span = max-min || 1;
  const width = 520, height = 178, plotH = 128;
  const line = rows.map((row,index)=> {
    const x = 8 + index * ((width-16)/Math.max(1,rows.length-1));
    const y = 8 + (1-(row.close-min)/span) * (plotH-16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const maxVol = Math.max(...rows.map(row=>row.volume ?? 0),1);
  const first = rows[0]?.close, last = rows.at(-1)?.close;
  const change = first ? ((last/first)-1)*100 : null;
  return <div className="nt-price-monitor">
    <div className="nt-monitor-meta"><span>{symbol} · 3M</span><b className={(change ?? 0)>=0?"nt-positive":"nt-negative"}>{pct(change)}</b></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${symbol} recent price and volume`}>
      <g className="nt-price-volume">{rows.map((row,index)=>{
        const x=8+index*((width-16)/Math.max(1,rows.length-1));
        const h=((row.volume ?? 0)/maxVol)*32;
        return <rect key={row.timestamps} x={x-1.5} y={height-h-4} width="3" height={h} />;
      })}</g>
      <polyline className="nt-price-line" points={line} />
    </svg>
    <div className="nt-monitor-axis"><span>{rows[0].timestamps.slice(5,10)}</span><span>{rows[Math.floor(rows.length/2)].timestamps.slice(5,10)}</span><span>{rows.at(-1)?.timestamps.slice(5,10)}</span></div>
  </div>;
}

function FinancialTrend({ rows }: { rows: CompanyStatement[] }) {
  const data=[...rows].sort((a,b)=>a.period_end.localeCompare(b.period_end)).slice(-8);
  if(data.length < 2) return <div className="nt-empty nt-empty-compact">No quarterly trend</div>;
  const revenue=data.map(row=>n(row.revenue) ?? 0);
  const op=data.map(row=>n(row.operating_income) ?? 0);
  const fcf=data.map(row=>n(row.fcf) ?? 0);
  const eps=data.map(row=>n(row.eps_diluted));
  const max=Math.max(...revenue,1);
  const width=640,height=214,base=176,slot=(width-54)/data.length;
  const validEps=eps.filter((v):v is number=>v!=null);
  const epsMin=validEps.length?Math.min(...validEps):0,epsMax=validEps.length?Math.max(...validEps):1,epsSpan=epsMax-epsMin||1;
  const epsPoints=eps.map((value,index)=>{
    if(value==null)return null;
    const x=36+index*slot+slot/2;
    const y=22+(1-(value-epsMin)/epsSpan)*116;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");
  return <svg className="nt-financial-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Quarterly revenue operating income free cash flow and EPS">
    {data.map((row,index)=>{
      const x=36+index*slot;
      const revH=(revenue[index]/max)*130,opH=(op[index]/max)*130,fcfH=(fcf[index]/max)*130;
      return <g key={row.id}>
        <rect className="nt-bar-revenue" x={x+slot*.12} y={base-revH} width={slot*.2} height={revH}/>
        <rect className="nt-bar-operating" x={x+slot*.38} y={base-opH} width={slot*.18} height={opH}/>
        <rect className="nt-bar-fcf" x={x+slot*.62} y={base-fcfH} width={slot*.18} height={fcfH}/>
        <text x={x+slot*.45} y={198} textAnchor="middle">{`Q${row.fiscal_quarter ?? 4}’${String(row.fiscal_year).slice(-2)}`}</text>
      </g>;
    })}
    {epsPoints && <polyline className="nt-eps-line" points={epsPoints}/>}
  </svg>;
}

function RadarSnapshot({ rows, metrics, history }: { rows: CompanyStatement[]; metrics?: Metrics; history: CompanyPriceBar[] }) {
  const ordered=[...rows].sort((a,b)=>b.period_end.localeCompare(a.period_end));
  const latest=ordered[0];
  const yearAgo=ordered.find(row=>row.fiscal_quarter===latest?.fiscal_quarter && row.fiscal_year===(latest?.fiscal_year ?? 0)-1) ?? ordered[4];
  const revenue=n(latest?.revenue), prevRevenue=n(yearAgo?.revenue);
  const revGrowth=revenue!=null&&prevRevenue?((revenue/prevRevenue)-1)*100:null;
  const gross=revenue?((n(latest?.gross_profit) ?? NaN)/revenue)*100:null;
  const operating=revenue?((n(latest?.operating_income) ?? NaN)/revenue)*100:null;
  const fcfMargin=revenue?((n(latest?.fcf) ?? NaN)/revenue)*100:null;
  const roe=metricPercent(metrics,"roe");
  const h=history.slice(-64);
  const momentum=h.length>1&&h[0].close?((h.at(-1)!.close/h[0].close)-1)*100:null;
  const axes=[
    ["Rev YoY",revGrowth,-20,40],
    ["Gross margin",gross,0,80],
    ["Op margin",operating,-10,50],
    ["FCF margin",fcfMargin,-10,40],
    ["ROE",roe,-20,100],
    ["Price 3M",momentum,-40,60],
  ] as const;
  const cx=118,cy=104,r=76;
  const points=axes.map((axis,index)=>{
    const angle=-Math.PI/2+index*(Math.PI*2/axes.length);
    const normalized=axis[1]==null?0:clamp(axis[1],axis[2],axis[3]);
    return {x:cx+Math.cos(angle)*r*normalized,y:cy+Math.sin(angle)*r*normalized,angle,...{label:axis[0],value:axis[1]}};
  });
  return <div className="nt-radar-wrap">
    <svg className="nt-radar" viewBox="0 0 236 208" role="img" aria-label="Company financial profile radar">
      {[.33,.66,1].map(level=><polygon key={level} className="nt-radar-grid" points={axes.map((_,index)=>{const a=-Math.PI/2+index*Math.PI*2/axes.length;return `${cx+Math.cos(a)*r*level},${cy+Math.sin(a)*r*level}`}).join(" ")}/>)}
      {axes.map((_,index)=>{const a=-Math.PI/2+index*Math.PI*2/axes.length;return <line key={index} className="nt-radar-axis" x1={cx} y1={cy} x2={cx+Math.cos(a)*r} y2={cy+Math.sin(a)*r}/>})}
      <polygon className="nt-radar-shape" points={points.map(point=>`${point.x},${point.y}`).join(" ")}/>
      {points.map((point,index)=><circle key={index} className="nt-radar-node" cx={point.x} cy={point.y} r="2.5"/>)}
    </svg>
    <table className="nt-microtable nt-radar-values"><tbody>{points.map(point=><tr key={point.label}><td>{point.label}</td><td>{point.value==null?"—":`${point.value.toFixed(1)}%`}</td></tr>)}</tbody></table>
  </div>;
}

export default function CompanyWorkspace({
  symbol = "AAPL", activeTab = "Overview", initialOverview, initialRows = [], initialFund,
  initialFinancials = [], initialOverviewFinancials = [], initialFilings = [], initialNews = [],
  initialHistory = [], initialPeers = [],
}: Props) {
  const normalized = symbol.trim().toUpperCase();
  const id = encodeURIComponent(normalized);
  const [search, setSearch] = useState(normalized);
  const [period, setPeriod] = useState("annual");
  const overview = useFeed<CompanyOverview>(`/api/companies/${id}/overview`, 300000);
  const stored = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const fund = useFeed<Metrics>(`/api/v1/sourced-fundamentals/${id}`, 300000);
  const financials = useFeed<{ data: CompanyStatement[] }>(activeTab === "Financials" ? `/api/fundamentals/${id}/${period}` : null, 300000);
  const overviewFinancials = useFeed<{ data: CompanyStatement[] }>(activeTab === "Overview" ? `/api/fundamentals/${id}/quarterly` : null, 300000);
  const filings = useFeed<{ data: Filing[] }>(activeTab === "Filings" || activeTab === "Overview" ? `/api/filings/${id}` : null, 120000);
  const news = useFeed<News[]>(activeTab === "News" || activeTab === "Overview" ? `/api/news/symbol/${id}` : null, 60000);
  const history = useFeed<{ data: CompanyPriceBar[] }>(activeTab === "Overview" ? `/api/market/daily-history/${id}?from=${new Date(Date.now()-140*86400000).toISOString().slice(0,10)}&to=${new Date().toISOString().slice(0,10)}` : null, 300000);
  const position = useFeed<Positioning>(activeTab === "Ownership" ? `/api/v1/positioning/${id}` : null, 300000);
  const calendar = useFeed<Calendar>(activeTab === "Earnings" ? `/api/v1/economic-calendar?symbol=${id}&limit=15` : null, 120000);

  const overviewData = overview.data ?? initialOverview;
  const storedRows = stored.data?.data ?? initialRows;
  const fundData = fund.data ?? initialFund;
  const financialRows = financials.data?.data ?? initialFinancials;
  const overviewFinancialRows = overviewFinancials.data?.data ?? initialOverviewFinancials;
  const filingRows = filings.data?.data ?? initialFilings;
  const newsRows = news.data ?? initialNews;
  const historyRows = history.data?.data ?? initialHistory;
  const profile = overviewData?.profile;
  const quote = storedRows.find(row => row.symbol === normalized);
  const profileUrl = sourceLink(profile?.website);
  const tabBase = `/companies/profile/${id}`;

  const quarterly = useMemo(()=>[...overviewFinancialRows].sort((a,b)=>b.period_end.localeCompare(a.period_end)),[overviewFinancialRows]);
  const quarterlyAsc = useMemo(()=>[...quarterly].reverse(),[quarterly]);
  const latest=quarterly[0];
  const latestRevenue=n(latest?.revenue);
  const latestGross=latestRevenue?((n(latest?.gross_profit) ?? NaN)/latestRevenue)*100:null;
  const latestOperating=latestRevenue?((n(latest?.operating_income) ?? NaN)/latestRevenue)*100:null;
  const latestFcf=latestRevenue?((n(latest?.fcf) ?? NaN)/latestRevenue)*100:null;
  const peerRows=[{symbol:normalized,name:profile?.company_name,metrics:fundData,quote},...initialPeers.filter(peer=>peer.symbol!==normalized)].slice(0,7);
  const events=[
    ...filingRows.slice(0,4).map(item=>({date:item.filing_date,type:item.form,title:`${item.form} filed`,detail:item.report_date?.slice(0,10) ?? ""})),
    ...newsRows.slice(0,5).map(item=>({date:item.published_at ?? "",type:"NEWS",title:item.title,detail:item.author ?? ""})),
  ].filter(item=>item.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);

  const metricStrip=[
    ["Mkt cap",fundData?.metrics.market_cap?.value,fundData?.metrics.market_cap?.unit],
    ["P/E TTM",fundData?.metrics.pe_ttm?.value,fundData?.metrics.pe_ttm?.unit],
    ["Gross margin",latestGross,"percent"],
    ["Op margin",latestOperating,"percent"],
    ["ROE",metricPercent(fundData,"roe"),"percent"],
    ["FCF margin",latestFcf,"percent"],
  ] as const;

  return <div className="nt-workspace nt-full-workspace nt-company-workspace">
    <section className="nt-company-research-head nt-flat-surface">
      <div className="nt-company-identity-row">
        <div className="nt-company-heading">
          <h1>{profile?.company_name ?? normalized}</h1>
          <SymbolContext symbol={normalized} />
          <span>{profile?.exchange ?? ""}</span>
          {profile?.sector && <span>Sector: {profile.sector}</span>}
          {profile?.industry && <span>Industry: {profile.industry}</span>}
        </div>
        <form action="/companies" method="get"><label>Symbol <input name="symbol" value={search} required maxLength={20} onChange={event => setSearch(event.target.value.toUpperCase())} /></label></form>
        <div className="nt-company-quote">
          <span>Last</span><strong className="nt-mono">{valueText(quote?.price)}</strong>
          <b className={(quote?.change_pct ?? 0)>=0?"nt-positive":"nt-negative"}>{quote?.change_pct==null?"—":`${quote.change_pct>0?"+":""}${quote.change_pct.toFixed(2)}%`}</b>
          <Sparkline values={historyRows.slice(-32).map(row=>row.close)} width={118} height={26}/>
        </div>
      </div>
      <div className="nt-company-head-metrics">
        {metricStrip.map(([label,value,unit])=><div key={label}><span>{label}</span><b>{value==null?"—":unit==="percent"?`${Number(value).toFixed(1)}%`:valueText(value)}{unit && !["percent","fraction"].includes(unit)?` ${unit}`:""}</b></div>)}
        <div><span>Latest filing</span><b>{filingRows[0]?`${filingRows[0].form} · ${filingRows[0].filing_date?.slice(0,10)}`:"—"}</b></div>
        <div><span>Latest news</span><b>{newsRows[0]?.published_at?.slice(0,16).replace("T"," ") ?? "—"}</b></div>
      </div>
    </section>

    <nav className="nt-tabs nt-company-tabs" aria-label="Company research views">
      {tabs.map(tab => <Link className="nt-tab" data-active={tab === activeTab} key={tab} href={`${tabBase}?view=${tab.toLowerCase()}`}>{tab}</Link>)}
    </nav>

    {activeTab === "Overview" && <>
      <section className="nt-company-visual-grid">
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Company snapshot</strong><span>actuals · axis scaled</span></div>
          <RadarSnapshot rows={quarterly} metrics={fundData} history={historyRows}/>
        </div>
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Financial trend</strong><span>quarterly</span></div>
          <div className="nt-company-chart-legend"><span>Revenue</span><span>Operating income</span><span>FCF</span><span>EPS</span></div>
          <FinancialTrend rows={quarterly}/>
        </div>
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Peer comparison</strong><span>{peerRows.length} companies</span></div>
          <table className="nt-microtable nt-peer-table"><thead><tr><th>Ticker</th><th>P/E</th><th>Gross</th><th>ROE</th><th>Chg%</th></tr></thead><tbody>
            {peerRows.map(peer=><tr key={peer.symbol} data-current={peer.symbol===normalized}>
              <td><Link href={`/companies/profile/${encodeURIComponent(peer.symbol)}`}>{peer.symbol}</Link></td>
              <td>{valueText(peer.metrics?.metrics.pe_ttm?.value)}</td>
              <td>{peer.metrics?(()=>{const v=metricPercent(peer.metrics,"gross_margin");return v==null?"—":`${v.toFixed(1)}%`})():"—"}</td>
              <td>{peer.metrics?(()=>{const v=metricPercent(peer.metrics,"roe");return v==null?"—":`${v.toFixed(1)}%`})():"—"}</td>
              <td className={(peer.quote?.change_pct ?? 0)>=0?"nt-positive":"nt-negative"}>{peer.quote?.change_pct==null?"—":`${peer.quote.change_pct>0?"+":""}${peer.quote.change_pct.toFixed(2)}%`}</td>
            </tr>)}
          </tbody></table>
        </div>
      </section>

      <section className="nt-company-monitor-grid">
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Company signals & event reaction</strong><span>filings + news</span></div>
          <div className="nt-company-event-body">
            <div className="nt-event-timeline">{events.map((item,index)=><div className="nt-event-row" key={`${item.date}-${index}`}><span className="nt-event-dot"/><time>{item.date.slice(0,10)}</time><b>{item.type}</b><span>{item.title}</span></div>)}</div>
            <div className="nt-event-price"><span>Price reaction · 3M</span><Sparkline values={historyRows.slice(-64).map(row=>row.close)} width={260} height={74}/></div>
          </div>
        </div>

        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Latest news</strong><span>{newsRows[0]?.published_at?.slice(11,16) ?? ""}</span></div>
          <table className="nt-microtable nt-company-news-table"><thead><tr><th>Time</th><th>Headline</th><th>Publisher</th></tr></thead><tbody>
            {newsRows.slice(0,7).map(item=><tr key={item.id}><td>{item.published_at?.slice(5,16).replace("T"," ") ?? "—"}</td><td><a href={sourceLink(item.source)} rel="noreferrer">{item.title}</a></td><td>{item.author ?? "—"}</td></tr>)}
            {!newsRows.length && <tr><td colSpan={3}>No recent company headlines</td></tr>}
          </tbody></table>
        </div>

        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Price monitor</strong><span>{quote?.as_of?.slice(0,10) ?? ""}</span></div>
          <PriceMonitor bars={historyRows} symbol={normalized}/>
        </div>
      </section>

      <section className="nt-flat-surface nt-company-financial-table">
        <div className="nt-subsection-title"><strong>Quarterly financials</strong><span>last 8 quarters</span></div>
        <div className="nt-table-wrap"><table className="nt-table"><thead><tr><th>Period</th><th>Revenue</th><th>Gross profit</th><th>GM</th><th>Operating income</th><th>OPM</th><th>Net income</th><th>EPS</th><th>FCF</th><th>Trend</th></tr></thead><tbody>
          {quarterly.slice(0,8).map(row=>{
            const rev=n(row.revenue),gross=n(row.gross_profit),op=n(row.operating_income);
            return <tr key={row.id}><td>{`FY${row.fiscal_year} Q${row.fiscal_quarter ?? 4}`}</td><td>{compact(rev)}</td><td>{compact(gross)}</td><td>{rev&&gross?`${(gross/rev*100).toFixed(1)}%`:"—"}</td><td>{compact(op)}</td><td>{rev&&op?`${(op/rev*100).toFixed(1)}%`:"—"}</td><td>{compact(n(row.net_income))}</td><td>{valueText(n(row.eps_diluted))}</td><td>{compact(n(row.fcf))}</td><td><Sparkline values={quarterlyAsc.map(item=>n(item.revenue))}/></td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="nt-company-bottom-research-grid">
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Recent SEC filings</strong><Link href={`${tabBase}?view=filings`}>View all ↗</Link></div>
          <table className="nt-microtable"><thead><tr><th>Date</th><th>Form</th><th>Reporting period</th></tr></thead><tbody>{filingRows.slice(0,6).map(item=><tr key={item.accession_number}><td>{item.filing_date?.slice(0,10)}</td><td><a href={sourceLink(item.filing_url)} rel="noreferrer">{item.form}</a></td><td>{item.report_date?.slice(0,10)}</td></tr>)}</tbody></table>
        </div>
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Company profile</strong><span>{profile?.sector ?? ""}</span></div>
          <table className="nt-microtable"><tbody><tr><td>Industry</td><td>{profile?.industry ?? "—"}</td></tr><tr><td>Website</td><td>{profileUrl?<a href={profileUrl} rel="noreferrer">{profileUrl}</a>:"—"}</td></tr><tr><td>Peers</td><td>{(overviewData?.similar ?? []).slice(0,5).map(peer=>peer.symbol).join(" · ") || "—"}</td></tr></tbody></table>
          <div className="nt-company-description">{profile?.description ?? ""}</div>
        </div>
        <div className="nt-flat-surface">
          <div className="nt-subsection-title"><strong>Financial pulse</strong><span>{fundData?.as_of?.slice(0,10) ?? ""}</span></div>
          <table className="nt-microtable"><tbody>{overviewMetrics.map(key=>{const metric=fundData?.metrics[key];return <tr key={key}><td>{labelText(key)}</td><td>{valueText(metric?.value)}</td><td>{metric?.unit ?? ""}</td></tr>})}</tbody></table>
        </div>
      </section>
    </>}

    {activeTab === "KPIs" && <DataTable title="Key performance indicators" columns={["Metric","Value","Unit","Basis"]} rows={Object.entries(fundData?.metrics ?? {}).filter(([key])=>!valuation.has(key)).map(([key,metric])=>({key,cells:[labelText(key),valueText(metric.value),metric.unit,metric.metadata?.basis]}))} empty="No KPI observations for this company." />}
    {activeTab === "Valuation" && <DataTable title="Valuation" columns={["Metric","Value","Unit","Basis"]} rows={Object.entries(fundData?.metrics ?? {}).filter(([key])=>valuation.has(key)).map(([key,metric])=>({key,cells:[labelText(key),valueText(metric.value),metric.unit,metric.metadata?.basis]}))} empty="No valuation observations for this company." />}
    {activeTab === "Financials" && <><div className="nt-inline-controls"><label>Reporting period <select value={period} onChange={event=>setPeriod(event.target.value)}><option value="annual">Annual</option><option value="quarterly">Quarterly</option></select></label></div><DataTable title="Financial statements" columns={["Fiscal period","Period end","Revenue","Gross profit","Operating income","Net income","Diluted EPS","FCF"]} rows={financialRows.map(row=>({key:String(row.id),cells:[`FY${row.fiscal_year}${row.fiscal_quarter?` Q${row.fiscal_quarter}`:""}`,row.period_end?.slice(0,10),...[row.revenue,row.gross_profit,row.operating_income,row.net_income,row.eps_diluted,row.fcf].map(value=>valueText(value==null?null:Number(value)))]}))} empty="No statements for this reporting period." /></>}
    {activeTab === "Filings" && <DataTable title="SEC filings" columns={["Form","Filed","Reporting period","Document"]} rows={filingRows.map(filing=>({key:filing.accession_number,cells:[filing.form,filing.filing_date?.slice(0,10),filing.report_date?.slice(0,10),<a key="sec" href={sourceLink(filing.filing_url)} rel="noreferrer">{filing.accession_number}</a>]}))} empty="No SEC filings for this symbol." />}
    {activeTab === "News" && <DataTable title="Company news" columns={["Published","Context","Headline","Publisher"]} rows={newsRows.map(item=>({key:item.id,cells:[item.published_at,<SymbolContext key="context" symbol={item.symbol ?? normalized}/>,<a key="article" className="nt-headline-link" href={sourceLink(item.source)} rel="noreferrer">{item.title}</a>,<SourceBadge key="source">{item.author ?? "Unknown"}</SourceBadge>]}))} empty="No recent company news." />}
    {activeTab === "Earnings" && <DataTable title="Macro events around the company context" columns={["Time","Country / Currency","Event","Importance","Actual","Forecast","Previous"]} rows={(calendar.data?.events ?? []).map(item=>({key:item.id,cells:[item.scheduled_at,<CurrencyContext key="currency" currency={item.currency}/>,item.title,<ImpactBadge key="impact" impact={item.impact}/>,item.actual,item.forecast,item.previous]}))} empty="No scheduled macro events for this context." />}
    {activeTab === "Ownership" && <DataTable title="Ownership & positioning" columns={["Metric","Value"]} rows={(position.data?.data ?? []).map((item,index)=>({key:String(index),cells:[item.metric_code ?? item.series_code,valueText(item.value)]}))} empty="No ownership or positioning observations." />}
    {activeTab === "Estimates" && <section className="nt-flat-surface"><div className="nt-subsection-title"><strong>Consensus estimates</strong><span>{normalized}</span></div><div className="nt-empty nt-empty-compact">Consensus estimates are not available for this symbol yet.</div></section>}
    {activeTab === "Chart" && <section className="nt-flat-surface"><div className="nt-subsection-title"><strong>{normalized} chart</strong><span>{quote?.as_of?.slice(0,10) ?? ""}</span></div><div className="nt-chart-handoff"><div><span>Last</span><b className="nt-mono">{valueText(quote?.price)}</b></div><div><span>Change</span><b className={(quote?.change_pct ?? 0)>=0?"nt-positive":"nt-negative"}>{quote?.change_pct==null?"—":`${quote.change_pct>0?"+":""}${valueText(quote.change_pct)}%`}</b></div><div className="nt-inline-links"><Link href={`/investing?symbol=${id}`}>Open in Chart Lab ↗</Link><Link href={`/screener?q=${id}`}>Compare in Screener ↗</Link></div></div></section>}
  </div>;
}
