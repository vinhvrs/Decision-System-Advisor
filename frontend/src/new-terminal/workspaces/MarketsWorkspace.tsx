"use client";

import { useEffect, useState } from "react";

type MarketRow = { symbol: string; market: string; price: number | null; change_pct: number | null; traded_value: number | null; as_of: string | null };
type Quote = { price: number; change: number | null; at: number };
const priceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const heat = [
  ["NVDA","Technology"],["MSFT","Technology"],["AAPL","Technology"],["AVGO","Technology"],
  ["AMD","Technology"],["ORCL","Technology"],["CRM","Technology"],["MU","Technology"],
  ["AMZN","Consumer"],["TSLA","Consumer"],["COST","Consumer"],["WMT","Consumer"],
  ["GOOGL","Communication"],["META","Communication"],["NFLX","Communication"],["JPM","Financials"],
  ["BAC","Financials"],["XOM","Energy"],["LLY","Health Care"],["CAT","Industrials"],
];

const sectors = ["Technology","Communication","Financials","Consumer Discr.","Health Care","Industrials","Staples","Energy","Utilities","Real Estate","Materials"];

const matrix = [
  ["ADV / DECL","—","Breadth"],
  ["UP / DOWN VOL","—","Volume"],
  ["NEW HIGHS","—","52W"],
  ["NEW LOWS","—","52W"],
  ["> 20D MA","—","Trend"],
  ["> 50D MA","—","Trend"],
  ["> 200D MA","—","Trend"],
  ["RSP / SPY","—","Equal wt"],
  ["PUT / CALL","—","Options"],
  ["VIX TERM","—","Volatility"],
  ["DXY","—","FX"],
  ["US10Y","—","Rates"],
];

const crossAsset = ["DXY","US02Y","US10Y","WTI","GOLD","COPPER","BTC","ETH"];
const events = ["Macro release","Fed speaker","Earnings event","Treasury auction","Energy inventory","Options expiry"];
const movers = ["Top gainers","Top losers","Rel volume","Gap up","Gap down","New highs"];

export default function MarketsWorkspace() {
  const [rows, setRows] = useState<MarketRow[]>([]);
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
      } catch { /* Keep the last successful snapshot. */ }
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
          if ((quote.type !== "quote" && quote.type !== "initial_quote") || typeof quote.symbol !== "string" || !Number.isFinite(quote.price) || quote.price <= 0) return;
          const at = quote.type === "initial_quote" ? quote.quote_ts : quote.ts;
          if (!Number.isFinite(at)) return;
          setQuotes(previous => previous[quote.symbol]?.at > at ? previous : {
            ...previous,
            [quote.symbol]: { price: quote.price, change: Number.isFinite(quote.change) ? quote.change : null, at },
          });
          setUpdated(Date.now());
        } catch { /* Ignore frames that are not quotes. */ }
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

  const bySymbol = new Map(rows.map(row => [row.symbol, row]));
  const equities = rows.filter(row => row.market === "stock" && row.change_pct != null);
  const leaders = [...equities].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
  const up = equities.filter(row => (row.change_pct ?? 0) > 0).length;
  const down = equities.filter(row => (row.change_pct ?? 0) < 0).length;
  const traded = equities.flatMap(row => row.traded_value == null ? [] : [row.traded_value]);
  return (
    <div className="nt-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Markets / US Equities</div>
          <h1>Market Database</h1>
        </div>
        {["S&P 500","NASDAQ","DOW","RUSSELL","VIX","US10Y"].map((name) => (
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
          ["Breadth", equities.length ? `${up} ↑ / ${down} ↓` : "—", "Tracked equities · stored session"],
          ["Volume", traded.length ? `$${(traded.reduce((a,b) => a+b, 0)/1e9).toFixed(2)}B` : "—", "Tracked equity traded value"],
          ["Volatility","—","Awaiting feed"],
          ["Rates","—","Awaiting feed"],
          ["FX","—","Awaiting feed"],
          ["Commodities","—","Awaiting feed"],
          ["Options","—","Awaiting feed"],
          ["News","—","Timestamp gated"],
          ["Events","—","Calendar"],
          ["Data quality","PARTIAL","No inference"],
        ].map(([k,v,s]) => (
          <div className="nt-data-cell" key={k}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>
        ))}
      </div>

      <div className="nt-grid nt-grid-markets">
        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Sector breadth matrix</strong><span className="nt-panel-meta">chg · adv · MA · rvol</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th><th>&gt;50D</th><th>RVol</th></tr></thead>
              <tbody>{sectors.map((sector)=><tr key={sector}><td>{sector}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Cross-asset monitor</strong><span className="nt-panel-meta">macro context</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Asset</th><th>Last</th><th>Chg</th><th>Z</th></tr></thead>
              <tbody>{crossAsset.map((x)=><tr key={x}><td>{x}</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>
        </aside>

        <section className="nt-section-stack">
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
                  const live = connected && useQuote && updated - quote.at < 90000;
                  return <div className="nt-heat-cell" key={symbol}>
                    <b>{symbol}</b>
                    <span className="nt-mono">{price == null ? "—" : `$${priceFormat.format(price)}`} {percent(change)}</span>
                    <small title={useQuote ? new Date(quote.at).toISOString() : stored?.as_of ?? undefined}>{sector} · {live ? "Live feed" : useQuote ? "Last quote" : stored ? "Stored" : "Awaiting"}</small>
                  </div>;
                })}

              </div>
            </div>
          </section>

          <div className="nt-kpi-row">
            {matrix.slice(0,6).map(([label,value,note])=>(
              <div className="nt-kpi" key={label}><div className="nt-label">{label}</div><div className="nt-kpi-value">{value}</div><div className="nt-kpi-note">{note}</div></div>
            ))}
          </div>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Market internals database</strong><span className="nt-panel-meta">breadth · vol · trend · options</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Field</th><th>Value</th><th>Prev</th><th>Δ</th><th>State</th><th>Source</th><th>As of</th></tr></thead>
              <tbody>{matrix.slice(6).map(([field])=><tr key={field}><td>{field}</td><td>—</td><td>—</td><td>—</td><td>Awaiting</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>
        </section>

        <aside className="nt-section-stack">
          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Scan lists</strong><span className="nt-panel-meta">session</span></div>
            <table className="nt-microtable">
              <thead><tr><th>List</th><th>#</th><th>Lead</th></tr></thead>
              <tbody>{movers.map((m)=><tr key={m}><td>{m}</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Events / calendar</strong><span className="nt-panel-meta">ET · impact</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Event</th><th>Time</th><th>Impact</th></tr></thead>
              <tbody>{events.map((e)=><tr key={e}><td>{e}</td><td>—</td><td>—</td></tr>)}</tbody>
            </table>
          </section>

          <section className="nt-panel">
            <div className="nt-panel-title"><strong>Feed health</strong><span className="nt-panel-meta">database coverage</span></div>
            <table className="nt-microtable">
              <tbody>
                {["Quotes","OHLC","Fundamentals","Estimates","Filings","News","Breadth","Options"].map(x=><tr key={x}><td>{x}</td><td className="nt-warning">PARTIAL</td><td>—</td></tr>)}
              </tbody>
            </table>
            <div className="nt-database-note">No directional state is generated from unavailable fields.</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
