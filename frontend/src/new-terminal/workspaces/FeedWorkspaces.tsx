"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DataTable from "../DataTable";
import { labelText, sourceLink, valueText, type Calendar, type Filing, type Health, type Metrics, type News, type Technical, type Universe } from "../feeds";
import { CurrencyContext, ImpactBadge, SourceBadge, SymbolContext } from "../ContextBadges";
import { useFeed } from "../useFeed";

export function NewsWorkspace() {
  const [page, setPage] = useState(1);
  const news = useFeed<{ data: News[]; last_page: number }>(`/api/news?page=${page}`);
  const calendar = useFeed<Calendar>("/api/v1/economic-calendar?limit=30");
  const eventCounts = (calendar.data?.events ?? []).reduce((acc, item) => {
    const key = item.impact?.toLowerCase().includes("high") ? "high" : item.impact?.toLowerCase().includes("med") ? "medium" : "low";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return <div className="nt-workspace nt-news-workspace">
    <section className="nt-context-strip">
      <div className="nt-context-title"><div className="nt-label nt-info">News / Events</div><h1>Market Information Feed</h1></div>
      <div className="nt-news-stat"><span>HEADLINES</span><b>{news.data?.data?.length ?? "—"}</b></div>
      <div className="nt-news-stat"><span>EVENTS</span><b>{calendar.data?.events?.length ?? "—"}</b></div>
      <div className="nt-news-stat"><span>HIGH</span><b className="nt-negative">{eventCounts.high ?? 0}</b></div>
      <div className="nt-news-stat"><span>MED</span><b className="nt-warning">{eventCounts.medium ?? 0}</b></div>
      <div className="nt-news-stat"><span>LOW</span><b className="nt-info">{eventCounts.low ?? 0}</b></div>
      <div className="nt-news-stat"><span>SOURCE</span><b>{calendar.data?.source ?? "—"}</b></div>
    </section>

    <DataTable title="Market headlines" columns={["Published", "Context", "Symbol", "Headline", "Publisher"]}
      rows={(news.data?.data ?? []).filter(item => item.published_at).map(item => ({
        key: item.id,
        cells: [
          item.published_at,
          <SymbolContext key="context" symbol={item.symbol} />,
          item.symbol || "—",
          <a key="article" className="nt-headline-link" href={sourceLink(item.source)} rel="noreferrer">{item.title}</a>,
          <SourceBadge key="source">{item.author ?? "Unknown"}</SourceBadge>,
        ],
      }))}
      empty={news.error ?? "No timestamped headlines returned."}
      note="Context badges are derived only from explicit symbol format or the tracked US-equity universe; unclassified stories remain global." />

    <div className="nt-toolbar nt-news-pager"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" disabled={!news.data || page >= news.data.last_page} onClick={() => setPage(page + 1)}>Next</button></div>

    <DataTable title="Economic calendar" columns={["Scheduled", "Country / Currency", "Event", "Importance", "Actual", "Forecast", "Previous"]}
      rows={(calendar.data?.events ?? []).map(item => ({
        key: item.id,
        cells: [
          item.scheduled_at,
          <CurrencyContext key="currency" currency={item.currency} />,
          item.title,
          <ImpactBadge key="impact" impact={item.impact} />,
          item.actual,
          item.forecast,
          item.previous,
        ],
      }))}
      empty={calendar.error ?? "No event records returned."}
      note={calendar.data ? `Source: ${calendar.data.source}. ${calendar.data.stale ? "Calendar snapshot is stale. " : ""}HIGH/MED/LOW colors represent provider importance only; they are not a trading signal.` : undefined} />
  </div>;
}

export function IndicatorsWorkspace() {
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("daily");
  const id = encodeURIComponent(symbol);
  const metrics = useFeed<Metrics>(`/api/v1/metrics/${id}?timeframe=${period}`);
  const technical = useFeed<Technical>(metrics.data && metrics.data.quality !== "LICENSE_RESTRICTED" ? `/api/v1/technical/${id}?period=${period}` : null);
  return <div className="nt-workspace">
    <section className="nt-toolbar"><h1>Indicators</h1><label>Symbol <select value={symbol} onChange={event => setSymbol(event.target.value)}>{[...new Set(["AAPL", ...(universe.data?.data ?? []).map(row => row.symbol)])].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Period <select value={period} onChange={event => setPeriod(event.target.value)}><option value="daily">Daily</option><option value="30m">30 minutes</option></select></label></section>
    <DataTable title="Published metric snapshot" columns={["Indicator", "Value", "Unit", "Quality", "Reason"]}
      rows={Object.entries(metrics.data?.metrics ?? {}).map(([key, item]) => ({ key, cells: [labelText(key), valueText(item.value), item.unit, item.quality, item.reason] }))}
      empty={metrics.error ?? "No metric snapshot for this symbol and period."}
      note={metrics.data?.as_of ? `Snapshot as of ${metrics.data.as_of}. Null values follow backend coverage and publication rights.` : undefined} />
    <DataTable title="Technical indicator registry" columns={["Indicator", "Value", "Status"]}
      rows={Object.entries(technical.data?.indicators ?? {}).map(([key, item]) => ({ key, cells: [labelText(key), typeof item.value === "object" && item.value ? Object.entries(item.value).map(([name, value]) => `${name}: ${valueText(value)}`).join(" · ") : valueText(item.value), item.status] }))}
      empty={metrics.data?.quality === "LICENSE_RESTRICTED" ? "Historical fallback source does not permit public redistribution of these derived values." : technical.error ?? "No technical registry returned."} />
  </div>;
}

export function DocumentsWorkspace() {
  const [symbol, setSymbol] = useState("AAPL");
  const [query, setQuery] = useState("AAPL");
  const filings = useFeed<{ data: Filing[] }>(`/api/filings/${encodeURIComponent(symbol)}`);
  const health = useFeed<Health>("/api/v1/data-health", 60000);
  return <div className="nt-workspace">
    <section className="nt-toolbar"><h1>Documents & Data Coverage</h1><form onSubmit={event => { event.preventDefault(); setSymbol(query.trim()); }}><label>SEC ticker <input value={query} required pattern="[A-Za-z]{1,12}" onChange={event => setQuery(event.target.value.toUpperCase())} /></label> <button type="submit">Find filings</button></form></section>
    <DataTable title={`${symbol} · SEC filings`} columns={["Form", "Filed", "Report period", "SEC document"]}
      rows={(filings.data?.data ?? []).map(item => ({ key: item.accession_number, cells: [item.form, item.filing_date?.slice(0,10), item.report_date?.slice(0,10), <a key="sec" href={sourceLink(item.filing_url)} rel="noreferrer">{item.accession_number}</a>] }))}
      empty={filings.error ?? "No SEC filing records returned."} />
    <DataTable title="Backend source health" columns={["Source", "Status", "Last data", "Error"]}
      rows={(health.data?.sources ?? []).map(item => ({ key: item.source_code, cells: [item.source_code, item.status, item.last_data_at, item.last_error] }))}
      empty={health.error ?? "No source observations returned."}
      note={health.data ? `${health.data.pipeline.covered}/${health.data.pipeline.total} instruments covered by the pipeline. Updated ${health.data.generated_at}.` : undefined} />
    <DataTable title="Missing datasets and inputs" columns={["Area", "Source / input needed"]}
      rows={[
        ["Options", "Listed option chains with greeks, open interest and timestamped quotes for IV, skew, term structure, put/call and gamma charts."],
        ["Estimates and earnings", "Point-in-time analyst consensus, revisions, issuer earnings dates, surprises and corporate actions."],
        ["Ownership", "Issuer mapping and normalized SEC 13F/Form 4, ownership history, free float and short interest."],
        ["Market breadth and liquidity", "Full exchange/index membership, certified daily and intraday bars, trade direction, bid/ask depth and historical denominators."],
        ["Macro and events", "Series and release vintages for missing yields, credit spreads, commodities, real rates and historical surprises. Calendar does not replace issuer events."],
        ["Company operating KPIs", "Issuer disclosure, segment series and comparable KPI definitions for units, ARPU, retention and geographic mix."],
        ["Price history", "A provider with redistribution rights for gated indicators, benchmark returns and correlations."],
        ["Documents", "Transcript and presentation feeds linked to issuer and period."],
      ].map(([area, note]) => ({ key: area, cells: [area, note] }))} />
  </div>;
}

export function WatchlistsWorkspace() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(localStorage.getItem("accessToken")); }, []);
  return <WatchlistEditor token={token} />;
}

