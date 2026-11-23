"use client";

import { useEffect, useMemo, useState } from "react";

import DataTable from "../DataTable";
import { calendarCoverageState, calendarEventsInDeclaredCoverage, valueText, type Calendar, type DailyAnalytics, type Universe, type Crypto, type Macro, type News } from "../feeds";
import { useFeed } from "../useFeed";
import type { MarketRow } from "../marketSnapshot";

type Quote = { price: number; change: number | null; at: number };

const priceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const directionClass = (value: number | null | undefined) =>
  value == null ? "nt-heat-awaiting" : value > 0 ? "nt-heat-up" : value < 0 ? "nt-heat-down" : "nt-heat-flat";

const normalizeSector = (sector: string | null | undefined) => {
  if (sector === "Consumer Cyclical") return "Consumer Discr.";
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

export default function MarketsWorkspace({ initialRows }: { initialRows: MarketRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const daily = useFeed<DailyAnalytics>("/api/market/daily-analytics", 300000);
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const macro = useFeed<Macro>("/api/v1/macro/dashboard", 60000);
  const crypto = useFeed<Crypto>("/api/v1/crypto-context", 60000);
  const calendar = useFeed<Calendar>("/api/v1/economic-calendar?limit=12", 60000);
  const news = useFeed<{ data: News[] }>("/api/news", 60000);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [updated, setUpdated] = useState(0);
  const [connected, setConnected] = useState(false);
  const subscriptionSymbols = useMemo(
    () => initialRows.filter(row => row.market === "stock").map(row => row.symbol).slice(0, 60),
    [initialRows],
  );

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
  }, [subscriptionSymbols]);

  const bySymbol = useMemo(() => new Map(rows.map(row => [row.symbol, row])), [rows]);
  const equities = rows.filter(row => row.market === "stock" && row.change_pct != null);
  const leaders = [...equities].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
  const laggards = [...leaders].reverse();
  const macroByCode = new Map(macro.data?.data.map(row => [row.series_code, row]));
  const upValue = equities.filter(row => (row.change_pct ?? 0) > 0 && row.traded_value != null);
  const downValue = equities.filter(row => (row.change_pct ?? 0) < 0 && row.traded_value != null);
  const valueTotal = (items: MarketRow[]) => items.length ? `$${(items.reduce((sum, row) => sum + (row.traded_value ?? 0), 0) / 1e9).toFixed(2)}B` : "—";
  const up = equities.filter(row => (row.change_pct ?? 0) > 0).length;
  const down = equities.filter(row => (row.change_pct ?? 0) < 0).length;
  const unchanged = Math.max(0, equities.length - up - down);
  const traded = equities.flatMap(row => row.traded_value == null ? [] : [row.traded_value]);
  const equitySession = equities.map(row => row.session_date ?? row.as_of?.slice(0,10) ?? null)
    .reduce<string | null>((latest, session) => session && (!latest || session > latest) ? session : latest, null);
  const breadthPct = equities.length ? (up / equities.length) * 100 : null;
  const heatRows = [...equities]
    .sort((a, b) => {
      const sectorA = normalizeSector(a.sector);
      const sectorB = normalizeSector(b.sector);
      return sectorA.localeCompare(sectorB) || ((b.traded_value ?? 0) - (a.traded_value ?? 0));
    })
    .slice(0, 40);
  const calendarEvents = calendarEventsInDeclaredCoverage(calendar.data);
  const calendarState = calendarCoverageState(calendar.data);

  const dailyRows = daily.data?.data;
  const equitySymbols = new Set(universe.data?.data.filter(item => item.asset_class === "EQUITY").map(item => item.symbol));
  const breadthEquities = rows.filter(row => equitySymbols.has(row.symbol));
  const breadthSession = breadthEquities.map(row => dailyRows?.[row.symbol]?.as_of)
    .reduce<string | null>((latest, session) => session && (!latest || session > latest) ? session : latest, null);
  const dailyGroup = (sample: MarketRow[], code: string) => {
    const current = sample.flatMap(row => {
      const metric = dailyRows?.[row.symbol]?.metrics[code];
      return metric && metric.as_of === breadthSession ? [metric] : [];
    });
    const observed = current.filter(metric =>
      metric.quality === "OK" && metric.value != null && Number.isFinite(metric.value));
    const emptyState = daily.error || universe.error ? "UNAVAILABLE"
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
  const mostActive = [...equities]
    .filter(row => row.traded_value != null)
    .sort((a, b) => (b.traded_value ?? 0) - (a.traded_value ?? 0))
    .slice(0, 18);
  const recentHeadlines = (news.data?.data ?? []).filter(item => item.published_at && item.title?.trim()).slice(0, 18);
  const marketTape = [...rows]
    .filter(row => row.market === "stock")
    .sort((a, b) => ((b.traded_value ?? 0) - (a.traded_value ?? 0)))
    .slice(0, 30);
  const sectorPerformance = sectors.map(sector => {
    const sample = equities.filter(row => (sectorNames[row.sector ?? ""] ?? row.sector) === sector);
    return {
      sector,
      count: sample.length,
      change: sample.length ? sample.reduce((sum, row) => sum + (row.change_pct ?? 0), 0) / sample.length : null,
      advance: sample.length ? sample.filter(row => (row.change_pct ?? 0) > 0).length / sample.length * 100 : null,
    };
  }).sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));

  return (
    <div className="nt-workspace nt-market-workspace">
      <section className="nt-context-strip">
        <div className="nt-context-title">
          <div className="nt-label nt-info">Markets / US Equities</div>
          <h1>Market Overview</h1>
        </div>
        {[...Object.keys(indexSymbols), "US10Y"].map(name => (
          <div className="nt-index" key={name}>
            <div className="nt-index-name">{name}</div>
            <div className="nt-index-values">
              <span>{name === "US10Y" ? valueText(macroByCode.get("UST10Y")?.value) : valueText(bySymbol.get(indexSymbols[name])?.price)}</span>
              {name !== "US10Y" && <span className={(bySymbol.get(indexSymbols[name])?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{percent(bySymbol.get(indexSymbols[name])?.change_pct)}</span>}
            </div>
          </div>
        ))}
      </section>

      <div className="nt-dense-grid nt-financial-strip">
        {[
          ["Equity session", equitySession ?? "—", equities.some(row => row.session_final) ? "Final" : "Latest"],
          ["Feed", connected ? "LIVE" : "SNAPSHOT", updated ? `updated ${new Date(updated).toISOString().slice(11,19)}Z` : ""],
          ["Adv / Decl", equities.length ? `${up} / ${down}` : "—", equities.length ? `${unchanged} unchanged` : ""],
          ["Advancing", breadthPct == null ? "—" : `${breadthPct.toFixed(1)}%`, "Breadth"],
          ["Traded value", traded.length ? `$${(traded.reduce((a,b) => a+b, 0)/1e9).toFixed(2)}B` : "—", "Tracked equities"],
          ["> 20D MA", breadthValue(trend[0]), breadthSession ?? ""],
          ["> 50D MA", breadthValue(trend[1]), breadthSession ?? ""],
          ["> 200D MA", breadthValue(trend[2]), breadthSession ?? ""],
          ["Rel volume", relativeVolumeLeaders[0] ? `${relativeVolumeLeaders[0].symbol} ${relativeVolumeLeaders[0].value.toFixed(2)}×` : "—", "20D"],
          ["Headlines", news.data ? String(news.data.data.filter(item => item.published_at && item.title?.trim()).length) : "—", "Latest"],
          ["Events", calendar.data ? String(calendarEvents.length) : "—", calendarState.valid ? "Calendar" : calendarState.label],
        ].map(([k,v,s]) => (
          <div className="nt-data-cell" key={k}>
            <div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div>
          </div>
        ))}
      </div>

      <div className="nt-grid nt-grid-markets nt-market-main-grid">
        <aside className="nt-market-rail nt-flat-rail">
          <section className="nt-flat-surface">
            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Sector breadth</strong><span>session + trend</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th><th>&gt;50D</th><th>RVol</th></tr></thead>
                <tbody>{sectors.map(sector => {
                  const sample = equities.filter(row => (sectorNames[row.sector ?? ""] ?? row.sector) === sector);
                  const sectorEquities = breadthEquities.filter(row => (sectorNames[row.sector ?? ""] ?? row.sector) === sector);
                  const ma = dailyGroup(sectorEquities, "above_sma50");
                  const rvol = dailyGroup(sectorEquities, "rvol20");
                  return <tr key={sector}><td>{sector}</td><td>{percent(sample.length ? sample.reduce((sum, row) => sum + (row.change_pct ?? 0), 0) / sample.length : null)}</td><td>{sample.length ? `${(sample.filter(row => (row.change_pct ?? 0) > 0).length / sample.length * 100).toFixed(0)}%` : "—"}</td><td>{breadthValue(ma)}</td><td>{rvol.value === null ? "—" : `${rvol.value.toFixed(2)}×`}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Cross asset</strong><span>macro context</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Asset</th><th>Last</th><th>Chg</th></tr></thead>
                <tbody>{crossAsset.map(x => {
                  const row = bySymbol.get(assetSymbols[x] ?? x);
                  const rate = x === "US02Y" ? macroByCode.get("UST2Y") : x === "US10Y" ? macroByCode.get("UST10Y") : undefined;
                  return <tr key={x}><td>{x}</td><td title={rate?.observed_at ?? row?.as_of ?? undefined}>{valueText(rate?.value ?? row?.price)}</td><td>{percent(row?.change_pct)}</td></tr>;
                })}</tbody>
              </table>
            </div>

            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Most active</strong><span>traded value</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Symbol</th><th>Value</th><th>Chg</th></tr></thead>
                <tbody>{mostActive.map(row => <tr key={row.symbol}><td>{row.symbol}</td><td>{valueText(row.traded_value)}</td><td className={(row.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{percent(row.change_pct)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </aside>

        <section className="nt-market-center">
          <section className="nt-panel nt-market-heatmap-panel">
            <div className="nt-panel-title"><strong>Equity heatmap</strong><span className="nt-panel-meta">price · session change · sector</span></div>
            <div className="nt-panel-body">
              <div className="nt-heatmap">
                {heatRows.length ? heatRows.map(stored => {
                  const symbol = stored.symbol;
                  const sector = normalizeSector(stored.sector);
                  const quote = quotes[symbol];
                  const useQuote = quote && (!stored.as_of || quote.at > Date.parse(stored.as_of));
                  const price = useQuote ? quote.price : stored.price;
                  const change = useQuote ? quote.change : stored.change_pct;
                  return (
                    <div className={`nt-heat-cell ${directionClass(change)}`} key={symbol}>
                      <div className="nt-heat-symbol-row"><b>{symbol}</b><span className={`nt-sector-dot ${sectorClass(sector)}`} aria-label={sector} /></div>
                      <span className="nt-heat-price nt-mono">{price == null ? "No quote" : priceFormat.format(price)}</span>
                      <span className={`nt-heat-change nt-mono ${change == null ? "nt-muted" : change > 0 ? "nt-positive" : change < 0 ? "nt-negative" : ""}`}>{percent(change)}</span>
                      <small title={useQuote ? new Date(quote.at).toISOString() : stored.as_of ?? undefined}><span className={`nt-sector-name ${sectorClass(sector)}`}>{sector}</span></small>
                    </div>
                  );
                }) : <div className="nt-empty nt-empty-compact">No equity observations in the current market snapshot.</div>}
              </div>
            </div>
          </section>

          <section className="nt-flat-surface nt-market-summary-surface nt-market-breadth-only">
            <div className="nt-summary-column">
              <div className="nt-subsection-title"><strong>Participation detail</strong><span>{breadthSession ?? "latest"}</span></div>
              <table className="nt-microtable"><tbody>
                <tr><td>Declining</td><td>{down || "—"}</td><td>{equities.length ? `${((down/equities.length)*100).toFixed(1)}%` : "—"}</td></tr>
                <tr><td>Unchanged</td><td>{unchanged || "—"}</td><td>{equities.length ? `${((unchanged/equities.length)*100).toFixed(1)}%` : "—"}</td></tr>
                <tr><td>Adv / Decl ratio</td><td>{down ? (up/down).toFixed(2) : "—"}</td><td></td></tr>
                <tr><td>Up value</td><td>{valueTotal(upValue)}</td><td></td></tr>
                <tr><td>Down value</td><td>{valueTotal(downValue)}</td><td></td></tr>
              </tbody></table>
            </div>
          </section>

          <DataTable
            title="Market tape"
            meta={`tracked universe · equity session ${equitySession ?? "—"}`}
            className="nt-primary-table nt-market-tape-table"
            columns={marketTape.some(row => row.market_cap != null)
              ? ["Symbol","Last","Change %","Traded value","Market cap","As of"]
              : ["Symbol","Last","Change %","Traded value","As of"]}
            rows={marketTape.map(row => ({ key: row.symbol, cells: marketTape.some(item => item.market_cap != null)
              ? [row.symbol, valueText(row.price), row.change_pct == null ? "—" : percent(row.change_pct), valueText(row.traded_value), valueText(row.market_cap), row.as_of?.slice(0,10)]
              : [row.symbol, valueText(row.price), row.change_pct == null ? "—" : percent(row.change_pct), valueText(row.traded_value), row.as_of?.slice(0,10)] }))}
            empty="No market observations."
          />

          <div className="nt-supporting-grid nt-market-supporting-grid">
            <DataTable
              title="Macro observations & spreads"
              meta="supporting context"
              className="nt-secondary-table"
              columns={["Series","Value","Unit","Observed"]}
              rows={[...(macro.data?.data ?? []), ...(macro.data?.spreads ?? [])].map(row => ({ key: row.series_code, cells: [row.series_code, valueText(row.value), row.unit, row.observed_at] }))}
              empty="No macro observations."
            />
            <DataTable
              title="Crypto derivatives"
              meta="supporting context"
              className="nt-secondary-table"
              columns={["Metric","Value","Unit","Venue","Observed"]}
              rows={(crypto.data?.data ?? []).map(row => ({ key: row.metric_code, cells: [row.metric_code, valueText(row.value), row.metadata?.unit, row.source, row.observed_at] }))}
              empty="No crypto derivatives observations."
            />
          </div>
        </section>

        <aside className="nt-market-rail nt-flat-rail">
          <section className="nt-flat-surface">
            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Calendar events</strong><span className={calendarState.valid ? "" : "nt-warning"}>{calendarState.valid ? "ET · declared coverage" : "SOURCE GAP"}</span></div>
              <table className="nt-microtable">
                <thead><tr><th>Event</th><th>Time</th><th>Impact</th></tr></thead>
                <tbody>{calendarEvents.length ? calendarEvents.slice(0,10).map(event => <tr key={event.id}><td>{event.title} · {event.currency}</td><td>{event.scheduled_at ? eventTime.format(new Date(event.scheduled_at)) : "—"}</td><td>{event.impact}</td></tr>) : <tr><td colSpan={3} className="nt-data-gap">{calendar.data ? calendarState.label : "Awaiting calendar feed"}</td></tr>}</tbody>
              </table>
            </div>

            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Leadership / laggards</strong><span>session</span></div>
              <table className="nt-microtable"><thead><tr><th>#</th><th>Leader</th><th>Laggard</th></tr></thead><tbody>
                {Array.from({ length: Math.min(22, equities.length) }, (_, i) => <tr key={i}><td>{i+1}</td><td className="nt-positive">{leaders[i]?.symbol ?? "—"} {percent(leaders[i]?.change_pct)}</td><td className="nt-negative">{laggards[i]?.symbol ?? "—"} {percent(laggards[i]?.change_pct)}</td></tr>)}
              </tbody></table>
            </div>

            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Sector performance</strong><span>equal weight</span></div>
              <table className="nt-microtable"><thead><tr><th>Sector</th><th>Chg</th><th>Adv%</th></tr></thead><tbody>
                {sectorPerformance.map(item => <tr key={item.sector}><td>{item.sector}</td><td className={(item.change ?? 0) > 0 ? "nt-positive" : (item.change ?? 0) < 0 ? "nt-negative" : ""}>{percent(item.change)}</td><td>{item.advance == null ? "—" : `${item.advance.toFixed(0)}%`}</td></tr>)}
              </tbody></table>
            </div>

            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Macro pulse</strong><span>latest observations</span></div>
              <table className="nt-microtable"><thead><tr><th>Series</th><th>Value</th><th>Unit</th></tr></thead><tbody>
                {(macro.data?.data ?? []).slice(0,7).map(row => <tr key={row.series_code}><td>{row.series_code}</td><td>{valueText(row.value)}</td><td>{row.unit ?? ""}</td></tr>)}
                {!macro.data?.data?.length && <tr><td colSpan={3}>No macro observations</td></tr>}
              </tbody></table>
            </div>

            <div className="nt-subsection">
              <div className="nt-subsection-title"><strong>Latest headlines</strong><span>{recentHeadlines.length}</span></div>
              <table className="nt-microtable"><thead><tr><th>Time</th><th>Symbol</th><th>Headline</th></tr></thead><tbody>
                {recentHeadlines.map(item => <tr key={item.id}><td>{item.published_at?.slice(11,16) ?? "—"}</td><td>{item.symbol ?? "—"}</td><td className="nt-cell-wrap">{item.title}</td></tr>)}
                {!recentHeadlines.length && <tr><td colSpan={3}>No recent headlines</td></tr>}
              </tbody></table>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
