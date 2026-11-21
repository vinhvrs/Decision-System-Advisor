"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import DataTable from "../DataTable";
import { valueText, type Calendar, type Crypto, type Health, type Macro, type News } from "../feeds";
import { useFeed } from "../useFeed";
import type { MarketRow } from "../marketSnapshot";

type Quote = { price: number; change: number | null; at: number };

const priceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const directionClass = (value: number | null | undefined) =>
  value == null ? "nt-heat-awaiting" : value > 0 ? "nt-heat-up" : value < 0 ? "nt-heat-down" : "nt-heat-flat";

const sectorClass = (sector: string) => {
  if (sector === "Technology") return "nt-sector-tech";
  if (sector === "Consumer") return "nt-sector-consumer";
  if (sector === "Communication") return "nt-sector-communication";
  if (sector === "Financials") return "nt-sector-financials";
  if (sector === "Energy") return "nt-sector-energy";
  if (sector === "Health Care") return "nt-sector-health";
  if (sector === "Industrials") return "nt-sector-industrials";
  if (sector === "Utilities") return "nt-sector-utilities";
  return "nt-sector-neutral";
};

const heat = [
  ["NVDA","Technology"],["MSFT","Technology"],["AAPL","Technology"],["AVGO","Technology"],
  ["AMD","Technology"],["ORCL","Technology"],["CRM","Technology"],["MU","Technology"],
  ["ADBE","Technology"],["QCOM","Technology"],["AMAT","Technology"],["PANW","Technology"],
  ["PLTR","Technology"],["AMZN","Consumer"],["TSLA","Consumer"],["COST","Consumer"],
  ["WMT","Consumer"],["HD","Consumer"],["MCD","Consumer"],["NKE","Consumer"],
  ["SBUX","Consumer"],["GOOGL","Communication"],["META","Communication"],["NFLX","Communication"],
  ["DIS","Communication"],["JPM","Financials"],["BAC","Financials"],["V","Financials"],
  ["MA","Financials"],["GS","Financials"],["XOM","Energy"],["CVX","Energy"],
  ["LLY","Health Care"],["UNH","Health Care"],["JNJ","Health Care"],["ABBV","Health Care"],
  ["CAT","Industrials"],["GE","Industrials"],["HON","Industrials"],["NEE","Utilities"],
];

const sectors = [
  "Technology","Communication","Financials","Consumer Discr.","Health Care","Industrials",
  "Staples","Energy","Utilities","Real Estate","Materials",
];

const crossAsset = ["DXY","US02Y","US10Y","WTI","GOLD","COPPER","BTC","ETH","SPY","QQQ","RSP","HYG","TLT","VIX","MOVE"];
const indexSymbols: Record<string, string> = { "S&P 500": "^GSPC", "NASDAQ 100": "^NDX", DOW: "^DJI", "RUSSELL (IWM proxy)": "IWM", VIX: "^VIX" };
const assetSymbols: Record<string, string> = { DXY: "DX-Y.NYB", WTI: "CL=F", GOLD: "GC=F", COPPER: "HG=F", BTC: "BTC-USD", ETH: "ETH-USD", VIX: "^VIX" };
const sectorNames: Record<string, string> = { "Consumer Cyclical": "Consumer Discr.", "Financial Services": "Financials", Healthcare: "Health Care" };
const eventTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const internalFields = [
  ["> 20D MA","Trend"],["> 50D MA","Trend"],["> 200D MA","Trend"],["RSP / SPY","Equal wt"],
  ["PUT / CALL","Options"],["VIX TERM","Volatility"],["SMALL / LARGE CAP","Breadth"],["HIGH BETA / LOW VOL","Factor"],
  ["CYCLICAL / DEFENSIVE","Factor"],["SEMIS / SOFTWARE","Industry"],["BANKS / UTILITIES","Sector"],
  ["CREDIT SPREAD","Credit"],["REAL YIELD PROXY","Rates"],["OIL / EQUITIES","Cross asset"],
  ["GOLD / DXY","Cross asset"],
];

