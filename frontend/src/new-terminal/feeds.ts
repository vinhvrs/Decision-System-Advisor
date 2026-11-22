export type Datum = {
  value: number | null;
  quality: string;
  unit?: string;
  as_of?: string | null;
  reason?: string | null;
  metadata?: { source?: string; basis?: string; lineage?: { filed_at?: string; period_end?: string }[] };
};
export type Metrics = { quality: string; as_of?: string; metrics: Record<string, Datum> };
export type DailyAnalytics = { data: Record<string, { as_of: string | null; metrics: Record<string, Datum> }> };
export type Universe = { symbol: string; name: string; asset_class: string; volume_type: string; quote_currency: string };
export type MacroRow = { series_code: string; value: number | null; quality: string; unit: string; source?: string; observed_at?: string; reason?: string };
export type Macro = { data: MacroRow[]; spreads: MacroRow[]; generated_at: string; quality: string };
export type Health = { quality: string; generated_at: string; pipeline: { covered: number; total: number }; sources: { source_code: string; status: string; last_data_at: string | null; last_error: string | null }[] };
export type Calendar = { source: string; events: { id: string; title: string; scheduled_at: string | null; currency: string; impact: string; forecast: string | null; previous: string | null; actual: string | null }[]; stale: boolean; provider_error: boolean };
export type News = { id: string; title: string; symbol?: string; published_at?: string; source?: string; author?: string };
export type Filing = { accession_number: string; form: string; filing_date: string; report_date: string; filing_url: string };
export type Crypto = { symbol: string; data: { metric_code: string; value: number | null; source: string; quality: string; observed_at: string; metadata?: { unit?: string } }[] };
export type Positioning = { quality: string; reason?: string; data: { metric_code?: string; series_code?: string; value?: number; source?: string; quality?: string; observed_at?: string }[] };
export type Correlation = { symbols: string[]; window: number; data: Datum[][]; reason?: string };
export type Technical = { last_bar_at: string; indicators: Record<string, { status: string; value: number | Record<string, number> | null }> };

export const valueText = (value: number | string | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 6 })
    : typeof value === "string" && value ? value : "—";

export const labelText = (key: string) => key.replace(/_/g, " ");
export function sourceLink(value?: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}

export async function getFeed<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Feed returned ${response.status}`);
  return response.json() as Promise<T>;
}
