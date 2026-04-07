"use client";

import { ReactNode, useEffect, useState } from "react";
import Card from "@/src/sections/Card";
import { SimpleSocket } from "@/src/libs/socket";

type Idx = { change_pct?: number | null };
type Macro = { value_pct?: number | null };

export type MarketOverviewData = {
  indices: {
    sp500: Idx;
    nasdaq100: Idx;
    japan225: Idx;
    dax: Idx;
  };
  commodities: {
    crude: Idx;
    gold: Idx;
    natgas: Idx;
  };
  macro: {
    us10y: Macro;
    inflation: Macro;
    interest: Macro;
  };
};

const DEFAULT_DATA: MarketOverviewData = {
  indices: {
    sp500: {},
    nasdaq100: {},
    japan225: {},
    dax: {},
  },
  commodities: {
    crude: {},
    gold: {},
    natgas: {},
  },
  macro: {
    us10y: {},
    inflation: {},
    interest: {},
  },
};

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtValuePct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function pctColor(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "text-white/50";
  if (n > 0) return "text-green-400";
  if (n < 0) return "text-red-400";
  return "text-white/60";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeOverview(base: MarketOverviewData, patch: unknown): MarketOverviewData {
  if (!isPlainObject(patch)) return base;
  const p = patch as Partial<MarketOverviewData>;
  const pi = p.indices;
  const pc = p.commodities;
  const pm = p.macro;
  return {
    indices: {
      ...base.indices,
      sp500: { ...base.indices.sp500, ...(pi && isPlainObject(pi.sp500) ? pi.sp500 : {}) },
      nasdaq100: { ...base.indices.nasdaq100, ...(pi && isPlainObject(pi.nasdaq100) ? pi.nasdaq100 : {}) },
      japan225: { ...base.indices.japan225, ...(pi && isPlainObject(pi.japan225) ? pi.japan225 : {}) },
      dax: { ...base.indices.dax, ...(pi && isPlainObject(pi.dax) ? pi.dax : {}) },
    },
    commodities: {
      ...base.commodities,
      crude: { ...base.commodities.crude, ...(pc && isPlainObject(pc.crude) ? pc.crude : {}) },
      gold: { ...base.commodities.gold, ...(pc && isPlainObject(pc.gold) ? pc.gold : {}) },
      natgas: { ...base.commodities.natgas, ...(pc && isPlainObject(pc.natgas) ? pc.natgas : {}) },
    },
    macro: {
      ...base.macro,
      us10y: { ...base.macro.us10y, ...(pm && isPlainObject(pm.us10y) ? pm.us10y : {}) },
      inflation: { ...base.macro.inflation, ...(pm && isPlainObject(pm.inflation) ? pm.inflation : {}) },
      interest: { ...base.macro.interest, ...(pm && isPlainObject(pm.interest) ? pm.interest : {}) },
    },
  };
}

type Props = {
  watchlist: ReactNode;
};

export default function HomeLiveMarketSection({ watchlist }: Props) {
  const [data, setData] = useState<MarketOverviewData>(DEFAULT_DATA);

  useEffect(() => {
    let cancelled = false;
    const socket = new SimpleSocket((raw: unknown) => {
      if (cancelled) return;
      const msg = raw as { type?: string; data?: unknown };
      if (msg?.type !== "market_overview") return;
      if (!isPlainObject(msg.data)) return;
      setData((prev) => mergeOverview(prev, msg.data));
    });

    socket.connect();
    const timer = setTimeout(() => {
      socket.send({ type: "subscribe", symbols: [], period: "daily" });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      socket.disconnect();
    };
  }, []);

  const { indices, commodities, macro } = data;

  return (
    <div className="space-y-6 tablet:space-y-8">
      <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-4 gap-4 tablet:gap-6">
        <Card title="Major indices">
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3">
              <span>S&amp;P 500</span>
              <span className={pctColor(indices.sp500.change_pct)}>{fmtPct(indices.sp500.change_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Nasdaq 100</span>
              <span className={pctColor(indices.nasdaq100.change_pct)}>{fmtPct(indices.nasdaq100.change_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Japan 225</span>
              <span className={pctColor(indices.japan225.change_pct)}>{fmtPct(indices.japan225.change_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>DAX</span>
              <span className={pctColor(indices.dax.change_pct)}>{fmtPct(indices.dax.change_pct)}</span>
            </li>
          </ul>
        </Card>
        {watchlist}
      </div>

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4 tablet:gap-6">
        <Card title="Commodities">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span>Crude Oil</span>
              <span className={pctColor(commodities.crude.change_pct)}>{fmtPct(commodities.crude.change_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Gold</span>
              <span className={pctColor(commodities.gold.change_pct)}>{fmtPct(commodities.gold.change_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Natural Gas</span>
              <span className={pctColor(commodities.natgas.change_pct)}>{fmtPct(commodities.natgas.change_pct)}</span>
            </li>
          </ul>
        </Card>

        <Card title="Macro economy">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span>US 10Y Yield</span>
              <span className="text-white/90 tabular-nums">{fmtValuePct(macro.us10y.value_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Inflation</span>
              <span className="text-white/90 tabular-nums">{fmtValuePct(macro.inflation.value_pct)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Interest rate</span>
              <span className="text-white/90 tabular-nums">{fmtValuePct(macro.interest.value_pct)}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
