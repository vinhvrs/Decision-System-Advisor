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
  return <div className="nt-workspace">
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
    {activeTab === "Estimates" && <DataTable title="Consensus estimates" columns={["Dataset","Status"]} rows={[{ key: "estimates", cells: ["EPS, revenue, revisions and analyst coverage", "Missing point-in-time estimates feed"] }]} />}
    {activeTab === "Chart" && <div className="nt-toolbar"><Link href={`/investing?symbol=${id}`}>Open {normalized} in Chart Lab ↗</Link></div>}
  </div>;
}
