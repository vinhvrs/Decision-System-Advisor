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
const overviewMetrics = ["market_cap", "pe_ttm", "roe", "gross_margin", "fcf_yield", "debt_to_equity"];

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

  return <div className="nt-workspace nt-full-workspace nt-company-workspace">
    <section className="nt-toolbar nt-company-toolbar">
      <div className="nt-company-heading">
        <h1>{profile?.company_name ?? normalized}</h1>
        <SymbolContext symbol={normalized} />
        <span>{profile?.exchange ?? ""}</span>
      </div>
      <form action="/companies" method="get"><label>Symbol <input name="symbol" value={search} required maxLength={20} onChange={event => setSearch(event.target.value.toUpperCase())} /></label><button type="submit">Open</button></form>
      <div className="nt-company-quote">
        <strong className="nt-mono">{valueText(quote?.price)}</strong>
        <span className={(quote?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{quote?.change_pct == null ? "—" : `${quote.change_pct > 0 ? "+" : ""}${valueText(quote.change_pct)}%`}</span>
        <small>{quote?.as_of?.slice(0,10) ?? ""}</small>
      </div>
    </section>

    <nav className="nt-tabs nt-company-tabs" aria-label="Company research views">
      {tabs.map(tab => <Link className="nt-tab" data-active={tab === activeTab} key={tab} href={`${tabBase}?view=${tab.toLowerCase()}`}>{tab}</Link>)}
    </nav>

    <section className="nt-company-metric-strip nt-flat-surface">
      <div className="nt-company-metric"><span>Last</span><b>{valueText(quote?.price)}</b></div>
      <div className="nt-company-metric"><span>Change</span><b className={(quote?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{quote?.change_pct == null ? "—" : `${quote.change_pct > 0 ? "+" : ""}${valueText(quote.change_pct)}%`}</b></div>
      {["market_cap","pe_ttm","roe","gross_margin","fcf_yield","debt_to_equity"].map(key => {
        const metric = fund.data?.metrics[key];
        return <div className="nt-company-metric" key={key}><span>{labelText(key)}</span><b>{valueText(metric?.value)}{metric?.unit ? ` ${metric.unit}` : ""}</b></div>;
      })}
    </section>

    {activeTab === "Overview" && <section className="nt-flat-surface nt-company-overview-grid">
      <div className="nt-subsection">
        <div className="nt-subsection-title"><strong>Company profile</strong><span>{profile?.sector ?? ""}</span></div>
        <table className="nt-microtable"><tbody>
          <tr><td>Sector</td><td>{profile?.sector ?? "—"}</td></tr>
          <tr><td>Industry</td><td>{profile?.industry ?? "—"}</td></tr>
          <tr><td>Description</td><td className="nt-cell-wrap">{profile?.description ?? "—"}</td></tr>
          <tr><td>Website</td><td>{profileUrl ? <a href={profileUrl} rel="noreferrer">{profileUrl}</a> : "—"}</td></tr>
          <tr><td>Latest filing</td><td>{filings.data?.data[0] ? <Link href={`${tabBase}?view=filings`}>{filings.data.data[0].form} · {filings.data.data[0].filing_date?.slice(0,10)}</Link> : "—"}</td></tr>
        </tbody></table>
      </div>
      <div className="nt-subsection">
        <div className="nt-subsection-title"><strong>Key fundamentals</strong><span>{fund.data?.as_of?.slice(0,10) ?? ""}</span></div>
        <table className="nt-microtable"><tbody>
          {overviewMetrics.map(key => {
            const metric = fund.data?.metrics[key];
            return <tr key={key}><td>{labelText(key)}</td><td>{valueText(metric?.value)}</td><td>{metric?.unit ?? ""}</td></tr>;
          })}
        </tbody></table>
        <div className="nt-inline-links">
          {(overview.data?.similar ?? []).slice(0,8).map(peer => <Link key={peer.symbol} href={`/companies/profile/${encodeURIComponent(peer.symbol)}`}>{peer.symbol}</Link>)}
        </div>
      </div>
    </section>}

    {activeTab === "KPIs" && <DataTable title="Key performance indicators" columns={["Metric", "Value", "Unit", "Basis"]}
      rows={Object.entries(fund.data?.metrics ?? {}).filter(([key]) => !valuation.has(key)).map(([key, metric]) => ({
        key, cells: [labelText(key), valueText(metric.value), metric.unit, metric.metadata?.basis],
      }))} empty="No KPI observations for this company." />}

    {activeTab === "Valuation" && <DataTable title="Valuation" columns={["Metric", "Value", "Unit", "Basis"]}
      rows={Object.entries(fund.data?.metrics ?? {}).filter(([key]) => valuation.has(key)).map(([key, metric]) => ({
        key, cells: [labelText(key), valueText(metric.value), metric.unit, metric.metadata?.basis],
      }))} empty="No valuation observations for this company." />}

    {activeTab === "Financials" && <>
      <div className="nt-inline-controls"><label>Reporting period <select value={period} onChange={event => setPeriod(event.target.value)}><option value="annual">Annual</option><option value="quarterly">Quarterly</option></select></label></div>
      <DataTable title="Financial statements" columns={["Fiscal period","Period end","Revenue","Gross profit","Operating income","Net income","Diluted EPS","FCF"]}
        rows={(financials.data?.data ?? []).map(row => ({ key: String(row.id), cells: [`FY${row.fiscal_year}${row.fiscal_quarter ? ` Q${row.fiscal_quarter}` : ""}`, row.period_end?.slice(0,10), ...[row.revenue,row.gross_profit,row.operating_income,row.net_income,row.eps_diluted,row.fcf].map(value => valueText(value == null ? null : Number(value)))] }))} empty="No statements for this reporting period." />
    </>}

    {activeTab === "Filings" && <DataTable title="SEC filings" columns={["Form","Filed","Reporting period","Document"]} rows={(filings.data?.data ?? []).map(filing => ({ key: filing.accession_number, cells: [filing.form, filing.filing_date?.slice(0,10), filing.report_date?.slice(0,10), <a key="sec" href={sourceLink(filing.filing_url)} rel="noreferrer">{filing.accession_number}</a>] }))} empty="No SEC filings for this symbol." />}

    {activeTab === "News" && <DataTable title="Company news" columns={["Published","Context","Headline","Publisher"]} rows={(news.data ?? []).map(item => ({ key: item.id, cells: [item.published_at, <SymbolContext key="context" symbol={item.symbol ?? normalized} />, <a key="article" className="nt-headline-link" href={sourceLink(item.source)} rel="noreferrer">{item.title}</a>, <SourceBadge key="source">{item.author ?? "Unknown"}</SourceBadge>] }))} empty="No recent company news." />}

    {activeTab === "Earnings" && <DataTable title="Macro events around the company context" columns={["Time","Country / Currency","Event","Importance","Actual","Forecast","Previous"]} rows={(calendar.data?.events ?? []).map(item => ({ key: item.id, cells: [item.scheduled_at, <CurrencyContext key="currency" currency={item.currency} />, item.title, <ImpactBadge key="impact" impact={item.impact} />, item.actual, item.forecast, item.previous] }))} empty="No scheduled macro events for this context." />}

    {activeTab === "Ownership" && <DataTable title="Ownership & positioning" columns={["Metric","Value"]} rows={(position.data?.data ?? []).map((item, index) => ({ key: String(index), cells: [item.metric_code ?? item.series_code, valueText(item.value)] }))} empty="No ownership or positioning observations." />}

    {activeTab === "Estimates" && <section className="nt-flat-surface">
      <div className="nt-subsection-title"><strong>Consensus estimates</strong><span>{normalized}</span></div>
      <div className="nt-empty nt-empty-compact">Consensus EPS, revenue, revisions and earnings-surprise history are not available for this symbol yet.</div>
    </section>}

    {activeTab === "Chart" && <section className="nt-flat-surface">
      <div className="nt-subsection-title"><strong>{normalized} chart</strong><span>{quote?.as_of?.slice(0,10) ?? ""}</span></div>
      <div className="nt-chart-handoff">
        <div><span>Last</span><b className="nt-mono">{valueText(quote?.price)}</b></div>
        <div><span>Change</span><b className={(quote?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{quote?.change_pct == null ? "—" : `${quote.change_pct > 0 ? "+" : ""}${valueText(quote.change_pct)}%`}</b></div>
        <div className="nt-inline-links"><Link href={`/investing?symbol=${id}`}>Open in Chart Lab ↗</Link><Link href={`/screener?q=${id}`}>Compare in Screener ↗</Link></div>
      </div>
    </section>}
  </div>;
}
