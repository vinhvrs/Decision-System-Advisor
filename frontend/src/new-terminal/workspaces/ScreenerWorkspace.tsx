"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DataTable from "../DataTable";
import { type Universe, type Metrics, type DailyAnalytics, valueText } from "../feeds";
import { SymbolContext } from "../ContextBadges";
import { type MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";

export default function ScreenerWorkspace({ initialQuery = "" }: { initialQuery?: string }) {
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const snapshot = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const daily = useFeed<DailyAnalytics>("/api/market/daily-analytics", 300000);
  const [query, setQuery] = useState(initialQuery);
  const [asset, setAsset] = useState("");
  const [sort, setSort] = useState("symbol");
  const [selection, setSelection] = useState("");
  const bySymbol = useMemo(() => new Map(snapshot.data?.data.map(row => [row.symbol, row])), [snapshot.data]);
  const all = universe.data?.data ?? [];
  const shown = all.filter(row => (!asset || row.asset_class === asset) &&
    `${row.symbol} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  shown.sort((a, b) => {
    if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
    const key = sort === "change" ? "change_pct" : "traded_value";
    return (bySymbol.get(b.symbol)?.[key] ?? -Infinity) - (bySymbol.get(a.symbol)?.[key] ?? -Infinity);
  });
  const selected = shown.some(row => row.symbol === selection) ? selection : shown[0]?.symbol;
  const fund = useFeed<Metrics>(selected ? `/api/v1/sourced-fundamentals/${encodeURIComponent(selected)}` : null);
  const tech = useFeed<Metrics>(selected ? `/api/v1/metrics/${encodeURIComponent(selected)}` : null);
  const dailyMetrics = selected ? daily.data?.data[selected]?.metrics : undefined;
  const technicalMetrics = { ...tech.data?.metrics, ...dailyMetrics };
  const selectedRow = bySymbol.get(selected ?? "");
  const fundRows = Object.entries(fund.data?.metrics ?? {});
  const technicalRows = Object.entries(technicalMetrics).filter(([key]) => !(key in (fund.data?.metrics ?? {})));
  const changeRank = selected ? [...shown].sort((a,b) => (bySymbol.get(b.symbol)?.change_pct ?? -Infinity) - (bySymbol.get(a.symbol)?.change_pct ?? -Infinity)).findIndex(row => row.symbol === selected) + 1 : 0;
  const tradedRank = selected ? [...shown].sort((a,b) => (bySymbol.get(b.symbol)?.traded_value ?? -Infinity) - (bySymbol.get(a.symbol)?.traded_value ?? -Infinity)).findIndex(row => row.symbol === selected) + 1 : 0;
  const sessionMovers = [...shown]
    .filter(row => bySymbol.get(row.symbol)?.change_pct != null)
    .sort((a,b) => Math.abs(bySymbol.get(b.symbol)?.change_pct ?? 0) - Math.abs(bySymbol.get(a.symbol)?.change_pct ?? 0))
    .slice(0,20);

  return <div className="nt-workspace nt-full-workspace nt-screener-workspace">
    <section className="nt-toolbar">
      <strong>Screener</strong>
      <label>Search <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Symbol or company" /></label>
      <label>Asset <select value={asset} onChange={event => setAsset(event.target.value)}><option value="">All</option>{[...new Set(all.map(row => row.asset_class))].sort().map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Sort <select value={sort} onChange={event => setSort(event.target.value)}><option value="symbol">Symbol</option><option value="change">Session change</option><option value="traded">Traded value</option></select></label>
      <span className="nt-toolbar-count">{shown.length} / {all.length}</span>
    </section>

    <div className="nt-screener-layout">
      <section className="nt-screener-results">
        <DataTable title="Instrument universe" columns={["Symbol", "Context", "Instrument", "Asset", "Currency", "Last", "Change %", "Traded value", "Market cap"]}
          empty={universe.data ? "No instruments match the current filters." : "Loading instrument universe…"}
          rows={shown.map(row => {
            const stored = bySymbol.get(row.symbol);
            return { key: row.symbol, cells: [
              <button key="pick" type="button" className="nt-tab" data-active={row.symbol === selected} onClick={() => setSelection(row.symbol)}>{row.symbol}</button>,
              <SymbolContext key="context" symbol={row.symbol} />,
              row.name, row.asset_class, row.quote_currency, valueText(stored?.price), valueText(stored?.change_pct),
              valueText(stored?.traded_value), valueText(stored?.market_cap)
            ] };
          })}
          note="Traded value is shown separately from share volume." />
      </section>

      <aside className="nt-screener-inspector">
        <section className="nt-flat-surface">
          <div className="nt-subsection">
            <div className="nt-subsection-title">
              <strong>{selected ? `${selected} · snapshot` : "Snapshot"}</strong>
              <span>{bySymbol.get(selected ?? "")?.as_of?.slice(0,10) ?? ""}</span>
            </div>
            <div className="nt-screener-selected">
              <SymbolContext symbol={selected} />
              <div><div className="nt-label">Last</div><strong className="nt-mono">{valueText(selectedRow?.price)}</strong></div>
              <div><div className="nt-label">Change</div><strong className={(selectedRow?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{valueText(selectedRow?.change_pct)}%</strong></div>
            </div>
            <table className="nt-microtable"><tbody>
              <tr><td>Market cap</td><td>{valueText(selectedRow?.market_cap)}</td></tr>
              <tr><td>Traded value</td><td>{valueText(selectedRow?.traded_value)}</td></tr>
              <tr><td>Change rank</td><td>{changeRank > 0 ? `#${changeRank} / ${shown.length}` : "—"}</td></tr>
              <tr><td>Traded-value rank</td><td>{tradedRank > 0 ? `#${tradedRank} / ${shown.length}` : "—"}</td></tr>
            </tbody></table>
          </div>

          <div className="nt-subsection">
            <div className="nt-subsection-title"><strong>Fundamentals & valuation</strong><span>{selected ?? ""}</span></div>
            <table className="nt-microtable"><thead><tr><th>Metric</th><th>Value</th><th>Unit</th></tr></thead><tbody>
              {fundRows.map(([key, metric]) => <tr key={key}><td>{key.replace(/_/g, " ")}</td><td>{valueText(metric?.value)}</td><td>{metric?.unit ?? ""}</td></tr>)}
              {!fundRows.length && <tr><td colSpan={3}>No fundamental values</td></tr>}
            </tbody></table>
          </div>

          <div className="nt-subsection">
            <div className="nt-subsection-title"><strong>Technicals</strong><span>daily</span></div>
            <table className="nt-microtable"><thead><tr><th>Metric</th><th>Value</th><th>Unit</th></tr></thead><tbody>
              {technicalRows.map(([key, metric]) => <tr key={key}><td>{key.replace(/_/g, " ")}</td><td>{valueText(metric?.value)}</td><td>{metric?.unit ?? ""}</td></tr>)}
              {!technicalRows.length && <tr><td colSpan={3}>No technical values</td></tr>}
            </tbody></table>
          </div>

          <div className="nt-subsection">
            <div className="nt-subsection-title"><strong>Session movers</strong><span>current screen</span></div>
            <table className="nt-microtable">
              <thead><tr><th>Symbol</th><th>Chg</th><th>Last</th></tr></thead>
              <tbody>{sessionMovers.map(row => {
                const market = bySymbol.get(row.symbol);
                return <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td className={(market?.change_pct ?? 0) >= 0 ? "nt-positive" : "nt-negative"}>{market?.change_pct == null ? "—" : `${market.change_pct > 0 ? "+" : ""}${valueText(market.change_pct)}%`}</td>
                  <td>{valueText(market?.price)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>

          {selected && <div className="nt-inline-links nt-screener-links">
            <Link href={`/companies/profile/${encodeURIComponent(selected)}`}>Company research ↗</Link>
            <Link href={`/investing?symbol=${encodeURIComponent(selected)}`}>Chart Lab ↗</Link>
          </div>}
        </section>
      </aside>
    </div>
  </div>;
}
