import ScreenerWorkspace from "@/src/new-terminal/workspaces/ScreenerWorkspace";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import type { Universe } from "@/src/new-terminal/feeds";

async function readUniverse(): Promise<Universe[]> {
  try {
    const response = await fetch("https://data.aitemple.tech/api/v1/universe", {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    return [];
  }
}

export default async function ScreenerPage() {
  const [initialRows, initialUniverse] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readUniverse(),
  ]);
  return <ScreenerWorkspace initialRows={initialRows} initialUniverse={initialUniverse} />;
}
