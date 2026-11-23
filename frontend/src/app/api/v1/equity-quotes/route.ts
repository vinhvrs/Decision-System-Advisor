import { NextResponse } from "next/server";

import { EQUITY_HEATMAP_UNIVERSE } from "@/src/new-terminal/equityUniverse";

export const dynamic = "force-dynamic";

type YahooChartMeta = {
  symbol?: string;
  instrumentType?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  fulldayPrice?: number;
  fulldayChangePercent?: number;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{ meta?: YahooChartMeta }> | null;
    error?: unknown;
  };
};

async function readQuote(symbol: string) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=true`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 45 },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as YahooChartPayload;
    const meta = payload.chart?.result?.[0]?.meta;
    if (!meta || meta.instrumentType !== "EQUITY") return null;

    const fullDayPrice =
      typeof meta.fulldayPrice === "number" && Number.isFinite(meta.fulldayPrice) && meta.fulldayPrice > 0
        ? meta.fulldayPrice
        : null;
    const regularPrice =
      typeof meta.regularMarketPrice === "number" &&
      Number.isFinite(meta.regularMarketPrice) &&
      meta.regularMarketPrice > 0
        ? meta.regularMarketPrice
        : null;

    const price = fullDayPrice ?? regularPrice;
    if (price == null) return null;

    const fullDayChange =
      typeof meta.fulldayChangePercent === "number" && Number.isFinite(meta.fulldayChangePercent)
        ? meta.fulldayChangePercent
        : null;
    const regularChange =
      typeof meta.regularMarketChangePercent === "number" &&
      Number.isFinite(meta.regularMarketChangePercent)
        ? meta.regularMarketChangePercent
        : null;

    const change = fullDayPrice != null ? fullDayChange ?? regularChange : regularChange;
    if (change == null) return null;

    return {
      symbol,
      price,
      change,
      observed_at:
        typeof meta.regularMarketTime === "number" && Number.isFinite(meta.regularMarketTime)
          ? meta.regularMarketTime * 1000
          : null,
      retrieved_at: Date.now(),
      source: "YAHOO_CHART",
      session: fullDayPrice != null ? "full_day" : "regular",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const quotes = (
    await Promise.all(EQUITY_HEATMAP_UNIVERSE.map(({ symbol }) => readQuote(symbol)))
  ).filter((quote): quote is NonNullable<typeof quote> => quote !== null);

  return NextResponse.json(
    {
      data: quotes,
      requested: EQUITY_HEATMAP_UNIVERSE.length,
      observed: quotes.length,
      source: "Yahoo Finance chart snapshot",
      fallback_only: true,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=90",
      },
    },
  );
}
