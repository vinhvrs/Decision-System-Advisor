"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DataTable from "../DataTable";
import { labelText, sourceLink, valueText, type Calendar, type DailyAnalytics, type Filing, type Metrics, type News, type Technical, type Universe } from "../feeds";
import { CurrencyContext, ImpactBadge, SourceBadge, SymbolContext } from "../ContextBadges";
import { useFeed } from "../useFeed";
import type { MarketRow } from "../marketSnapshot";

export function NewsWorkspace() {
  const [page, setPage] = useState(1);
  const news = useFeed<{ data: News[]; last_page: number }>(`/api/news?page=${page}`);
  const calendar = useFeed<Calendar>("/api/v1/economic-calendar?limit=30");
  const market = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const marketMovers = [...(market.data?.data ?? [])]
    .filter(row => row.market === "stock" && row.change_pct != null)
    .sort((a,b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0,8);
  const eventCounts = (calendar.data?.events ?? []).reduce((acc, item) => {
    const key = item.impact?.toLowerCase().includes("high") ? "high" : item.impact?.toLowerCase().includes("med") ? "medium" : "low";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return <div className="nt-workspace nt-full-workspace nt-news-workspace">
    <section className="nt-context-strip">
      <div className="nt-context-title"><div className="nt-label nt-info">News / Events</div><h1>Market Information Feed</h1></div>
      <div className="nt-news-stat"><span>HEADLINES</span><b>{news.data?.data?.length ?? "—"}</b></div>
      <div className="nt-news-stat"><span>EVENTS</span><b>{calendar.data?.events?.length ?? "—"}</b></div>
      <div className="nt-news-stat"><span>HIGH</span><b className="nt-negative">{eventCounts.high ?? 0}</b></div>
      <div className="nt-news-stat"><span>MED</span><b className="nt-warning">{eventCounts.medium ?? 0}</b></div>
      <div className="nt-news-stat"><span>LOW</span><b className="nt-info">{eventCounts.low ?? 0}</b></div>
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
      empty="No recent headlines."
      note="Context badges are derived only from explicit symbol format or the tracked US-equity universe; unclassified stories remain global." />

    <div className="nt-toolbar nt-news-pager"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" disabled={!news.data || page >= news.data.last_page} onClick={() => setPage(page + 1)}>Next</button></div>

    <DataTable title="Market movers" columns={["Symbol","Last","Change %","Traded value"]}
      rows={marketMovers.map(row => ({ key: row.symbol, cells: [
        <SymbolContext key="symbol" symbol={row.symbol} />,
        valueText(row.price),
        row.change_pct == null ? "—" : `${row.change_pct > 0 ? "+" : ""}${valueText(row.change_pct)}%`,
        valueText(row.traded_value),
      ] }))}
      empty="No session movers." />

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
      empty="No scheduled economic events." />
  </div>;
}

export function IndicatorsWorkspace() {
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const snapshot = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const daily = useFeed<DailyAnalytics>("/api/market/daily-analytics", 300000);
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("daily");
  const id = encodeURIComponent(symbol);
  const metrics = useFeed<Metrics>(`/api/v1/metrics/${id}?timeframe=${period}`);
  const technical = useFeed<Technical>(metrics.data && metrics.data.quality !== "LICENSE_RESTRICTED" ? `/api/v1/technical/${id}?period=${period}` : null);
  const metricEntries = Object.entries(metrics.data?.metrics ?? {});
  const technicalEntries = Object.entries(technical.data?.indicators ?? {});
  const availableMetricCount = metricEntries.filter(([, item]) => item.value != null).length;
  const unavailableMetricCount = metricEntries.length - availableMetricCount;
  const marketContext = [...(snapshot.data?.data ?? [])]
    .filter(row => row.market === "stock" && row.change_pct != null)
    .sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0, 14);
  return <div className="nt-workspace nt-full-workspace nt-indicators-workspace">
    <section className="nt-toolbar"><h1>Indicators</h1><label>Symbol <select value={symbol} onChange={event => setSymbol(event.target.value)}>{[...new Set(["AAPL", ...(universe.data?.data ?? []).map(row => row.symbol)])].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Period <select value={period} onChange={event => setPeriod(event.target.value)}><option value="daily">Daily</option><option value="30m">30 minutes</option></select></label></section>
    <DataTable title="Published metric snapshot" columns={["Indicator", "Value", "Unit"]}
      rows={metricEntries.map(([key, item]) => ({ key, cells: [labelText(key), valueText(item.value), item.unit] }))}
      empty="No indicator values for this symbol and period." />
    <DataTable title="Technical indicator registry" columns={["Indicator", "Value"]}
      rows={technicalEntries.map(([key, item]) => ({ key, cells: [labelText(key), typeof item.value === "object" && item.value ? Object.entries(item.value).map(([name, value]) => `${name}: ${valueText(value)}`).join(" · ") : valueText(item.value)] }))}
      empty="No technical indicator values for this symbol and period." />
    <DataTable title="Market technical context" columns={["Symbol","Last","Change %","SMA50","RVol 20D","52W high"]}
      rows={marketContext.map(row => {
        const m = daily.data?.data[row.symbol]?.metrics;
        return { key: row.symbol, cells: [
          <SymbolContext key="symbol" symbol={row.symbol} />,
          valueText(row.price),
          row.change_pct == null ? "—" : `${row.change_pct > 0 ? "+" : ""}${valueText(row.change_pct)}%`,
          valueText(m?.sma50?.value),
          m?.rvol20?.value == null ? "—" : `${valueText(m.rvol20.value)}×`,
          valueText(m?.trading_52w_high?.value),
        ]};
      })}
      empty="No market technical context." />

  </div>;
}

export function DocumentsWorkspace() {
  const [symbol, setSymbol] = useState("AAPL");
  const [query, setQuery] = useState("AAPL");
  const filings = useFeed<{ data: Filing[] }>(`/api/filings/${encodeURIComponent(symbol)}`);
  return <div className="nt-workspace nt-full-workspace nt-documents-workspace">
    <section className="nt-toolbar"><h1>Documents & Filings</h1><form onSubmit={event => { event.preventDefault(); setSymbol(query.trim()); }}><label>SEC ticker <input value={query} required pattern="[A-Za-z]{1,12}" onChange={event => setQuery(event.target.value.toUpperCase())} /></label> <button type="submit">Find filings</button></form></section>
    <DataTable title={`${symbol} · SEC filings`} columns={["Form", "Filed", "Report period", "SEC document"]}
      rows={(filings.data?.data ?? []).map(item => ({ key: item.accession_number, cells: [item.form, item.filing_date?.slice(0,10), item.report_date?.slice(0,10), <a key="sec" href={sourceLink(item.filing_url)} rel="noreferrer">{item.accession_number}</a>] }))}
      empty="No SEC filings for this symbol." />
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
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const snapshot = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const bySymbol = useMemo(() => new Map(snapshot.data?.data.map(row => [row.symbol, row])), [snapshot.data]);

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

  const quick = (universe.data?.data ?? []).slice(0, 40);
  return <div className="nt-workspace nt-full-workspace nt-watchlists-workspace">
    <section className="nt-context-strip">
      <div className="nt-context-title"><div className="nt-label nt-info">Watchlists</div><h1>Symbol Monitor</h1></div>
      {token && <div className="nt-news-stat"><span>SAVED</span><b>{items.length}</b></div>}
    </section>

    {token ? <form className="nt-toolbar" onSubmit={event => { event.preventDefault(); void update("POST", symbol.trim()); }}>
      <label>Symbol <input required maxLength={20} value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} /></label>
      <button type="submit" disabled={busy}>Save symbol</button>
    </form> : <section className="nt-toolbar">
      <span>Sign in to save a personal watchlist.</span><Link href="/auth/login">Sign in ↗</Link>
    </section>}

    {error && <div className="nt-database-note" role="status">{error} <Link href="/auth/login">Sign in ↗</Link></div>}

    {token && <DataTable title="Saved symbols" columns={["Symbol","Context","Last","Change %","As of","Saved","Action"]} rows={items.map(item => {
      const row=bySymbol.get(item.symbol);
      return { key:item.symbol, cells:[
        <Link key="symbol" href={`/companies/profile/${encodeURIComponent(item.symbol)}`}>{item.symbol}</Link>,
        <SymbolContext key="context" symbol={item.symbol} />,
        valueText(row?.price), valueText(row?.change_pct), row?.as_of, item.created_at,
        <button key="remove" type="button" disabled={busy} onClick={() => void update("DELETE", item.symbol)}>Remove</button>
      ]};
    })} empty="No saved symbols yet. Add one above." />}

    <DataTable title={token ? "Universe quick access" : "Guest market quick access"} columns={["Symbol","Context","Instrument","Last","Change %","As of","Research"]}
      rows={quick.map(row => {
        const stored=bySymbol.get(row.symbol);
        return { key:row.symbol, cells:[
          row.symbol,<SymbolContext key="context" symbol={row.symbol} />,row.name,valueText(stored?.price),valueText(stored?.change_pct),stored?.as_of,
          <span key="links"><Link href={`/companies/profile/${encodeURIComponent(row.symbol)}`}>Company</Link> · <Link href={`/investing?symbol=${encodeURIComponent(row.symbol)}`}>Chart</Link></span>
        ]};
      })}
      empty="Loading instrument universe…" />

  </div>;
}
