"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import DataTable from "../DataTable";
import { ECONOMIC_CALENDAR_PATH, calendarCoverageState, calendarEventsInDeclaredCoverage, labelText, quoteText, valueText, type Calendar, type DailyAnalytics, type Crypto, type Macro, type News } from "../feeds";
import { useFeed } from "../useFeed";
import { EQUITY_HEATMAP_SIZE, EQUITY_HEATMAP_UNIVERSE } from "../equityUniverse";
import type { MarketRow, MarketSnapshot } from "../marketSnapshot";

type Quote = {
  price: number;
  change: number | null;
  at: number;
  source: "live" | "snapshot";
};

type SnapshotQuoteResponse = {
  data?: Array<{
    symbol: string;
    price: number;
    change: number;
    observed_at: number | null;
    retrieved_at: number;
  }>;
};

const priceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const marketCapFormat = new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 2 });
const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const directionClass = (value: number | null | undefined) =>
  value == null ? "nt-heat-awaiting" : value > 0 ? "nt-heat-up" : value < 0 ? "nt-heat-down" : "nt-heat-flat";

const normalizeSector = (sector: string | null | undefined) => {
  if (sector === "Consumer Cyclical" || sector === "Consumer Discretionary") return "Consumer Discr.";
  if (sector === "Consumer Staples") return "Staples";
  if (sector === "Communication Services") return "Communication";
  if (sector === "Financial Services") return "Financials";
  if (sector === "Healthcare") return "Health Care";
  return sector || "Unclassified";
};

const sectorClass = (sector: string) => {
  const normalized = normalizeSector(sector);
  if (normalized === "Technology") return "nt-sector-tech";
  if (normalized === "Consumer Discr.") return "nt-sector-consumer";
  if (normalized === "Communication") return "nt-sector-communication";
  if (normalized === "Financials") return "nt-sector-financials";
  if (normalized === "Energy") return "nt-sector-energy";
  if (normalized === "Health Care") return "nt-sector-health";
  if (normalized === "Industrials") return "nt-sector-industrials";
  if (normalized === "Utilities") return "nt-sector-utilities";
  return "nt-sector-neutral";
};

const sectors = [
  "Technology","Communication","Financials","Consumer Discr.","Health Care","Industrials",
  "Staples","Energy","Utilities","Real Estate","Materials",
];

const crossAsset = ["DXY","US02Y","US10Y","WTI","GOLD","COPPER","BTC","ETH","SPY","QQQ","HYG","VIX"];
const indexSymbols: Record<string, string> = { "S&P 500": "^GSPC", "NASDAQ 100": "^NDX", DOW: "^DJI", "RUSSELL (IWM proxy)": "IWM", VIX: "^VIX" };
const assetSymbols: Record<string, string> = { DXY: "DX-Y.NYB", WTI: "CL=F", GOLD: "GC=F", COPPER: "HG=F", BTC: "BTC-USD", ETH: "ETH-USD", VIX: "^VIX" };
const eventDate = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
const eventClock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
const MARKET_TAPE_PAGE_SIZE = 18;
const CALENDAR_PAGE_SIZE = 4;
const ecbCurrencies = ["USD", "GBP", "JPY", "CHF", "AUD"];
const ecbReferencePage = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html";
const referenceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 });
const displayUnit = (unit: string | undefined) => {
  if (!unit) return "";
  const mapped: Record<string, string> = {
    percent_annual: "%",
    percentage_points: "pp",
    currency_per_EUR: "/ EUR",
    fraction_per_funding_interval: "/ interval",
    base_asset_units: "base units",
  };
  return mapped[unit] ?? unit.replace(/_/g, " ");
};

type MarketsWorkspaceProps = {
  initialSnapshot: MarketSnapshot;
  initialDaily?: DailyAnalytics;
  initialMacro?: Macro;
  initialCrypto?: Crypto;
  initialCalendar?: Calendar;
  initialNews?: { data: News[] };
};

