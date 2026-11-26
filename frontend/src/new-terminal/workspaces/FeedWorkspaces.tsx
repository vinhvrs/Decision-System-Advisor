"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import DataTable from "../DataTable";
import { ECONOMIC_CALENDAR_PATH, calendarCoverageState, calendarEventsInDeclaredCoverage, labelText, sourceLink, valueText, type Calendar, type DailyAnalytics, type Filing, type Metrics, type Technical, type Universe } from "../feeds";
import { CurrencyContext, ImpactBadge, SymbolContext } from "../ContextBadges";
import { useFeed } from "../useFeed";
import type { MarketRow } from "../marketSnapshot";

const quoteText = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
const percentText = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? "—" : `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
const observationText = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date) + " ET";
};

export function NewsWorkspace({ initialCalendar, initialRows = [] }: { initialCalendar?: Calendar; initialRows?: MarketRow[] }) {
  const calendar = useFeed<Calendar>(ECONOMIC_CALENDAR_PATH, 300000);
  const market = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const calendarData = calendar.data ?? initialCalendar;
  const marketRows = market.data?.data ?? initialRows;
  const calendarEvents = calendarEventsInDeclaredCoverage(calendarData);
  const calendarState = calendarCoverageState(calendarData);
  const marketMovers = [...marketRows]
    .filter(row => row.market === "stock" && row.change_pct != null)
    .sort((a,b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0,10);
  const eventCounts = calendarEvents.reduce((acc, item) => {
    const impact = item.impact?.toLowerCase() ?? "";
    const key = impact.includes("high") ? "high" : impact.includes("med") ? "medium" : impact.includes("holiday") ? "holiday" : "low";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const eventTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return <div className="nt-workspace nt-full-workspace nt-news-workspace">
    <section className="nt-context-strip" data-layout-key="events:summary">
      <div className="nt-context-title">
        <div className="nt-label nt-info">Events / ForexFactory</div>
        <h1>Economic Calendar</h1>
      </div>
      <div className="nt-news-stat"><span>EVENTS</span><b>{calendarEvents.length || "—"}</b></div>
      <div className="nt-news-stat"><span>HIGH</span><b className="nt-negative">{eventCounts.high ?? 0}</b></div>
      <div className="nt-news-stat"><span>MED</span><b className="nt-warning">{eventCounts.medium ?? 0}</b></div>
      <div className="nt-news-stat"><span>LOW</span><b className="nt-info">{eventCounts.low ?? 0}</b></div>
      <div className="nt-news-stat"><span>HOLIDAY</span><b>{eventCounts.holiday ?? 0}</b></div>
    </section>

    <DataTable
      title="ForexFactory economic calendar"
      meta={calendarData?.coverage?.start && calendarData?.coverage?.end
        ? `${calendarData.coverage.start} → ${calendarData.coverage.end} · ET`
        : calendarState.label}
      className={`nt-primary-table ${calendarState.valid ? "" : "nt-data-source-gap"}`.trim()}
      columns={["Scheduled (ET)", "Currency", "Event", "Importance", "Forecast", "Previous"]}
      rows={calendarEvents.map(item => ({
        key: item.id,
        cells: [
          item.scheduled_at ? eventTime.format(new Date(item.scheduled_at)) : "—",
          <CurrencyContext key="currency" currency={item.currency} />,
          item.title,
          <ImpactBadge key="impact" impact={item.impact} />,
          item.forecast,
          item.previous,
        ],
      }))}
      empty={calendarData && !calendarState.valid ? calendarState.label : "No ForexFactory events in current coverage."}
      note={<span>Source: <a href={calendarData?.source_url || "https://www.forexfactory.com/calendar"} rel="noreferrer">ForexFactory calendar ↗</a>. Dates follow New York time.</span>}
    />

    <DataTable
      title="Market movers"
      meta="session context"
      className="nt-secondary-table"
      columns={["Symbol","Last","Change %","Traded value"]}
      rows={marketMovers.map(row => ({ key: row.symbol, cells: [
        <SymbolContext key="symbol" symbol={row.symbol} />,
        valueText(row.price),
        row.change_pct == null ? "—" : `${row.change_pct > 0 ? "+" : ""}${valueText(row.change_pct)}%`,
        valueText(row.traded_value),
      ] }))}
      empty="No session movers."
    />
  </div>;
}

export function IndicatorsWorkspace({ initialUniverse = [], initialRows = [], initialDaily, initialMetrics, initialTechnical }: { initialUniverse?: Universe[]; initialRows?: MarketRow[]; initialDaily?: DailyAnalytics; initialMetrics?: Metrics; initialTechnical?: Technical }) {
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const snapshot = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const daily = useFeed<DailyAnalytics>("/api/market/daily-analytics", 300000);
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("daily");
  const id = encodeURIComponent(symbol);
  const metrics = useFeed<Metrics>(`/api/v1/metrics/${id}?timeframe=${period}`);
  const activeMetrics = metrics.data ?? (symbol === "AAPL" && period === "daily" ? initialMetrics : undefined);
  const restricted = activeMetrics?.quality === "LICENSE_RESTRICTED";
  const technical = useFeed<Technical>(activeMetrics && !restricted ? `/api/v1/technical/${id}?period=${period}` : null);
  const universeRows = universe.data?.data ?? initialUniverse;
  const snapshotRows = snapshot.data?.data ?? initialRows;
  const dailyData = daily.data ?? initialDaily;
  const technicalData = restricted
    ? undefined : technical.data ?? (symbol === "AAPL" && period === "daily" ? initialTechnical : undefined);
  const metricEntries = Object.entries(activeMetrics?.metrics ?? {}).filter(([, item]) => item.value != null);
  const technicalEntries = Object.entries(technicalData?.indicators ?? {});
  const metricKeys = new Set(metricEntries.map(([key]) => key));
  const technicalOnlyEntries = technicalEntries.filter(([key]) => !metricKeys.has(key));
  const marketContext = [...snapshotRows]
    .filter(row => row.market === "stock" && row.change_pct != null)
    .sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0, 30);
  return <div className="nt-workspace nt-full-workspace nt-indicators-workspace">
    <section className="nt-toolbar"><h1>Indicators</h1><label>Symbol <select value={symbol} onChange={event => setSymbol(event.target.value)}>{[...new Set(["AAPL", ...universeRows.map(row => row.symbol)])].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Period <select value={period} onChange={event => setPeriod(event.target.value)}><option value="daily">Daily</option><option value="30m">30 minutes</option></select></label></section>
    <DataTable
      title="Published metric snapshot"
      meta={`${symbol} · ${period}`}
      className="nt-primary-table"
      columns={["Indicator", "Value", "Unit"]}
      rows={metricEntries.map(([key, item]) => ({ key, cells: [labelText(key), valueText(item.value), item.unit] }))}
      empty={restricted ? "Unavailable for public display under the source policy." : "No indicator values for this symbol and period."}
    />

    <div className="nt-supporting-grid nt-indicators-supporting-grid">
      <DataTable
        title="Additional technical calculations"
        meta="derived context"
        className="nt-secondary-table"
        columns={["Indicator", "Value"]}
        rows={technicalOnlyEntries.map(([key, item]) => ({ key, cells: [labelText(key), typeof item.value === "object" && item.value ? Object.entries(item.value).map(([name, value]) => `${name}: ${valueText(value)}`).join(" · ") : valueText(item.value)] }))}
        empty="No additional technical calculations for this symbol and period."
      />
      <DataTable
        title="Market technical context"
        meta="cross-sectional context"
        className="nt-secondary-table"
        columns={["Symbol","Last","Change %","SMA50","RVol 20D","52W high"]}
        rows={marketContext.map(row => {
          const m = dailyData?.data[row.symbol]?.metrics;
          return { key: row.symbol, cells: [
            <SymbolContext key="symbol" symbol={row.symbol} />,
            quoteText(row.price),
            percentText(row.change_pct),
            quoteText(m?.sma50?.value),
            m?.rvol20?.value == null ? "—" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(m.rvol20.value)}×`,
            quoteText(m?.trading_52w_high?.value),
          ]};
        })}
        empty="No market technical context."
      />
    </div>

  </div>;
}

