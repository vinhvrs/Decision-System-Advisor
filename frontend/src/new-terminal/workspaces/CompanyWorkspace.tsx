"use client";

import Link from "next/link";
import { useState } from "react";
import DataTable from "../DataTable";
import { labelText, sourceLink, valueText, type Calendar, type Filing, type Metrics, type News, type Positioning } from "../feeds";
import { CurrencyContext, ImpactBadge, SourceBadge, SymbolContext } from "../ContextBadges";
import type { MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";

type Props = { symbol?: string; activeTab?: string };
type Overview = { profile?: { company_name?: string; industry?: string; exchange?: string; sector?: string; description?: string; website?: string }; similar?: { symbol: string; company_name: string }[] };
type Statement = { id: number; fiscal_year: number; fiscal_quarter?: number; period_end: string; filing_date: string | null; source: string; revenue: string | null; gross_profit: string | null; operating_income: string | null; net_income: string | null; eps_diluted: string | null; fcf: string | null };
const tabs = ["Overview","Financials","KPIs","Estimates","Valuation","Earnings","Ownership","Filings","News","Chart"];
const valuation = new Set(["pe_ttm", "ev_ebitda", "ps_ratio", "pb_ratio", "fcf_yield", "market_cap"]);

export default function CompanyWorkspace({ symbol = "AAPL", activeTab = "Overview" }: Props) {
  const normalized = symbol.trim().toUpperCase();
  const id = encodeURIComponent(normalized);
  const [search, setSearch] = useState(normalized);
  const [period, setPeriod] = useState("annual");
  const overview = useFeed<Overview>(`/api/companies/${id}/overview`);
  const stored = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const fund = useFeed<Metrics>(`/api/v1/sourced-fundamentals/${id}`);
  const financials = useFeed<{ data: Statement[] }>(activeTab === "Financials" ? `/api/fundamentals/${id}/${period}` : null);
  const filings = useFeed<{ data: Filing[] }>(activeTab === "Filings" || activeTab === "Overview" ? `/api/filings/${id}` : null);
  const news = useFeed<News[]>(activeTab === "News" ? `/api/news/symbol/${id}` : null);
  const position = useFeed<Positioning>(activeTab === "Ownership" ? `/api/v1/positioning/${id}` : null);
  const calendar = useFeed<Calendar>(activeTab === "Earnings" ? `/api/v1/economic-calendar?symbol=${id}&limit=15` : null);
  const profile = overview.data?.profile;
  const quote = stored.data?.data.find(row => row.symbol === normalized);
  const profileUrl = sourceLink(profile?.website);
  const tabBase = `/companies/profile/${id}`;
  const coverageRows = [
    ["Profile", overview.data ? "AVAILABLE" : overview.error ? "ERROR" : "AWAITING", profile?.exchange ?? "Company source"],
    ["Stored quote", quote ? "AVAILABLE" : "AWAITING", quote?.as_of ?? "No timestamp"],
    ["Fundamentals", fund.data ? fund.data.quality ?? "AVAILABLE" : fund.error ? "ERROR" : "AWAITING", fund.data?.as_of ?? "Source-backed metrics"],
    ["SEC filings", activeTab === "Filings" || activeTab === "Overview" ? (filings.data?.data.length ? "AVAILABLE" : filings.error ? "ERROR" : "AWAITING") : "ON DEMAND", filings.data?.data[0]?.filing_date?.slice(0,10) ?? "SEC"],
    ["Company news", activeTab === "News" ? (news.data?.length ? "AVAILABLE" : news.error ? "ERROR" : "AWAITING") : "ON DEMAND", news.data?.[0]?.published_at ?? "Timestamped feed"],
    ["Ownership", activeTab === "Ownership" ? (position.data?.data?.length ? "AVAILABLE" : position.error ? "ERROR" : "AWAITING") : "ON DEMAND", position.data?.reason ?? "Positioning source"],
    ["Macro events", activeTab === "Earnings" ? (calendar.data?.events?.length ? "AVAILABLE" : calendar.error ? "ERROR" : "AWAITING") : "ON DEMAND", calendar.data?.source ?? "Calendar"],
  ] as const;

  return <div className="nt-workspace nt-full-workspace nt-company-workspace">
    <section className="nt-toolbar">
      <h1>{profile?.company_name ?? normalized}</h1><SymbolContext symbol={normalized} /><span>{profile?.exchange ?? "Exchange unavailable"}</span>
      <form action="/companies" method="get"><label>Symbol <input name="symbol" value={search} required maxLength={20} onChange={event => setSearch(event.target.value.toUpperCase())} /></label> <button type="submit">Open</button></form>
      <strong>{valueText(quote?.price)} · {valueText(quote?.change_pct)}%</strong><span>{quote?.as_of ?? "Stored quote unavailable"}</span>
    </section>
    <nav className="nt-toolbar" aria-label="Company research views">{tabs.map(tab => <Link className="nt-tab" data-active={tab === activeTab} key={tab} href={`${tabBase}?view=${tab.toLowerCase()}`}>{tab}</Link>)}</nav>
    {activeTab === "Overview" && <DataTable title="Company profile" columns={["Field", "Value"]} rows={[
      { key: "sector", cells: ["Sector", profile?.sector] },
      { key: "industry", cells: ["Industry", profile?.industry] },
      { key: "description", cells: ["Business description", profile?.description] },
      { key: "website", cells: ["Website", profileUrl && <a href={profileUrl} rel="noreferrer">{profileUrl}</a>] },
      { key: "filing", cells: ["Latest SEC filing", filings.data?.data[0] ? `${filings.data.data[0].form} · ${filings.data.data[0].filing_date?.slice(0,10)}` : "No filing returned"] },
      { key: "peers", cells: ["Related companies", overview.data?.similar?.map(peer => <Link key={peer.symbol} href={`/companies/profile/${encodeURIComponent(peer.symbol)}`}>{peer.symbol} </Link>)] }
    ]} note={overview.error ?? "Profile, stored session and SEC filings have separate timestamps."} />}
    {["Overview", "KPIs", "Valuation"].includes(activeTab) && <DataTable title="Source-backed fundamentals" columns={["Metric", "Value", "Unit", "Basis", "Quality", "Source / missing data"]}
      rows={Object.entries(fund.data?.metrics ?? {}).filter(([key]) => activeTab === "Valuation" ? valuation.has(key) : activeTab === "KPIs" ? !valuation.has(key) : true).map(([key, metric]) => ({
        key, cells: [labelText(key), valueText(metric.value), metric.unit, metric.metadata?.basis, metric.quality, metric.reason ?? metric.metadata?.source ?? "Source unavailable"],
      }))} empty={fund.error ?? "No sourced fundamentals for this symbol."}
      note={activeTab === "KPIs" ? "Retention, ARPU, units, capacity and geographic breakdowns require company disclosure mapped to each issuer." : "Market multiples require a consistent as-of price and reported fundamentals. Forward multiples require consensus estimates."} />}
    {activeTab === "Financials" && <>
      <div className="nt-toolbar"><label>Reporting period <select value={period} onChange={event => setPeriod(event.target.value)}><option value="annual">Annual</option><option value="quarterly">Quarterly</option></select></label></div>
      <DataTable title="Filed financial statements" columns={["Fiscal period","Period end","Filed","Revenue","Gross profit","Operating income","Net income","Diluted EPS","FCF","Source"]}
        rows={(financials.data?.data ?? []).map(row => ({ key: String(row.id), cells: [`FY${row.fiscal_year}${row.fiscal_quarter ? ` Q${row.fiscal_quarter}` : ""}`, row.period_end?.slice(0,10), row.filing_date?.slice(0,10), ...[row.revenue,row.gross_profit,row.operating_income,row.net_income,row.eps_diluted,row.fcf].map(value => valueText(value == null ? null : Number(value))), row.source] }))} empty={financials.error ?? "No statements for this reporting period."} />
    </>}
    {activeTab === "Filings" && <DataTable title="SEC filings" columns={["Form","Filed","Reporting period","Document"]} rows={(filings.data?.data ?? []).map(filing => ({ key: filing.accession_number, cells: [filing.form, filing.filing_date?.slice(0,10), filing.report_date?.slice(0,10), <a key="sec" href={sourceLink(filing.filing_url)} rel="noreferrer">{filing.accession_number}</a>] }))} empty={filings.error ?? "No SEC filings for this symbol."} />}
    {activeTab === "News" && <DataTable title="Company news" columns={["Published","Context","Headline","Publisher"]} rows={(news.data ?? []).map(item => ({ key: item.id, cells: [item.published_at, <SymbolContext key="context" symbol={item.symbol ?? normalized} />, <a key="article" className="nt-headline-link" href={sourceLink(item.source)} rel="noreferrer">{item.title}</a>, <SourceBadge key="source">{item.author ?? "Unknown"}</SourceBadge>] }))} empty={news.error ?? "No timestamped articles for this symbol."} />}
    {activeTab === "Earnings" && <DataTable title="Macro calendar for the symbol's currency context" columns={["Time","Country / Currency","Event","Importance"]} rows={(calendar.data?.events ?? []).map(item => ({ key: item.id, cells: [item.scheduled_at, <CurrencyContext key="currency" currency={item.currency} />, item.title, <ImpactBadge key="impact" impact={item.impact} />] }))} empty={calendar.error ?? "No matching macro events."} note="This is a macro calendar. Importance is provider metadata, not a trading signal. Earnings dates, surprise and dividend schedules need a dedicated corporate-actions feed." />}
    {activeTab === "Ownership" && <DataTable title="Positioning coverage" columns={["Metric","Value","Source","Quality"]} rows={(position.data?.data ?? []).map((item, index) => ({ key: String(index), cells: [item.metric_code ?? item.series_code, valueText(item.value), item.source, item.quality] }))} empty={position.error ?? position.data?.reason ?? "No positioning observations."} note="Issuer ownership requires SEC 13F and Form 4 aggregation. CFTC positions describe mapped futures contracts." />}
    {activeTab === "Estimates" && <DataTable title="Consensus estimates coverage" columns={["Dataset","Status","Required observation"]} rows={[
      { key: "eps", cells: ["EPS consensus", "UNAVAILABLE", "Point-in-time analyst estimates by fiscal period"] },
      { key: "revenue", cells: ["Revenue consensus", "UNAVAILABLE", "Point-in-time revenue estimates"] },
      { key: "revisions", cells: ["30D / 90D revisions", "UNAVAILABLE", "Historical estimate snapshots"] },
      { key: "dispersion", cells: ["Estimate dispersion", "UNAVAILABLE", "Analyst-level low / median / high"] },
      { key: "coverage", cells: ["Analyst coverage", "UNAVAILABLE", "Contributor count and freshness"] },
      { key: "earnings-date", cells: ["Issuer earnings date", "UNAVAILABLE", "Dedicated corporate-events source"] },
      { key: "surprise", cells: ["Earnings surprise history", "UNAVAILABLE", "Actual vs point-in-time consensus"] },
      { key: "guidance", cells: ["Issuer guidance", "UNAVAILABLE", "Guidance ranges and revision history"] },
    ]} note="Unavailable estimate datasets remain explicit; they are not reconstructed from price action or stale snapshots." />}
    {activeTab === "Chart" && <>
      <DataTable title={`${normalized} · chart handoff`} columns={["Field","Value","State"]} rows={[
        { key: "price", cells: ["Stored price", valueText(quote?.price), quote ? "AVAILABLE" : "AWAITING"] },
        { key: "change", cells: ["Session change", quote?.change_pct == null ? "—" : `${valueText(quote.change_pct)}%`, quote ? "AVAILABLE" : "AWAITING"] },
        { key: "asof", cells: ["Quote timestamp", quote?.as_of, quote?.as_of ? "TIMESTAMPED" : "AWAITING"] },
        { key: "history", cells: ["Daily OHLCV", "Open in Chart Lab", "SOURCE-AWARE"] },
        { key: "indicators", cells: ["Derived indicators", fund.data?.quality ?? "—", fund.data ? "COVERAGE KNOWN" : "AWAITING"] },
      ]} note="The full time-series workspace is kept in Chart Lab so company research retains its current symbol context without duplicating chart state." />
      <div className="nt-toolbar nt-company-chart-actions"><Link href={`/investing?symbol=${id}`}>Open {normalized} in full Chart Lab ↗</Link><Link href={`/screener?q=${id}`}>Compare in Screener ↗</Link></div>
    </>}

    <div className="nt-company-bottom-grid">
      <section className="nt-panel">
        <div className="nt-panel-title"><strong>Research coverage</strong><span className="nt-panel-meta">current symbol</span></div>
        <table className="nt-microtable"><thead><tr><th>Dataset</th><th>State</th><th>Source / as of</th></tr></thead><tbody>
          {coverageRows.map(([dataset,state,source]) => <tr key={dataset}><td>{dataset}</td><td className={state === "AVAILABLE" ? "nt-positive" : state === "ERROR" ? "nt-negative" : state === "AWAITING" ? "nt-warning" : "nt-muted"}>{state}</td><td>{source}</td></tr>)}
        </tbody></table>
      </section>

      <section className="nt-panel">
        <div className="nt-panel-title"><strong>Linked research</strong><span className="nt-panel-meta">same symbol context</span></div>
        <table className="nt-microtable"><tbody>
          <tr><td>Company overview</td><td><Link href={tabBase}>Open ↗</Link></td></tr>
          <tr><td>Financial statements</td><td><Link href={`${tabBase}?view=financials`}>Open ↗</Link></td></tr>
          <tr><td>SEC filings</td><td><Link href={`${tabBase}?view=filings`}>Open ↗</Link></td></tr>
          <tr><td>News / events</td><td><Link href={`${tabBase}?view=news`}>Open ↗</Link></td></tr>
          <tr><td>Chart Lab</td><td><Link href={`/investing?symbol=${id}`}>Open ↗</Link></td></tr>
          <tr><td>Screener context</td><td><Link href={`/search?q=${id}`}>Open ↗</Link></td></tr>
        </tbody></table>
      </section>

      <section className="nt-panel">
        <div className="nt-panel-title"><strong>Integrity rules</strong><span className="nt-panel-meta">research contract</span></div>
        <table className="nt-microtable"><tbody>
          <tr><td>Missing values</td><td>Remain —</td></tr>
          <tr><td>Unavailable feeds</td><td>Explicit state</td></tr>
          <tr><td>Derived metrics</td><td>Source + as-of</td></tr>
          <tr><td>Forward estimates</td><td>No synthetic fill</td></tr>
          <tr><td>Directional labels</td><td>No inference from missing</td></tr>
          <tr><td>Cross-workspace symbol</td><td>{normalized}</td></tr>
        </tbody></table>
      </section>
    </div>
  </div>;
}
