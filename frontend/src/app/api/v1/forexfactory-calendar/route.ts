import { NextResponse } from "next/server";
import { readForexFactoryCalendar } from "@/src/new-terminal/forexFactoryCalendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const calendar = await readForexFactoryCalendar();
  if (!calendar) {
    return NextResponse.json(
      {
        source: "forexfactory",
        source_url: "https://www.forexfactory.com/calendar",
        provider_error: true,
        stale: true,
        events: [],
      },
      { status: 502 },
    );
  }

  return NextResponse.json(calendar, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
