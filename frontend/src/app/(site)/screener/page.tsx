import ScreenerWorkspace from "@/src/new-terminal/workspaces/ScreenerWorkspace";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import type { Universe } from "@/src/new-terminal/feeds";
import { readData } from "@/src/new-terminal/serverData";

export default async function ScreenerPage() {
  const [initialRows, initialUniverse] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<{ data: Universe[] }>("/api/v1/universe", 60).then(payload => payload?.data ?? []),
  ]);
  return <ScreenerWorkspace initialRows={initialRows} initialUniverse={initialUniverse} />;
}

export const dynamic = "force-dynamic";
