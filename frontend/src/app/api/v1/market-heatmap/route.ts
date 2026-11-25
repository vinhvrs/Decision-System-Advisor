import { readMarketSnapshotFeed } from "@/src/new-terminal/marketSnapshot";

export async function GET() {
  try {
    return Response.json(await readMarketSnapshotFeed());
  } catch {
    return Response.json({ error: "Market snapshot unavailable" }, { status: 502 });
  }
}
