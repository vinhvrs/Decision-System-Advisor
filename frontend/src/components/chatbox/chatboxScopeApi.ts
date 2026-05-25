/**
 * REST fallbacks when the Python WebSocket chatbot returns an error for a scoped focus
 * (e.g. “valid ticker” required) — News, company search, rankings, etc.
 */

import { AdviceService } from "@/src/services/Advice.service";
import { CompanyService } from "@/src/services/Company.service";
import { ElasticService } from "@/src/services/Elastic.service";
import newsService from "@/src/services/News.service";
import { stripParentheticals } from "@/src/libs/displayString";

/** Public site base for clickable links in chat (optional; else `window.location.origin` in browser). */
function publicSiteOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function absoluteSitePath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const o = publicSiteOrigin();
  return o ? `${o}${p}` : p;
}

export const SCOPE_API_FALLBACK_IDS = new Set([
  "news",
  "companies",
  "analysis",
  "analyze",
]);

/** These focuses are served only from site APIs (no Python WS) — avoids NLP misparsing focus text as tickers. */
export const SCOPE_CLIENT_ONLY_IDS = new Set(["news", "companies", "analysis"]);

export function shouldUseScopeApiFallback(scope: string | null): scope is string {
  return scope != null && SCOPE_API_FALLBACK_IDS.has(scope);
}

async function fallbackNews(query: string): Promise<{ from: "bot"; text: string }[]> {
  const q = query.trim().toLowerCase();
  const { data } = await newsService.getAllNews({ per_page: 24, page: 1 });
  let rows = Array.isArray(data) ? data : [];
  if (q) {
    rows = rows.filter((r: { title?: string; content?: string }) => {
      const t = (r.title || "").toLowerCase();
      const c = (r.content || "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }
  const slice = rows.slice(0, 14);
  if (!slice.length) {
    const newsPage = absoluteSitePath("/news");
    return [
      {
        from: "bot",
        text: q
          ? `No headlines matched “${query.trim()}”. Try another keyword or open ${newsPage}.`
          : "No headlines returned from the news API.",
      },
    ];
  }
  const lines = slice.map((r: { title?: string; id?: string }, i: number) => {
    const title = r.title || "Untitled";
    const path = r.id
      ? absoluteSitePath(`/news/${encodeURIComponent(String(r.id))}`)
      : "";
    return `${i + 1}. ${title}${path ? `\n   ${path}` : ""}`;
  });
  return [
    {
      from: "bot",
      text: ["Latest news (site API)", "", ...lines].join("\n"),
    },
  ];
}

async function fallbackCompanies(query: string): Promise<{ from: "bot"; text: string }[]> {
  const q = query.trim();
  const { items } = q
    ? await ElasticService.searchCompanies(q, 14)
    : await ElasticService.getDemoTopSymbols(14);
  if (!items.length) {
    return [{ from: "bot", text: "No companies matched. Try a name or ticker." }];
  }
  const lines = items.map((h, i) => {
    const sym = h.source?.symbol || "—";
    const name = stripParentheticals(h.source?.company_name || "");
    const sec = h.source?.sector ? ` · ${h.source.sector}` : "";
    return `${i + 1}. ${sym} — ${name || "—"}${sec}`;
  });
  return [{ from: "bot", text: ["Company search (Elastic API)", "", ...lines].join("\n") }];
}

async function fallbackIndicator(_query: string): Promise<{ from: "bot"; text: string }[]> {
  const advices = await AdviceService.getAdvices(12, 1);
  if (!advices?.length) {
    return [{ from: "bot", text: "No watchlist / stock rows from /stocks API." }];
  }
  const lines = advices.slice(0, 12).map((s, i) => {
    const rec = s.recommendation ?? "—";
    const conf = s.confidence_score ?? "—";
    const idShort = s.instrument_id ? String(s.instrument_id).slice(0, 8) : "—";
    return `${i + 1}. instrument ${idShort}… — ${rec} (confidence ${conf})`;
  });
  return [
    {
      from: "bot",
      text: ["Indicator-style snapshot (stocks API)", "", ...lines].join("\n"),
    },
  ];
}

async function fallbackStrategy(_query: string): Promise<{ from: "bot"; text: string }[]> {
  const { gainers, losers, updated_note } = await CompanyService.topVolumeMovers(5);
  const lines: string[] = ["Volume movers (rankings API)"];
  if (updated_note) lines.push(`Note: ${updated_note}`, "");
  lines.push("Gainers:");
  gainers.forEach((x: { symbol?: string; change_pct?: number; volume?: number }, i: number) => {
    lines.push(
      `  ${i + 1}. ${x.symbol ?? "—"}  ${x.change_pct != null ? `${x.change_pct}%` : ""}  vol ${x.volume ?? "—"}`
    );
  });
  lines.push("", "Losers:");
  losers.forEach((x: { symbol?: string; change_pct?: number; volume?: number }, i: number) => {
    lines.push(
      `  ${i + 1}. ${x.symbol ?? "—"}  ${x.change_pct != null ? `${x.change_pct}%` : ""}  vol ${x.volume ?? "—"}`
    );
  });
  return [{ from: "bot", text: lines.join("\n") }];
}

async function fallbackAnalyze(query: string): Promise<{ from: "bot"; text: string }[]> {
  const sym = query.trim().toUpperCase();
  if (/^[A-Z]{1,6}$/.test(sym)) {
    try {
      const row = await CompanyService.getCompanyInfo(sym);
      const p = (row as { data?: unknown })?.data ?? row;
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        const name = (o.name as string) || (o.company_name as string) || sym;
        const sector = (o.sector as string) || "";
        const industry = (o.industry as string) || "";
        const exchange = (o.exchange as string) || "";
        const bits = [
          `${sym} — ${name}`,
          [sector, industry].filter(Boolean).join(" · "),
          exchange ? `Exchange: ${exchange}` : "",
        ].filter(Boolean);
        return [{ from: "bot", text: ["Company profile (API)", "", ...bits].join("\n") }];
      }
    } catch {
      /* use indicator-style fallback */
    }
  }
  return fallbackIndicator(query);
}

export async function runScopeApiFallback(
  scope: string,
  query: string
): Promise<{ from: "bot"; text: string }[]> {
  switch (scope) {
    case "news":
      return fallbackNews(query);
    case "companies":
      return fallbackCompanies(query);
    case "analysis":
      return fallbackStrategy(query);
    case "indicator":
    case "strategy":
      return fallbackIndicator(query);
    case "analyze":
      return fallbackAnalyze(query);
    default:
      return [{ from: "bot", text: "No API fallback for this focus." }];
  }
}