function WatchlistEditor({ token }: { token: string | null }) {
  const [items, setItems] = useState<{ symbol: string; created_at?: string }[]>([]);
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch("/api/watchlist?with_positions=false", { signal: controller.signal, cache: "no-store", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Sign in again." : "Watchlist API unavailable.");
        const data = await response.json();
        if (!controller.signal.aborted) setItems(Array.isArray(data.data ?? data) ? data.data ?? data : []);
      }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [token, revision]);

  async function update(method: "POST" | "DELETE", value: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(method === "POST" ? "/api/watchlist" : `/api/watchlist/${encodeURIComponent(value)}`, {
        method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ symbol: value }) : undefined,
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Sign in again." : "Could not update the watchlist.");
      setSymbol("");
      setRevision(current => current + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Watchlist update failed."); }
    finally { setBusy(false); }
  }
  return <div className="nt-workspace"><h1>Watchlists</h1>
    {!token ? <p>Sign in to load saved symbols from the Pi account database. <Link href="/auth/login">Sign in ↗</Link></p> : <form className="nt-toolbar" onSubmit={event => { event.preventDefault(); void update("POST", symbol.trim()); }}>
      <label>Symbol <input required maxLength={20} value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} /></label> <button type="submit" disabled={busy}>Save symbol</button>
    </form>}
    {error && <p role="status">{error} <Link href="/auth/login">Sign in ↗</Link></p>}
    {token && <DataTable title="Saved symbols" columns={["Symbol", "Saved", "Action"]} rows={items.map(item => ({ key: item.symbol, cells: [<Link key="symbol" href={`/investing?symbol=${encodeURIComponent(item.symbol)}`}>{item.symbol}</Link>, item.created_at, <button key="remove" type="button" disabled={busy} onClick={() => void update("DELETE", item.symbol)}>Remove</button>] }))} />}
  </div>;
}
