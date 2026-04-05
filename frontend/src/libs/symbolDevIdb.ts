import { createStore, get, set } from "idb-keyval";
import { isDemoDevMode } from "@/src/libs/devMode";

/** Matches production company list items (symbol / company_name / id / name). */
export type SymbolDevCompany = {
  company_name: string;
  id: string;
  name: string;
  symbol: string;
};

const DB_NAME = "dsa-app";
/** IndexedDB object store for the fixed demo symbol list. */
export const SYMBOL_DEV_STORE_NAME = "symbol_dev";
const ROWS_KEY = "symbol_dev_rows";

const symbolDevStore = createStore(DB_NAME, SYMBOL_DEV_STORE_NAME);

/**
 * Ten demo tickers (TESLA→TSLA, APPLE→AAPL, Oracle→ORCL for real API routes).
 * Order matches the product request list.
 */
export const DEV_SYMBOL_SEED: SymbolDevCompany[] = [
  {
    company_name: "NVIDIA Corporation",
    id: "NVDA",
    name: "NVIDIA Corporation",
    symbol: "NVDA",
  },
  {
    company_name: "Tesla Inc.",
    id: "TSLA",
    name: "Tesla Inc.",
    symbol: "TSLA",
  },
  {
    company_name: "Apple Inc.",
    id: "AAPL",
    name: "Apple Inc.",
    symbol: "AAPL",
  },
  {
    company_name: "Alphabet Inc.",
    id: "GOOGL",
    name: "Alphabet Inc.",
    symbol: "GOOGL",
  },
  {
    company_name: "International Business Machines Corporation",
    id: "IBM",
    name: "International Business Machines Corporation",
    symbol: "IBM",
  },
  {
    company_name: "Microsoft Corporation",
    id: "MSFT",
    name: "Microsoft Corporation",
    symbol: "MSFT",
  },
  {
    company_name: "Amazon.com Inc.",
    id: "AMZN",
    name: "Amazon.com Inc.",
    symbol: "AMZN",
  },
  {
    company_name: "Meta Platforms Inc.",
    id: "META",
    name: "Meta Platforms Inc.",
    symbol: "META",
  },
  {
    company_name: "Oracle Corporation",
    id: "ORCL",
    name: "Oracle Corporation",
    symbol: "ORCL",
  },
  {
    company_name: "Broadcom Inc.",
    id: "AVGO",
    name: "Broadcom Inc.",
    symbol: "AVGO",
  },
];

export async function ensureSymbolDevSeeded(): Promise<void> {
  if (!isDemoDevMode() || typeof window === "undefined") return;

  try {
    const existing = await get<SymbolDevCompany[]>(ROWS_KEY, symbolDevStore);
    if (Array.isArray(existing) && existing.length > 0) return;
    await set(ROWS_KEY, DEV_SYMBOL_SEED, symbolDevStore);
  } catch {
    /* ignore */
  }
}

/** Demo rows: from IndexedDB in the browser when dev mode is on; in-memory seed elsewhere. */
export async function getSymbolDevRows(): Promise<SymbolDevCompany[]> {
  if (!isDemoDevMode()) return [];

  if (typeof window === "undefined") {
    return DEV_SYMBOL_SEED;
  }

  await ensureSymbolDevSeeded();
  try {
    const rows = await get<SymbolDevCompany[]>(ROWS_KEY, symbolDevStore);
    if (Array.isArray(rows) && rows.length > 0) return rows;
  } catch {
    /* fall through */
  }
  return DEV_SYMBOL_SEED;
}