export function DocumentsWorkspace({ initialFilings = [] }: { initialFilings?: Filing[] }) {
  const [symbol, setSymbol] = useState("AAPL");
  const [query, setQuery] = useState("AAPL");
  const filings = useFeed<{ data: Filing[] }>(`/api/filings/${encodeURIComponent(symbol)}`);
  const filingRows = filings.data?.data ?? initialFilings;
  return <div className="nt-workspace nt-full-workspace nt-documents-workspace">
    <section className="nt-toolbar"><h1>Documents & Filings</h1><form onSubmit={event => { event.preventDefault(); setSymbol(query.trim()); }}><label>SEC ticker <input value={query} required pattern="[A-Za-z]{1,12}" onChange={event => setQuery(event.target.value.toUpperCase())} /></label> <button type="submit">Find filings</button></form></section>
    <DataTable
      title={`${symbol} · SEC filings`}
      meta="primary-source documents"
      className="nt-primary-table"
      columns={["Form", "Filed", "Report period", "SEC document"]}
      rows={filingRows.map(item => ({ key: item.accession_number, cells: [item.form, item.filing_date?.slice(0,10), item.report_date?.slice(0,10), <a key="sec" href={sourceLink(item.filing_url)} rel="noreferrer">{item.accession_number}</a>] }))}
      empty="No SEC filings for this symbol."
    />
  </div>;
}

