"use client";

import { useEffect, useMemo, useState } from "react";

import type { MarketRow } from "../marketSnapshot";

type Quote = { price: number; change: number | null; at: number };

const priceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const heat = [
  ["NVDA","Technology"],["MSFT","Technology"],["AAPL","Technology"],["AVGO","Technology"],
  ["AMD","Technology"],["ORCL","Technology"],["CRM","Technology"],["MU","Technology"],
  ["AMZN","Consumer"],["TSLA","Consumer"],["COST","Consumer"],["WMT","Consumer"],
  ["GOOGL","Communication"],["META","Communication"],["NFLX","Communication"],["JPM","Financials"],
  ["BAC","Financials"],["XOM","Energy"],["LLY","Health Care"],["CAT","Industrials"],
];

const sectors = [
  "Technology","Communication","Financials","Consumer Discr.","Health Care","Industrials",
  "Staples","Energy","Utilities","Real Estate","Materials",
];

const crossAsset = ["DXY","US02Y","US10Y","WTI","GOLD","COPPER","BTC","ETH","SPY","QQQ","RSP","HYG","TLT","VIX","MOVE"];
const events = ["Macro release","Fed speaker","Earnings event","Treasury auction","Energy inventory","Options expiry"];

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
    ["Quotes", connected ? "LIVE" : quoteTimes.length ? "DELAYED" : "AWAITING", latestQuote ? ago(latestQuote) : "—", `${Object.keys(quotes).length}/${heat.length}`],
    ["Stored market", rows.length ? "AVAILABLE" : "AWAITING", latestStored ? ago(latestStored) : "—", rows.length ? String(rows.length) : "—"],
    ["Breadth", equities.length ? "PARTIAL" : "AWAITING", latestStored ? ago(latestStored) : "—", equities.length ? String(equities.length) : "—"],
    ["OHLC", "PARTIAL", "—", "—"],
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
        {["S&P 500","NASDAQ","DOW","RUSSELL","VIX","US10Y"].map(name => (
          <div className="nt-index" key={name}>
            <div className="nt-index-name">{name}</div>
            <div className="nt-index-values"><span>—</span><span className="nt-muted">awaiting</span></div>
          </div>
        ))}
      </section>

      <div className="nt-dense-grid">
        {[
          ["Session","US Regular","Market clock"],
          ["Universe","US Equities","Coverage gated"],
          ["Breadth", equities.length ? `${up} ↑ / ${down} ↓ / ${unchanged} =` : "—", "Tracked equities"],
          ["Volume", traded.length ? `$${(traded.reduce((a,b) => a+b, 0)/1e9).toFixed(2)}B` : "—", "Tracked traded value"],
          ["Advancing", breadthPct == null ? "—" : `${breadthPct.toFixed(1)}%`, "Observed universe"],
          ["Quotes", connected ? "LIVE" : "PARTIAL", `${Object.keys(quotes).length}/${heat.length} symbols`],
          ["Stored rows", rows.length ? String(rows.length) : "—", latestStored ? `age ${ago(latestStored)}` : "Awaiting"],
          ["Cross asset","—","Coverage gated"],
          ["Options","—","Coverage gated"],
          ["News","—","Timestamp gated"],
          ["Events","—","Calendar"],
          ["Data quality","PARTIAL","No inference"],
        ].map(([k,v,s]) => (
          <div className="nt-data-cell" key={k}>
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
              <tbody>{sectors.map(sector => <tr key={sector}><td>{sector}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel nt-market-grow-panel">
            <div className="nt-panel-title"><strong>Cross-asset monitor</strong><span className="nt-panel-meta">macro context</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Asset</th><th>Last</th><th>Chg</th><th>Z</th></tr></thead>
              <tbody>{crossAsset.map(x => <tr key={x}><td>{x}</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody>
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
                    <div className="nt-heat-cell" key={symbol}>
                      <b>{symbol}</b>
                      <span className="nt-mono">{price == null ? "—" : `$${priceFormat.format(price)}`} {percent(change)}</span>
                      <small title={useQuote ? new Date(quote.at).toISOString() : stored?.as_of ?? undefined}>
                        {sector} · {live ? "Live" : useQuote ? "Last quote" : stored ? "Stored" : "Awaiting"}
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
              ["UP / DOWN VOL","—","Volume"],
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
                <tr><td>Top gainers</td><td>{leaders.length || "—"}</td><td>{leaders[0]?.symbol ?? "—"}</td></tr>
                <tr><td>Top losers</td><td>{laggards.length || "—"}</td><td>{laggards[0]?.symbol ?? "—"}</td></tr>
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
              <tbody>{events.map(e => <tr key={e}><td>{e}</td><td>—</td><td>—</td></tr>)}</tbody>
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
    </div>
  );
}
