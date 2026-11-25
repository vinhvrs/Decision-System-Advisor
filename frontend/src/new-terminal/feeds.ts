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
export type MacroRow = {
  series_code: string;
  value: number | null;
  quality: string;
  unit: string;
  source?: string;
  observed_at?: string;
  previous_value?: number | null;
  previous_observed_at?: string | null;
  change_pct?: number | null;
  reason?: string;
  metadata?: { source?: string; inputs?: string[] };
};
export type Macro = { data: MacroRow[]; spreads: MacroRow[]; generated_at: string; quality: string };
export type Health = { quality: string; generated_at: string; pipeline: { covered: number; total: number }; sources: { source_code: string; status: string; last_data_at: string | null; last_error: string | null }[] };
export const ECONOMIC_CALENDAR_PATH = "/api/v1/economic-calendar?limit=1000";
const calendarDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/New_York" });

export type Calendar = {
  source: string;
  source_url?: string;
  last_success_at?: string | null;
  coverage?: { start?: string | null; end?: string | null };
  events: { id: string; title: string; scheduled_at: string | null; currency: string; impact: string; forecast: string | null; previous: string | null; actual: string | null }[];
  stale: boolean;
  provider_error: boolean;
};
export type News = {
  id: string;
  title: string;
  symbol?: string;
  published_at?: string;
  source?: string;
  author?: string;
  image?: string | null;
  content?: string | null;
  category?: string | null;
  language?: string | null;
  content_status?: string | null;
  word_count?: number | null;
  publisher?: string | null;
  tags?: { slug: string; label: string }[];
};
export type Filing = { accession_number: string; form: string; filing_date: string; report_date: string; filing_url: string };
export type Crypto = { symbol: string; data: { metric_code: string; value: number | null; source: string; quality: string; observed_at: string; metadata?: { unit?: string } }[] };
export type Positioning = { quality: string; reason?: string; data: { metric_code?: string; series_code?: string; value?: number; source?: string; quality?: string; observed_at?: string }[] };
export type Correlation = { symbols: string[]; window: number; data: Datum[][]; reason?: string };
export type Technical = { last_bar_at: string; indicators: Record<string, { status: string; value: number | Record<string, number> | null }> };

export const valueText = (value: number | string | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 6 })
    : typeof value === "string" && value ? value : "—";

export function quoteText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.abs(value) >= 10 ? 2 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

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


export function calendarEventsInDeclaredCoverage(calendar?: Calendar) {
  if (!calendar) return [];
  const start = calendar.coverage?.start ?? null;
  const end = calendar.coverage?.end ?? null;
  if (!start && !end) return calendar.events ?? [];
  return (calendar.events ?? []).filter(event => {
    if (!event.scheduled_at) return false;
    const instant = new Date(event.scheduled_at);
    if (!Number.isFinite(instant.getTime())) return false;
    const date = calendarDay.format(instant);
    return (!start || date >= start) && (!end || date <= end);
  });
}

export function calendarCoverageState(calendar?: Calendar) {
  if (!calendar) return { valid: false, label: "Awaiting calendar feed" };
  const validEvents = calendarEventsInDeclaredCoverage(calendar);
  const declared = calendar.coverage?.start || calendar.coverage?.end;
  if (calendar.provider_error) return { valid: false, label: "Calendar provider error" };
  if (calendar.stale) return { valid: false, label: "Calendar feed stale" };
  if (declared && calendar.events.length > 0 && validEvents.length === 0) {
    const range = [calendar.coverage?.start, calendar.coverage?.end].filter(Boolean).join(" → ");
    return { valid: false, label: range ? `Coverage mismatch · ${range}` : "Calendar coverage mismatch" };
  }
  return { valid: true, label: calendar.last_success_at ? `Updated ${calendar.last_success_at.slice(0, 16).replace("T", " ")}Z` : calendar.source };
}
