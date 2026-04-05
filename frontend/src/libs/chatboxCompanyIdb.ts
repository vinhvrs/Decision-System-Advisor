"use client";

import { get, set } from "idb-keyval";
import { isDemoDevMode } from "@/src/libs/devMode";
import { getSymbolDevRows } from "@/src/libs/symbolDevIdb";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";

export type ChatboxCompanyRow = {
  symbol: string;
  company_name?: string;
  sector?: string;
  industry?: string;
};

const ROWS_KEY = "dsa-chatbox-companies-v1";
const SEEDED_AT_KEY = "dsa-chatbox-companies-seeded-v1";

/** Single in-flight forced fetch when cache is empty (parallel typeahead ticks). */
let forceSeedPromise: Promise<void> | null = null;

function rankRows(rows: ChatboxCompanyRow[], query: string, limit: number): ChatboxCompanyRow[] {
  const ql = query.trim().toLowerCase();
  if (!ql || rows.length === 0) return [];

  const scored: { row: ChatboxCompanyRow; score: number }[] = [];

  for (const row of rows) {
    const sym = (row.symbol || "").toLowerCase();
    const name = (row.company_name || "").toLowerCase();
    let score = 0;

    if (sym === ql) {
      score = 200;
    } else if (sym.startsWith(ql)) {
      score = 160 - Math.min(sym.length, 20);
    } else if (name.startsWith(ql)) {
      score = 130;
    } else if (name.includes(ql)) {
      score = 70;
    } else if (sym.includes(ql)) {
      score = 50;
    } else {
      const parts = name.split(/\s+/).filter(Boolean);
      for (const p of parts) {
        if (p.startsWith(ql)) {
          score = 55;
          break;
        }
      }
    }

    if (score > 0) {
      scored.push({ row, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: ChatboxCompanyRow[] = [];
  for (const { row } of scored) {
    const k = (row.symbol || "").toUpperCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(row);
    if (out.length >= limit) break;
  }

  return out;
}

function rowToHit(row: ChatboxCompanyRow): ElasticCompanyHit {
  return {
    id: null,
    score: null,
    source: {
      symbol: row.symbol,
      company_name: row.company_name,
      sector: row.sector,
      industry: row.industry,
    },
  };
}

/**
 * Refresh IndexedDB from `/elastic/demo/top-symbols` when empty or older than maxAgeMs.
 * @param force — skip TTL and refresh from API (still avoids wiping cache if API returns 0 rows).
 */
export async function seedChatboxCompaniesFromApi(maxAgeMs = 30 * 60 * 1000, force = false): Promise<void> {
  if (typeof window === "undefined") return;

  if (isDemoDevMode()) {
    try {
      const rows = await getSymbolDevRows();
      const mapped: ChatboxCompanyRow[] = rows.map((r) => ({
        symbol: r.symbol.trim().toUpperCase(),
        company_name: r.company_name,
      }));
      if (mapped.length > 0) {
        await set(ROWS_KEY, mapped);
        await set(SEEDED_AT_KEY, Date.now());
      }
    } catch {
      /* empty */
    }
    return;
  }

  if (!force) {
    try {
      const last = await get<number>(SEEDED_AT_KEY);
      const rows = await get<ChatboxCompanyRow[]>(ROWS_KEY);
      if (last && Date.now() - last < maxAgeMs && rows && rows.length > 0) {
        return;
      }
    } catch {
      /* empty */
    }
  }

  try {
    const prev = await get<ChatboxCompanyRow[]>(ROWS_KEY);
    const { items } = await ElasticService.getDemoTopSymbols(800);
    const rows: ChatboxCompanyRow[] = items
      .map((h) => ({
        symbol: (h.source?.symbol || "").trim().toUpperCase(),
        company_name: h.source?.company_name,
        sector: h.source?.sector,
        industry: h.source?.industry,
      }))
      .filter((r) => r.symbol.length > 0);

    if (rows.length === 0 && prev && prev.length > 0) {
      await set(SEEDED_AT_KEY, Date.now());
      return;
    }

    await set(ROWS_KEY, rows);
    await set(SEEDED_AT_KEY, Date.now());
  } catch {
    /* offline / API error — keep stale cache if any */
  }
}

/** Local-only suggestions (IndexedDB); no network per keystroke (may seed once if cache empty). */
export async function searchChatboxCompaniesIndexed(query: string, limit: number): Promise<ElasticCompanyHit[]> {
  if (typeof window === "undefined") return [];
  let rows: ChatboxCompanyRow[] = [];
  try {
    rows = (await get<ChatboxCompanyRow[]>(ROWS_KEY)) ?? [];
  } catch {
    return [];
  }
  if (rows.length === 0) {
    if (!forceSeedPromise) {
      forceSeedPromise = seedChatboxCompaniesFromApi(0, true).finally(() => {
        forceSeedPromise = null;
      });
    }
    await forceSeedPromise;
    try {
      rows = (await get<ChatboxCompanyRow[]>(ROWS_KEY)) ?? [];
    } catch {
      return [];
    }
  }
  return rankRows(rows, query, limit).map(rowToHit);
}