function ago(ts: number | null) {
  if (!ts) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export default function MarketsWorkspace({ initialRows }: { initialRows: MarketRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const macro = useFeed<Macro>("/api/v1/macro/dashboard", 60000);
  const crypto = useFeed<Crypto>("/api/v1/crypto-context", 60000);
  const calendar = useFeed<Calendar>("/api/v1/economic-calendar?limit=12", 60000);
  const health = useFeed<Health>("/api/v1/data-health", 60000);
  const news = useFeed<{ data: News[] }>("/api/news", 60000);
  const realtime = useFeed<{ upstream: string; quality: string; source: string }>("/api/v1/realtime/status", 30000);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [updated, setUpdated] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;

    async function refresh() {
      try {
        const response = await fetch("/api/v1/market-heatmap", { cache: "no-store", signal: controller.signal });
        if (response.ok) setRows((await response.json()).data ?? []);
      } catch {
        // Keep last successful snapshot.
      }
      setUpdated(Date.now());
    }

    function connect() {
      if (controller.signal.aborted) return;
      socket = new WebSocket("wss://data.aitemple.tech/ws/quotes");
      socket.onopen = () => {
        setConnected(true);
        socket.send(JSON.stringify({ type: "subscribe", symbols: heat.map(([symbol]) => symbol) }));
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
            },
          });
          setUpdated(Date.now());
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
  }, []);

  const bySymbol = useMemo(() => new Map(rows.map(row => [row.symbol, row])), [rows]);
  const equities = rows.filter(row => row.market === "stock" && row.change_pct != null);
  const leaders = [...equities].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
  const laggards = [...leaders].reverse();
  const macroByCode = new Map(macro.data?.data.map(row => [row.series_code, row]));
  const freshQuotes = Object.values(quotes).filter(quote => updated - quote.at < 90000).length;
  const socketStatus = connected ? freshQuotes ? "LIVE" : "CONNECTED" : "DISCONNECTED";
  const upValue = equities.filter(row => (row.change_pct ?? 0) > 0 && row.traded_value != null);
  const downValue = equities.filter(row => (row.change_pct ?? 0) < 0 && row.traded_value != null);
  const valueTotal = (items: MarketRow[]) => items.length ? `$${(items.reduce((sum, row) => sum + (row.traded_value ?? 0), 0) / 1e9).toFixed(2)}B` : "—";
  const up = equities.filter(row => (row.change_pct ?? 0) > 0).length;
  const down = equities.filter(row => (row.change_pct ?? 0) < 0).length;
  const unchanged = Math.max(0, equities.length - up - down);
  const traded = equities.flatMap(row => row.traded_value == null ? [] : [row.traded_value]);
  const storedTimes = rows.flatMap(row => row.as_of ? [Date.parse(row.as_of)] : []).filter(Number.isFinite);
  const latestStored = storedTimes.length ? Math.max(...storedTimes) : null;
  const quoteTimes = Object.values(quotes).map(q => q.at).filter(Number.isFinite);
  const latestQuote = quoteTimes.length ? Math.max(...quoteTimes) : null;
  const breadthPct = equities.length ? (up / equities.length) * 100 : null;

  const sourceLedger = [
    ["Quotes", socketStatus, latestQuote ? ago(latestQuote) : "—", `${Object.keys(quotes).length}/${heat.length}`],
    ["Stored market", rows.length ? "AVAILABLE" : "AWAITING", latestStored ? ago(latestStored) : "—", rows.length ? String(rows.length) : "—"],
    ["Breadth", equities.length ? "PARTIAL" : "AWAITING", latestStored ? ago(latestStored) : "—", equities.length ? String(equities.length) : "—"],
    ["OHLC", health.data?.quality ?? "AWAITING", "—", health.data ? `${health.data.pipeline.covered}/${health.data.pipeline.total}` : "—"],
    ["Fundamentals", "PARTIAL", "—", "—"],
    ["Estimates", "PARTIAL", "—", "—"],
    ["Filings", "PARTIAL", "—", "—"],
    ["News", "PARTIAL", "—", "—"],
  ];

  return (
    <div className="nt-workspace nt-market-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Markets / US Equities</div>
          <h1>Market Database</h1>
        </div>
        {[...Object.keys(indexSymbols), "US10Y"].map(name => (
          <div className="nt-index" key={name}>
            <div className="nt-index-name">{name}</div>
            <div className="nt-index-values"><span>{name === "US10Y" ? valueText(macroByCode.get("UST10Y")?.value) : valueText(bySymbol.get(indexSymbols[name])?.price)}</span><span className="nt-muted">{name === "US10Y" ? macroByCode.get("UST10Y")?.quality ?? "Awaiting Treasury" : percent(bySymbol.get(indexSymbols[name])?.change_pct)}</span></div>
          </div>
        ))}
      </section>

      <div className="nt-dense-grid">
        {[
          ["Session",latestStored ? new Date(latestStored).toISOString().slice(0,10) : "—","Latest stored observation"],
          ["Universe","US Equities","Coverage gated"],
          ["Breadth", equities.length ? `${up} ↑ / ${down} ↓ / ${unchanged} =` : "—", "Tracked equities"],
          ["Volume", traded.length ? `$${(traded.reduce((a,b) => a+b, 0)/1e9).toFixed(2)}B` : "—", "Tracked traded value"],
          ["Advancing", breadthPct == null ? "—" : `${breadthPct.toFixed(1)}%`, "Observed universe"],
          ["Quotes", socketStatus, realtime.data ? `${realtime.data.source} · ${realtime.data.upstream}` : `${freshQuotes}/${heat.length} fresh`],
          ["Stored rows", rows.length ? String(rows.length) : "—", latestStored ? `age ${ago(latestStored)}` : "Awaiting"],
          ["Cross asset","—","Coverage gated"],
          ["Options","—","Coverage gated"],
          ["News", news.data ? String(news.data.data.filter(item => item.published_at).length) : "—","Timestamped headlines"],
          ["Events", calendar.data ? String(calendar.data.events.length) : "—", calendar.data?.source ?? "Calendar"],
          ["Data quality",health.data?.quality ?? "AWAITING","Backend coverage"],
        ].map(([k,v,s]) => (
          <div className={`nt-data-cell ${k === "Data quality" ? "nt-data-warning" : k === "Quotes" && v === "LIVE" ? "nt-data-live" : k === "Advancing" ? "nt-data-accent" : ""}`} key={k}>
            <div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div>
          </div>
        ))}
      </div>

      <div className="nt-grid nt-grid-markets nt-market-main-grid">
        <aside className="nt-section-stack nt-market-rail">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Sector breadth matrix</strong><span className="nt-panel-meta">chg · adv · MA · rvol</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th><th>&gt;50D</th><th>RVol</th></tr></thead>
              <tbody>{sectors.map(sector => {
                const sample = equities.filter(row => (sectorNames[row.sector ?? ""] ?? row.sector) === sector);
                return <tr key={sector}><td>{sector} {sample.length ? `(${sample.length})` : ""}</td><td>{percent(sample.length ? sample.reduce((sum, row) => sum + (row.change_pct ?? 0), 0) / sample.length : null)}</td><td>{percent(sample.length ? sample.filter(row => (row.change_pct ?? 0) > 0).length / sample.length * 100 : null)?.replace("+", "")}</td><td title="Requires sector-wide MA data">—</td><td title="Requires historical volume baselines">—</td></tr>;
              })}</tbody>
            </table>
          </section>

          <section className="nt-panel nt-market-grow-panel">
            <div className="nt-panel-title"><strong>Cross-asset monitor</strong><span className="nt-panel-meta">macro context</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Asset</th><th>Last</th><th>Chg</th><th>Z</th></tr></thead>
              <tbody>{crossAsset.map(x => {
                const row = bySymbol.get(assetSymbols[x] ?? x);
                const rate = x === "US02Y" ? macroByCode.get("UST2Y") : x === "US10Y" ? macroByCode.get("UST10Y") : undefined;
                return <tr key={x}><td>{x}</td><td title={rate?.observed_at ?? row?.as_of ?? undefined}>{valueText(rate?.value ?? row?.price)}</td><td>{percent(row?.change_pct)}</td><td title="Requires standardized historical baseline">—</td></tr>;
              })}</tbody>
            </table>
          </section>
        </aside>

        <section className="nt-section-stack nt-market-center">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Constituent heatmap / breadth surface</strong><span className="nt-panel-meta">price · sector · source</span></div>
            <div className="nt-panel-body">
              <div className="nt-heatmap">
                {heat.map(([symbol, sector]) => {
                  const stored = bySymbol.get(symbol);
                  const quote = quotes[symbol];
                  const useQuote = quote && (!stored?.as_of || quote.at > Date.parse(stored.as_of));
                  const price = useQuote ? quote.price : stored?.price;
                  const change = useQuote ? quote.change : stored?.change_pct;
                  const live = Boolean(connected && useQuote && updated - quote.at < 90000);

                  return (
                    <div className={`nt-heat-cell ${directionClass(change)}`} key={symbol}>
                      <div className="nt-heat-symbol-row">
                        <b>{symbol}</b>
                        <span className={`nt-sector-dot ${sectorClass(sector)}`} aria-label={sector} />
                      </div>
                      <span className="nt-heat-price nt-mono">{price == null ? "—" : `${priceFormat.format(price)}`}</span>
                      <span className={`nt-heat-change nt-mono ${change == null ? "nt-muted" : change > 0 ? "nt-positive" : change < 0 ? "nt-negative" : ""}`}>
                        {percent(change)}
                      </span>
                      <small title={useQuote ? new Date(quote.at).toISOString() : stored?.as_of ?? undefined}>
                        <span className={`nt-sector-name ${sectorClass(sector)}`}>{sector}</span> · {live ? "Live" : useQuote ? "Last quote" : stored ? "Stored" : "Awaiting"}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="nt-kpi-row">
            {[
              ["ADV / DECL", equities.length ? `${up} / ${down}` : "—", "Breadth"],
              ["UP / DOWN VALUE",`${valueTotal(upValue)} / ${valueTotal(downValue)}`,"Traded value by session direction"],
              ["NEW HIGHS","—","52W"],
              ["NEW LOWS","—","52W"],
              ["> 20D MA","—","Trend"],
              ["> 50D MA","—","Trend"],
            ].map(([label,value,note]) => (
              <div className="nt-kpi" key={label}>
                <div className="nt-label">{label}</div><div className="nt-kpi-value">{value}</div><div className="nt-kpi-note">{note}</div>
              </div>
            ))}
          </div>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Market internals database</strong><span className="nt-panel-meta">breadth · vol · trend · options · cross asset</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Field</th><th>Value</th><th>Prev</th><th>Δ</th><th>State</th><th>Source</th><th>As of</th></tr></thead>
              <tbody>
                {internalFields.map(([field, category]) => (
                  <tr key={field}><td>{field}</td><td>—</td><td>—</td><td>—</td><td>Awaiting</td><td>{category}</td><td>—</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="nt-market-bottom-grid">
            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Source freshness ledger</strong><span className="nt-panel-meta">dataset · lag · coverage</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Dataset</th><th>State</th><th>Lag</th><th>Coverage</th></tr></thead>
                <tbody>
                  {sourceLedger.map(([dataset,state,lag,coverage]) => (
                    <tr key={dataset}><td>{dataset}</td><td className={state === "LIVE" ? "nt-positive" : state === "AWAITING" ? "nt-muted" : "nt-warning"}>{state}</td><td>{lag}</td><td>{coverage}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Leadership / laggards</strong><span className="nt-panel-meta">observed rows only</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Rank</th><th>Leader</th><th>Chg</th><th>Laggard</th><th>Chg</th></tr></thead>
                <tbody>
                  {[0,1,2,3].map(i => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td>{leaders[i]?.symbol ?? "—"}</td>
                      <td className="nt-positive">{percent(leaders[i]?.change_pct)}</td>
                      <td>{laggards[i]?.symbol ?? "—"}</td>
                      <td className="nt-negative">{percent(laggards[i]?.change_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="nt-database-note">Ranks appear only from rows with finite observed session change.</div>
            </section>

            <section className="nt-panel">
              <div className="nt-panel-title"><strong>Breadth / regime monitor</strong><span className="nt-panel-meta">no synthetic regime</span></div>
              <table className="nt-microtable">
                <tbody>
                  <tr><td>Observed equities</td><td>{equities.length || "—"}</td><td>Stored session</td></tr>
                  <tr><td>Advancing</td><td>{up || "—"}</td><td>{breadthPct == null ? "—" : `${breadthPct.toFixed(1)}%`}</td></tr>
                  <tr><td>Declining</td><td>{down || "—"}</td><td>{equities.length ? `${((down/equities.length)*100).toFixed(1)}%` : "—"}</td></tr>
                  <tr><td>Unchanged</td><td>{unchanged || "—"}</td><td>Observed</td></tr>
                  <tr><td>Trend regime</td><td>—</td><td>Awaiting MA breadth</td></tr>
                  <tr><td>Vol regime</td><td>—</td><td>Awaiting VIX term</td></tr>
                  <tr><td>Credit regime</td><td>—</td><td>Awaiting spread feed</td></tr>
                  <tr><td>Signal state</td><td>NEUTRAL</td><td>No inference</td></tr>
                </tbody>
              </table>
            </section>
          </div>
        </section>

        <aside className="nt-section-stack nt-market-rail">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Scan lists</strong><span className="nt-panel-meta">session</span></div>
            <table className="nt-microtable">
              <thead><tr><th>List</th><th>#</th><th>Lead</th></tr></thead>
              <tbody>
                <tr><td>Top gainers</td><td>{equities.length ? up : "—"}</td><td>{up ? leaders[0]?.symbol : "—"}</td></tr>
                <tr><td>Top losers</td><td>{equities.length ? down : "—"}</td><td>{down ? laggards[0]?.symbol : "—"}</td></tr>
                <tr><td>Rel volume</td><td>—</td><td>—</td></tr>
                <tr><td>Gap up</td><td>—</td><td>—</td></tr>
                <tr><td>Gap down</td><td>—</td><td>—</td></tr>
                <tr><td>New highs</td><td>—</td><td>—</td></tr>
              </tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Events / calendar</strong><span className="nt-panel-meta">ET · impact</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Event</th><th>Time</th><th>Impact</th></tr></thead>
              <tbody>{calendar.data?.events.length ? calendar.data.events.map(event => <tr key={event.id}><td>{event.title} · {event.currency}</td><td>{event.scheduled_at ? eventTime.format(new Date(event.scheduled_at)) : "—"}</td><td>{event.impact}</td></tr>) : <tr><td colSpan={3}>{calendar.error ?? "No calendar observations"}</td></tr>}</tbody>
            </table>
          </section>

          <section className="nt-panel nt-market-grow-panel">
            <div className="nt-panel-title"><strong>Feed health / coverage notes</strong><span className="nt-panel-meta">database coverage</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Dataset</th><th>State</th><th>Lag</th></tr></thead>
              <tbody>
                {sourceLedger.map(([dataset,state,lag]) => (
                  <tr key={dataset}><td>{dataset}</td><td className={state === "LIVE" ? "nt-positive" : "nt-warning"}>{state}</td><td>{lag}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="nt-database-note">
              No directional state is generated from unavailable fields. Last UI refresh: {updated ? new Date(updated).toLocaleTimeString() : "—"}.
            </div>
          </section>
        </aside>
      </div>
      <DataTable title="Macro observations and spreads" columns={["Series","Value","Unit","Quality","Source","Observed"]}
        rows={[...(macro.data?.data ?? []), ...(macro.data?.spreads ?? [])].map(row => ({ key: row.series_code, cells: [row.series_code, valueText(row.value), row.unit, row.quality, row.source ?? (row.series_code.includes("-") ? "Calculated spread" : undefined), row.observed_at] }))}
        empty={macro.error ?? "No macro series returned."} />
      <DataTable title="Crypto derivatives context" columns={["Metric","Value","Unit","Venue","Quality","Observed"]}
        rows={(crypto.data?.data ?? []).map(row => ({ key: row.metric_code, cells: [row.metric_code, valueText(row.value), row.metadata?.unit, row.source, row.quality, row.observed_at] }))}
        empty={crypto.error ?? "No crypto derivatives observations."} />
      <div className="nt-database-note">Sector changes are equal-weight observations from the tracked sample. Options, full-market breadth, bid/ask depth, historical z-scores and missing cross-asset benchmarks require additional sources. <Link href="/documents">See source coverage and missing datasets ↗</Link></div>
    </div>
  );
}
