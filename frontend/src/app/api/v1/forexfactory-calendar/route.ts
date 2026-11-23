import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RawForexFactoryEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
};

function stableId(item: RawForexFactoryEvent) {
  return createHash("sha256")
    .update([item.date, item.country, item.title].join("|"))
    .digest("hex");
}

export async function GET() {
  const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { source: "forexfactory", provider_error: true, events: [], status: response.status },
        { status: 502 },
      );
    }

    const raw = (await response.json()) as RawForexFactoryEvent[];
    const events = (Array.isArray(raw) ? raw : [])
      .filter(item => item?.title && item?.country && item?.date)
      .map(item => ({
        id: stableId(item),
        title: item.title!.trim(),
        currency: item.country!.trim(),
        impact: (item.impact || "Low").trim(),
        scheduled_at: item.date!,
        all_day: item.impact === "Holiday",
        forecast: item.forecast?.trim() || null,
        previous: item.previous?.trim() || null,
        actual: null,
        tags: [],
      }))
      .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));

    const dates = events.map(item => item.scheduled_at.slice(0, 10));
    return NextResponse.json(
      {
        source: "forexfactory",
        source_url: "https://www.forexfactory.com/calendar",
        upstream_url: url,
        last_success_at: new Date().toISOString(),
        stale: false,
        provider_error: false,
        coverage: {
          start: dates[0] ?? null,
          end: dates.at(-1) ?? null,
        },
        actual_available: false,
        events,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        source: "forexfactory",
        source_url: "https://www.forexfactory.com/calendar",
        provider_error: true,
        stale: true,
        events: [],
        error: error instanceof Error ? error.message : "ForexFactory feed unavailable",
      },
      { status: 502 },
    );
  }
}