function subscribeToWatchlistAuth(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function WatchlistsWorkspace({ initialUniverse = [], initialRows = [] }: { initialUniverse?: Universe[]; initialRows?: MarketRow[] }) {
  const token = useSyncExternalStore(subscribeToWatchlistAuth, () => localStorage.getItem("accessToken"), () => null);
  return <WatchlistEditor token={token} initialUniverse={initialUniverse} initialRows={initialRows} />;
}

function WatchlistEditor({ token, initialUniverse, initialRows }: { token: string | null; initialUniverse: Universe[]; initialRows: MarketRow[] }) {
  const [items, setItems] = useState<{ symbol: string; created_at?: string }[]>([]);
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const snapshot = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const universeRows = universe.data?.data ?? initialUniverse;
  const snapshotRows = snapshot.data?.data ?? initialRows;
  const bySymbol = useMemo(() => new Map(snapshotRows.map(row => [row.symbol, row])), [snapshotRows]);

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

  const quick = universeRows.slice(0, 40);
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
        quoteText(row?.price), percentText(row?.change_pct), observationText(row?.as_of), observationText(item.created_at),
        <button key="remove" type="button" disabled={busy} onClick={() => void update("DELETE", item.symbol)}>Remove</button>
      ]};
    })} empty="No saved symbols yet. Add one above." />}

    <DataTable title={token ? "Universe quick access" : "Guest market quick access"} columns={["Symbol","Context","Instrument","Last","Change %","As of","Research"]}
      rows={quick.map(row => {
        const stored=bySymbol.get(row.symbol);
        return { key:row.symbol, cells:[
          row.symbol,<SymbolContext key="context" symbol={row.symbol} />,row.name,quoteText(stored?.price),percentText(stored?.change_pct),observationText(stored?.as_of),
          <span key="links"><Link href={`/companies/profile/${encodeURIComponent(row.symbol)}`}>Company</Link> · <Link href={`/investing?symbol=${encodeURIComponent(row.symbol)}`}>Chart</Link></span>
        ]};
      })}
      empty="Loading instrument universe…" />

  </div>;
}
