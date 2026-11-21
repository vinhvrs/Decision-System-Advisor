"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DataTable from "../DataTable";
import { type Universe, type Metrics, valueText } from "../feeds";
import { type MarketRow } from "../marketSnapshot";
import { useFeed } from "../useFeed";

export default function ScreenerWorkspace() {
  const universe = useFeed<{ data: Universe[] }>("/api/v1/universe");
  const snapshot = useFeed<{ data: MarketRow[] }>("/api/v1/market-heatmap", 30000);
  const [query, setQuery] = useState("");
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
  return <div className="nt-workspace">
    <section className="nt-toolbar">
      <strong>Screener Database</strong>
      <label>Search <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Symbol or company" /></label>
      <label>Asset <select value={asset} onChange={event => setAsset(event.target.value)}><option value="">All</option>{[...new Set(all.map(row => row.asset_class))].sort().map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Sort <select value={sort} onChange={event => setSort(event.target.value)}><option value="symbol">Symbol</option><option value="change">Session change</option><option value="traded">Traded value</option></select></label>
      <span>{shown.length} / {all.length} instruments</span>
    </section>
    <DataTable title="Instrument universe and stored session" columns={["Symbol", "Instrument", "Asset", "Currency", "Last", "Change %", "Traded value", "Market cap", "As of"]}
      empty={universe.error ?? (universe.data ? "No instruments match the current filters." : "Loading Pi instrument universe…")}
      rows={shown.map(row => {
        const stored = bySymbol.get(row.symbol);
        return { key: row.symbol, cells: [<button key="pick" type="button" className="nt-tab" data-active={row.symbol === selected} onClick={() => setSelection(row.symbol)}>{row.symbol}</button>, row.name, row.asset_class, row.quote_currency, valueText(stored?.price), valueText(stored?.change_pct), valueText(stored?.traded_value), valueText(stored?.market_cap), stored?.as_of] };
      })}
      note={snapshot.error ?? "Traded value is reported separately from share volume. Missing price, market cap and timestamps remain blank."} />
    <DataTable title={selected ? `${selected} · valuation and technical coverage` : "Symbol inspector"} columns={["Metric", "Value", "Unit", "Quality", "Source / missing data"]}
      rows={[[fund.data, ["pe_ttm", "roe", "gross_margin", "fcf_yield", "debt_to_equity"]], [tech.data, ["rsi14", "atr_pct", "average_volume20", "relative_volume"]]].flatMap(([feed, keys]) =>
        (keys as string[]).map(key => {
          const metric = (feed as Metrics | undefined)?.metrics[key];
          return { key, cells: [key.replace(/_/g, " "), valueText(metric?.value), metric?.unit, metric?.quality, metric?.reason ?? metric?.metadata?.source ?? "No suitable observation"] };
        }))}
      note="Forward P/E requires point-in-time earnings consensus. Relative volume and technical measures require suitable price history and publication rights." />
    {selected && <div className="nt-toolbar"><Link href={`/companies/profile/${encodeURIComponent(selected)}`}>Company research ↗</Link><Link href={`/investing?symbol=${encodeURIComponent(selected)}`}>Chart Lab ↗</Link></div>}
  </div>;
}