export default function MarketsWorkspace({
  initialSnapshot,
  initialDaily,
  initialMacro,
  initialCrypto,
  initialCalendar,
  initialNews,
}: MarketsWorkspaceProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const rows = snapshot.data;
  const daily = useFeed<DailyAnalytics>("/api/market/daily-analytics", 300000);
  const macro = useFeed<Macro>("/api/v1/macro/dashboard", 300000);
  const crypto = useFeed<Crypto>("/api/v1/crypto-context", 60000);
  const calendar = useFeed<Calendar>(ECONOMIC_CALENDAR_PATH, 60000);
  const news = useFeed<{ data: News[] }>("/api/news", 60000);
  const dailyData = daily.data ?? initialDaily;
  const macroData = macro.data ?? initialMacro;
  const cryptoData = crypto.data ?? initialCrypto;
  const calendarData = calendar.data ?? initialCalendar;
  const newsData = news.data ?? initialNews;
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [connected, setConnected] = useState(false);
  const [marketTapePage, setMarketTapePage] = useState(0);
  const [calendarPage, setCalendarPage] = useState(0);
  const subscriptionSymbols = useMemo(
    () => EQUITY_HEATMAP_UNIVERSE.map(item => item.symbol),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;

    async function refresh() {
      try {
        const response = await fetch("/api/v1/market-heatmap", { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const next: MarketSnapshot = await response.json();
          if (Array.isArray(next.data)) setSnapshot(next);
        }
      } catch {
        // Keep last successful snapshot.
      }
    }

    function connect() {
      if (controller.signal.aborted) return;
      socket = new WebSocket("wss://data.aitemple.tech/ws/quotes");
      socket.onopen = () => {
        setConnected(true);
        socket.send(JSON.stringify({ type: "subscribe", symbols: subscriptionSymbols }));
      };
      socket.onmessage = ({ data }) => {
        try {
          const quote = JSON.parse(data);
          if (
            (quote.type !== "quote" && quote.type !== "initial_quote") ||
            typeof quote.symbol !== "string" ||
            !Number.isFinite(quote.price) ||
            quote.price <= 0
          ) return;

          const at = quote.type === "initial_quote" ? quote.quote_ts : quote.ts;
          if (!Number.isFinite(at)) return;

          setQuotes(previous => previous[quote.symbol]?.at > at ? previous : {
            ...previous,
            [quote.symbol]: {
              price: quote.price,
              change: Number.isFinite(quote.change) ? quote.change : null,
              at,
              source: "live",
            },
          });
        } catch {
          // Ignore non-quote frames.
        }
      };
      socket.onclose = () => {
        if (controller.signal.aborted) return;
        setConnected(false);
        retry = setTimeout(connect, 5000);
      };
    }

    void refresh();
    connect();
    const timer = setInterval(refresh, 30000);

    return () => {
      controller.abort();
      clearInterval(timer);
      clearTimeout(retry);
      socket?.close();
    };
  }, [subscriptionSymbols]);

  useEffect(() => {
    const controller = new AbortController();

    async function hydrateSnapshotQuotes() {
      try {
        const response = await fetch("/api/v1/equity-quotes", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as SnapshotQuoteResponse;
        const incoming = payload.data ?? [];
        if (!incoming.length || controller.signal.aborted) return;

        setQuotes(previous => {
          const next = { ...previous };
          for (const item of incoming) {
            if (
              !item?.symbol ||
              !Number.isFinite(item.price) ||
              item.price <= 0 ||
              !Number.isFinite(item.change)
            ) continue;

            const symbol = item.symbol.toUpperCase();
            const existing = next[symbol];
            // Snapshot fallback must never overwrite a real websocket quote.
            if (existing?.source === "live") continue;

            const at = Number.isFinite(item.retrieved_at) ? item.retrieved_at : Date.now();
            if (!existing || at >= existing.at) {
              next[symbol] = {
                price: item.price,
                change: item.change,
                at,
                source: "snapshot",
              };
            }
          }
          return next;
        });
      } catch {
        // WebSocket/persisted observations remain authoritative if fallback is unavailable.
      }
    }

    void hydrateSnapshotQuotes();
    const timer = setInterval(hydrateSnapshotQuotes, 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const bySymbol = useMemo(() => new Map(rows.map(row => [row.symbol, row])), [rows]);
  const participation = snapshot.meta?.equity_participation;
  const equitySession = participation?.session_date ?? null;
  const eligible = new Set(participation?.symbols);
  const sessionRows = (snapshot.equity_session_rows ?? rows).filter(row => eligible.has(row.symbol) && row.session_date === equitySession);
  const liveQuoteCount = EQUITY_HEATMAP_UNIVERSE.filter(member => quotes[member.symbol]?.source === "live").length;
  const snapshotQuoteCount = EQUITY_HEATMAP_UNIVERSE.filter(member => quotes[member.symbol]?.source === "snapshot").length;
  const equities = EQUITY_HEATMAP_UNIVERSE.flatMap(member => {
    const stored = bySymbol.get(member.symbol);
    const quote = quotes[member.symbol];
    const storedAt = stored?.as_of ? Date.parse(stored.as_of) : 0;
    const useQuote = Boolean(quote && (!storedAt || quote.at >= storedAt));
    const price = useQuote ? quote?.price : stored?.price;
    const change = useQuote ? quote?.change : stored?.change_pct;
    if (price == null || change == null || !Number.isFinite(price) || !Number.isFinite(change)) return [];
    return [{
      symbol: member.symbol,
      market: "stock",
      sector: stored?.sector ?? member.sector,
      price,
      change_pct: change,
      traded_value: stored?.traded_value ?? null,
      market_cap: stored?.market_cap ?? null,
      as_of: useQuote && quote ? new Date(quote.at).toISOString() : stored?.as_of ?? null,
      session_date: stored?.session_date ?? null,
      previous_session_date: stored?.previous_session_date ?? null,
      last_sync_at: stored?.last_sync_at ?? null,
      coverage_partial: stored?.coverage_partial ?? !stored,
      session_final: stored?.session_final ?? false,
      provider_error: stored?.provider_error ?? false,
    } satisfies MarketRow];
  });
  const leaders = sessionRows.filter(row => (row.change_pct ?? 0) > 0)
    .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
  const laggards = sessionRows.filter(row => (row.change_pct ?? 0) < 0)
    .sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0));
  const macroByCode = new Map(macroData?.data.map(row => [row.series_code, row]));
  const ecbDates = ecbCurrencies.map(currency => macroByCode.get(`ECB_${currency}_EUR`)?.observed_at?.slice(0, 10));
  const commonEcbDate = ecbDates[0] && /^\d{4}-\d{2}-\d{2}$/.test(ecbDates[0]) && ecbDates.every(date => date === ecbDates[0])
    ? ecbDates[0] : null;
  const valueTotal = (value: number | null | undefined) => value == null ? "—" : `${(value / 1e9).toFixed(2)}B`;
  const sampleSize = participation?.breadth_count ?? 0;
  const up = participation?.advancing ?? 0;
  const down = participation?.declining ?? 0;
  const unchanged = participation?.unchanged ?? 0;
  const breadthPct = sampleSize ? (up / sampleSize) * 100 : null;
  const heatRows = equities;
  const calendarEvents = calendarEventsInDeclaredCoverage(calendarData);
  const calendarState = calendarCoverageState(calendarData);
  const calendarPageCount = Math.max(1, Math.ceil(calendarEvents.length / CALENDAR_PAGE_SIZE));
  const currentCalendarPage = Math.min(calendarPage, calendarPageCount - 1);
  const visibleCalendarEvents = calendarEvents.slice(currentCalendarPage * CALENDAR_PAGE_SIZE, (currentCalendarPage + 1) * CALENDAR_PAGE_SIZE);

  const dailyRows = dailyData?.data;
  const breadthEquities = sessionRows;
  const breadthSession = equitySession;
  const dailyGroup = (sample: MarketRow[], code: string) => {
    const current = sample.flatMap(row => {
      const metric = dailyRows?.[row.symbol]?.metrics[code];
      return metric && metric.as_of === breadthSession ? [metric] : [];
    });
    const observed = current.filter(metric =>
      metric.quality === "OK" && metric.value != null && Number.isFinite(metric.value));
    const emptyState = daily.error && !dailyData ? "UNAVAILABLE"
      : current.some(metric => metric.quality === "LICENSE_RESTRICTED") ? "LICENSE_RESTRICTED"
      : current.some(metric => metric.quality === "PARTIAL") ? "PARTIAL" : "NOT_INGESTED";
    const sources = [...new Set(observed.flatMap(metric =>
      metric.metadata?.source?.split(", ") ?? []))].sort().join(", ");
    return {
      value: observed.length ? observed.reduce((sum, metric) => sum + (metric.value ?? 0), 0) / observed.length : null,
      count: observed.length,
      total: sample.length,
      sources,
      asOf: breadthSession,
      state: !observed.length ? emptyState :
        observed.length < sample.length ? "PARTIAL" : "OK",
    };
  };
  const trend = [20, 50, 200].map(window => dailyGroup(breadthEquities, `above_sma${window}`));
  const breadthValue = (group: typeof trend[number]) =>
    group.value === null ? "—" : `${(group.value * 100).toFixed(1)}%`;

  const relativeVolumeLeaders = breadthEquities.flatMap(row => {
    const metric = dailyRows?.[row.symbol]?.metrics.rvol20;
    return metric?.quality === "OK" && metric.as_of === breadthSession && metric.value != null && Number.isFinite(metric.value)
      ? [{ symbol: row.symbol, value: metric.value }] : [];
  }).sort((a, b) => b.value - a.value);
  const mostActive = [...sessionRows]
    .filter(row => row.traded_value != null)
    .sort((a, b) => (b.traded_value ?? 0) - (a.traded_value ?? 0))
    .slice(0, 18);
  const recentHeadlines = (newsData?.data ?? []).filter(item => item.published_at && item.title?.trim()).slice(0, 14);
  const marketTape = [...sessionRows]
    .sort((a, b) => (b.traded_value ?? 0) - (a.traded_value ?? 0));
  const showMarketCap = marketTape.some(row => row.market_cap != null);
  const showTapeAsOf = !equitySession || !marketTape.length || !marketTape.every(row => row.session_date === equitySession);
  const tapePageCount = Math.max(1, Math.ceil(marketTape.length / MARKET_TAPE_PAGE_SIZE));
  const tapePage = Math.min(marketTapePage, tapePageCount - 1);
  const visibleMarketTape = marketTape.slice(tapePage * MARKET_TAPE_PAGE_SIZE, (tapePage + 1) * MARKET_TAPE_PAGE_SIZE);
  const sectorPerformance = sectors.map(sector => {
    const sample = sessionRows.filter(row => normalizeSector(row.sector) === sector);
    return {
      sector,
      sample,
      count: sample.length,
      change: sample.length >= 3 ? sample.reduce((sum, row) => sum + (row.change_pct ?? 0), 0) / sample.length : null,
      advance: sample.length >= 3 ? sample.filter(row => (row.change_pct ?? 0) > 0).length / sample.length * 100 : null,
    };
  }).sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));

  return (
    <div className="nt-workspace nt-market-workspace nt-market-fixed">
      <section className="nt-context-strip" data-layout-key="markets:summary">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Markets / US Equities</div>
          <h1>Market Overview</h1>
        </div>
        {[...Object.keys(indexSymbols), "US10Y"].map(name => (
          <div className="nt-index" key={name}>
            <div className="nt-index-name">{name}</div>
            <div className="nt-index-values">
              <span>{name === "US10Y" ? valueText(macroByCode.get("UST10Y")?.value) : quoteText(bySymbol.get(indexSymbols[name])?.price)}</span>
              {name !== "US10Y" && <span className={(bySymbol.get(indexSymbols[name])?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{percent(bySymbol.get(indexSymbols[name])?.change_pct)}</span>}
            </div>
          </div>
        ))}
      </section>

      <div className="nt-dense-grid nt-financial-strip" data-layout-key="markets:metrics">
        {[
          ["Equity session", equitySession ?? "—", equitySession ? "Final" : "Awaiting close"],
          ["Adv / Decl", sampleSize ? `${up} / ${down}` : "—", sampleSize ? `${unchanged} unchanged` : ""],
          ["Advancing", breadthPct == null ? "—" : `${breadthPct.toFixed(1)}%`, `${sampleSize}/${participation?.universe_count ?? EQUITY_HEATMAP_SIZE} tracked equities`],
          ["Traded value", valueTotal(participation?.traded_value), `n=${participation?.traded_value_count ?? 0}`],
          ["> 20D MA", breadthValue(trend[0]), breadthSession ?? ""],
          ["> 50D MA", breadthValue(trend[1]), breadthSession ?? ""],
          ["> 200D MA", breadthValue(trend[2]), breadthSession ?? ""],
          ["Rel volume", relativeVolumeLeaders[0] ? `${relativeVolumeLeaders[0].symbol} ${relativeVolumeLeaders[0].value.toFixed(2)}×` : "—", "20D"],
          ["Headlines", newsData ? String(newsData.data.filter(item => item.published_at && item.title?.trim()).length) : "—", "Latest"],
          ["Events", calendarData ? String(calendarEvents.length) : "—", calendarState.valid ? "Calendar" : calendarState.label],
        ].map(([k,v,s]) => (
          <div className="nt-data-cell" key={k}>
            <div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div>
          </div>
        ))}
      </div>

      <div className="nt-market-fixed-grid">
        <div className="nt-market-fixed-content nt-market-fixed-stack">
          <div className="nt-market-fixed-top">
            <section className="nt-panel nt-market-heatmap-panel" data-layout-key="markets:heatmap">
              <div className="nt-panel-title"><strong>Equity heatmap</strong><span className="nt-panel-meta">{heatRows.length}/{EQUITY_HEATMAP_SIZE} observed · {connected ? `${liveQuoteCount} live` : "stream offline"} · {snapshotQuoteCount} intraday snapshots</span></div>
              <div className="nt-panel-body">
                <div className="nt-heatmap">
                  {heatRows.length ? heatRows.map(row => {
                    const symbol = row.symbol;
                    const sector = normalizeSector(row.sector);
                    const price = row.price;
                    const change = row.change_pct;
                    return (
                      <Link
                        className={`nt-heat-cell nt-heat-link ${directionClass(change)}`}
                        href={`/companies?symbol=${encodeURIComponent(symbol)}`}
                        key={symbol}
                        aria-label={`Open ${symbol} company research`}
                      >
                        <div className="nt-heat-symbol-row"><b>{symbol}</b><span className={`nt-sector-dot ${sectorClass(sector)}`} aria-label={sector} /></div>
                        <span className="nt-heat-price nt-mono">{price == null ? "No quote" : priceFormat.format(price)}</span>
                        <span className={`nt-heat-change nt-mono ${change == null ? "nt-muted" : change > 0 ? "nt-positive" : change < 0 ? "nt-negative" : ""}`}>{percent(change)}</span>
                        <small title={row.as_of ?? undefined}><span className="nt-sector-name">{sector}</span></small>
                      </Link>
                    );
                  }) : <div className="nt-empty nt-empty-compact">No equity observations in the tracked universe.</div>}
                </div>
              </div>
            </section>
            <div className="nt-subsection" data-layout-key="markets:calendar-events">
              <div className="nt-subsection-title"><strong>Calendar events</strong><span className={calendarState.valid ? "" : "nt-warning"}>{calendarState.valid ? "ET · declared coverage" : "SOURCE GAP"}</span></div>
              <div className="nt-market-table-scroll"><table className="nt-microtable">
                <thead><tr><th>Event</th><th>Time (ET)</th></tr></thead>
                <tbody>{visibleCalendarEvents.length ? visibleCalendarEvents.map(event => {
                  const scheduled = event.scheduled_at ? new Date(event.scheduled_at) : null;
                  return <tr key={event.id}>
                    <td>
                      <span className="nt-market-event-title">{event.title}</span>
                      <span className="nt-market-event-meta"><span>{event.currency}</span><span>{event.impact}</span></span>
                    </td>
                    <td>{scheduled && Number.isFinite(scheduled.getTime()) ? <time className="nt-market-event-time" dateTime={event.scheduled_at ?? undefined}>
                      <span className="nt-market-event-date">{eventDate.format(scheduled)}</span>
                      <span className="nt-market-event-clock">{eventClock.format(scheduled)}</span>
                    </time> : "—"}</td>
                  </tr>;
                }) : <tr><td colSpan={2} className="nt-data-gap">{calendarData ? calendarState.label : "Awaiting calendar feed"}</td></tr>}</tbody>
              </table></div>
              {calendarEvents.length > CALENDAR_PAGE_SIZE && <div className="nt-database-note">
                <nav className="nt-market-pagination" aria-label="Calendar event pages">
                  <span aria-live="polite">{currentCalendarPage * CALENDAR_PAGE_SIZE + 1}–{Math.min((currentCalendarPage + 1) * CALENDAR_PAGE_SIZE, calendarEvents.length)} of {calendarEvents.length}</span>
                  <div>
                    <button type="button" aria-label="Previous calendar events page" disabled={currentCalendarPage === 0} onClick={() => setCalendarPage(currentCalendarPage - 1)}>Previous</button>
                    <button type="button" aria-label="Next calendar events page" disabled={currentCalendarPage + 1 >= calendarPageCount} onClick={() => setCalendarPage(currentCalendarPage + 1)}>Next</button>
                  </div>
                </nav>
              </div>}
            </div>
          </div>
          <div className="nt-market-fixed-middle">
            <div className="nt-market-fixed-stack">
              <div className="nt-market-fixed-tables">
                <div className="nt-subsection" data-layout-key="markets:most-active">
                  <div className="nt-subsection-title"><strong>Most active</strong><span>traded value · final</span></div>
                  <div className="nt-market-table-scroll"><table className="nt-microtable">
                    <thead><tr><th>Symbol</th><th>Value</th><th>Chg</th></tr></thead>
                    <tbody>{mostActive.map(row => <tr key={row.symbol}><td>{row.symbol}</td><td>{row.traded_value == null ? "—" : `${(row.traded_value / 1e9).toFixed(2)}B`}</td><td className={(row.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{percent(row.change_pct)}</td></tr>)}</tbody>
                  </table></div>
                </div>
                <DataTable
                  title="Market tape"
                  meta={`final equity session ${equitySession ?? "—"} · n=${sampleSize}`}
                  className="nt-primary-table nt-market-tape-table"
                  columns={["Symbol", "Last", "Change", "Traded value", ...(showMarketCap ? ["Market cap"] : []), ...(showTapeAsOf ? ["As of"] : [])]}
                  rows={visibleMarketTape.map(row => ({ key: row.symbol, cells: [
                    row.symbol,
                    quoteText(row.price),
                    row.change_pct == null ? "—" : percent(row.change_pct),
                    row.traded_value == null ? "—" : `${(row.traded_value / 1e9).toFixed(2)}B`,
                    ...(showMarketCap ? [row.market_cap == null || !Number.isFinite(row.market_cap) ? "—" : <span key={`${row.symbol}-market-cap`} title={row.market_cap.toLocaleString("en-US", { maximumFractionDigits: 20 })}>{marketCapFormat.format(row.market_cap)}</span>] : []),
                    ...(showTapeAsOf ? [row.session_date] : []),
                  ] }))}
                  note={marketTape.length > MARKET_TAPE_PAGE_SIZE && <nav className="nt-market-pagination" aria-label="Market tape pages">
                    <span aria-live="polite">{tapePage * MARKET_TAPE_PAGE_SIZE + 1}–{Math.min((tapePage + 1) * MARKET_TAPE_PAGE_SIZE, marketTape.length)} of {marketTape.length}</span>
                    <div>
                      <button type="button" aria-label="Previous market tape page" disabled={tapePage === 0} onClick={() => setMarketTapePage(tapePage - 1)}>Previous</button>
                      <button type="button" aria-label="Next market tape page" disabled={tapePage + 1 >= tapePageCount} onClick={() => setMarketTapePage(tapePage + 1)}>Next</button>
                    </div>
                  </nav>}
                  empty="No market observations."
                />
              </div>
              <DataTable
                title="Latest headlines"
                meta={`${recentHeadlines.length} observations`}
                className="nt-secondary-table nt-market-headlines-table"
                columns={["Time","Feed symbol","Headline"]}
                rows={recentHeadlines.map(item => ({
                  key: item.id,
                  cells: [
                    item.published_at?.slice(11,16) ?? "—",
                    item.symbol ?? "—",
                    <span className="nt-cell-wrap" key={`${item.id}-headline`}>{item.title}</span>,
                  ],
                }))}
                empty="No recent headlines."
              />
            </div>
            <div className="nt-market-fixed-stack">
              <div className="nt-subsection" data-layout-key="markets:sector-performance">
                <div className="nt-subsection-title"><strong>Sector performance</strong><span>equal weight</span></div>
                <div className="nt-market-table-scroll"><table className="nt-microtable"><thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th></tr></thead><tbody>
                  {sectorPerformance.map(item => <tr key={item.sector}><td><span className="nt-market-sector-name">{item.sector}</span>{" "}<small className="nt-market-sample">n={item.count}</small></td><td className={(item.change ?? 0) > 0 ? "nt-positive" : (item.change ?? 0) < 0 ? "nt-negative" : ""}>{percent(item.change)}</td><td>{item.advance == null ? "—" : `${item.advance.toFixed(0)}%`}</td></tr>)}
                </tbody></table></div>
              </div>
              <div className="nt-subsection" data-layout-key="markets:sector-breadth">
                <div className="nt-subsection-title"><strong>Sector breadth</strong><span>session · min. 3 observations</span></div>
                <div className="nt-market-table-scroll"><table className="nt-microtable">
                  <thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th><th>&gt;50D</th><th>RVol</th></tr></thead>
                  <tbody>{sectorPerformance.map(({ sector, sample, count, change, advance }) => {
                    const ma = dailyGroup(sample, "above_sma50");
                    const rvol = dailyGroup(sample, "rvol20");
                    return <tr key={sector}><td><span className="nt-market-sector-name">{sector}</span>{" "}<small className="nt-market-sample">n={count}</small></td><td>{percent(change)}</td><td>{advance == null ? "—" : `${advance.toFixed(0)}%`}</td><td>{ma.count < 3 ? "—" : breadthValue(ma)}</td><td>{rvol.count < 3 || rvol.value === null ? "—" : `${rvol.value.toFixed(2)}×`}</td></tr>;
                  })}</tbody>
                </table></div>
              </div>
            </div>
          </div>
          <DataTable
            title="Macro observations & spreads"
            meta="supporting context"
            className="nt-secondary-table nt-market-macro-table"
            columns={["Series","Value","Unit","Quality","Observed"]}
            rows={[...(macroData?.data ?? []).filter(row => row.source !== "ECB"), ...(macroData?.spreads ?? [])].map(row => ({
              key: row.series_code,
              cells: [
                labelText(row.series_code),
                valueText(row.value),
                displayUnit(row.unit),
                row.quality,
                row.observed_at ?? (row.metadata?.source === "CALCULATED" ? "Derived" : "—"),
              ],
            }))}
            empty="No macro observations."
          />
          <DataTable
            title="Crypto derivatives"
            meta="supporting context"
            className="nt-secondary-table"
            columns={["Metric","Value","Unit","Venue","Quality","Observed"]}
            rows={(cryptoData?.data ?? []).map(row => ({
              key: row.metric_code,
              cells: [labelText(row.metric_code), valueText(row.value), displayUnit(row.metadata?.unit), row.source, row.quality, row.observed_at],
            }))}
            empty="No crypto derivatives observations."
          />
        </div>
        <aside className="nt-market-fixed-rail nt-market-fixed-stack" aria-label="Market participation and reference data">
          <div className="nt-subsection" data-layout-key="markets:leadership">
            <div className="nt-subsection-title"><strong>Leadership / laggards</strong><span>{equitySession ?? "Awaiting final session"}</span></div>
            <div className="nt-market-table-scroll"><table className="nt-microtable"><thead><tr><th>#</th><th>Leader</th><th>Laggard</th></tr></thead><tbody>
              {Array.from({ length: Math.min(16, Math.max(leaders.length, laggards.length)) }, (_, i) => <tr key={i}>
                <td>{i+1}</td>
                <td className="nt-positive"><span className="nt-market-rank-quote"><span>{leaders[i]?.symbol ?? "—"}</span><span>{percent(leaders[i]?.change_pct)}</span></span></td>
                <td className="nt-negative"><span className="nt-market-rank-quote"><span>{laggards[i]?.symbol ?? "—"}</span><span>{percent(laggards[i]?.change_pct)}</span></span></td>
              </tr>)}
            </tbody></table></div>
          </div>
          <div className="nt-subsection" data-layout-key="markets:ecb-reference-rates">
            <div className="nt-subsection-title">
              <strong>ECB reference rates</strong>
              <span><a href={ecbReferencePage} rel="noreferrer">ECB ↗</a></span>
            </div>
            {commonEcbDate && <div className="nt-market-reference-date">As of <time dateTime={commonEcbDate}>{commonEcbDate}</time></div>}
            <div className="nt-market-table-scroll"><table className="nt-microtable">
              <thead><tr><th scope="col">Currency</th><th scope="col">Per EUR</th><th scope="col">Δ vs prior</th></tr></thead>
              <tbody>{ecbCurrencies.map(currency => {
                const row = macroByCode.get(`ECB_${currency}_EUR`);
                const change = row?.change_pct;
                const comparison = row?.previous_observed_at && row.previous_value != null
                  ? `Previous ECB release (${row.previous_observed_at}): ${referenceFormat.format(row.previous_value)} ${currency} per EUR`
                  : undefined;
                return <tr key={currency}>
                  <th scope="row">
                    <span>{currency}</span>
                    {(!commonEcbDate || row?.quality === "STALE") && <small className={`nt-market-row-meta${row?.quality === "STALE" ? " nt-warning" : ""}`}>
                      {!commonEcbDate && (row?.observed_at?.slice(0, 10) ?? "—")}{row?.quality === "STALE" ? `${commonEcbDate ? "" : " · "}Stale` : ""}
                    </small>}
                  </th>
                  <td title={`${currency} per EUR`}>{row?.value == null ? "—" : referenceFormat.format(row.value)}</td>
                  <td title={comparison} className={change == null || change === 0 ? "" : change > 0 ? "nt-positive" : "nt-negative"}>{percent(change)}</td>
                </tr>;
              })}</tbody>
            </table></div>
          </div>
          <div className="nt-subsection" data-layout-key="markets:participation">
            <div className="nt-subsection-title"><strong>Participation detail</strong><span>{equitySession ?? "Awaiting final session"} · n={sampleSize}</span></div>
            <div className="nt-market-table-scroll"><table className="nt-microtable"><tbody>
              <tr><td>Advancing</td><td>{sampleSize ? up : "—"}</td><td>{breadthPct == null ? "—" : `${breadthPct.toFixed(1)}%`}</td></tr>
              <tr><td>Declining</td><td>{sampleSize ? down : "—"}</td><td>{sampleSize ? `${(down / sampleSize * 100).toFixed(1)}%` : "—"}</td></tr>
              <tr><td>Unchanged</td><td>{sampleSize ? unchanged : "—"}</td><td>{sampleSize ? `${(unchanged / sampleSize * 100).toFixed(1)}%` : "—"}</td></tr>
              <tr><td>Adv / Decl ratio</td><td>{down ? (up/down).toFixed(2) : "—"}</td><td></td></tr>
              <tr><td>Up value</td><td>{valueTotal(participation?.up_value)}</td><td></td></tr>
              <tr><td>Down value</td><td>{valueTotal(participation?.down_value)}</td><td></td></tr>
              <tr><td>Unchanged value</td><td>{valueTotal(participation?.flat_value)}</td><td></td></tr>
            </tbody></table></div>
          </div>
          <div className="nt-subsection" data-layout-key="markets:relative-volume">
            <div className="nt-subsection-title"><strong>Relative volume</strong><span>20D leaders</span></div>
            <div className="nt-market-table-scroll"><table className="nt-microtable"><thead><tr><th>Symbol</th><th>RVol</th></tr></thead><tbody>
              {relativeVolumeLeaders.slice(0,6).map(item => <tr key={item.symbol}><td>{item.symbol}</td><td>{item.value.toFixed(2)}×</td></tr>)}
              {!relativeVolumeLeaders.length && <tr><td colSpan={2}>No relative-volume observations</td></tr>}
            </tbody></table></div>
          </div>
          <div className="nt-subsection" data-layout-key="markets:cross-asset">
            <div className="nt-subsection-title"><strong>Cross asset</strong><span>macro context</span></div>
            <div className="nt-market-table-scroll"><table className="nt-microtable">
              <thead><tr><th>Asset</th><th>Last</th><th>Chg</th></tr></thead>
              <tbody>{crossAsset.map(x => {
                const row = bySymbol.get(assetSymbols[x] ?? x);
                const rate = x === "US02Y" ? macroByCode.get("UST2Y") : x === "US10Y" ? macroByCode.get("UST10Y") : undefined;
                return <tr key={x}><td>{x}</td><td title={rate?.observed_at ?? row?.as_of ?? undefined}>{quoteText(rate?.value ?? row?.price)}</td><td>{percent(row?.change_pct)}</td></tr>;
              })}</tbody>
            </table></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
