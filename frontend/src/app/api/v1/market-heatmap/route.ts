import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";

export async function GET() {
  try {
    return Response.json({ data: await readMarketSnapshot() });
  } catch {
    return Response.json({ error: "Market snapshot unavailable" }, { status: 502 });
  }
}
