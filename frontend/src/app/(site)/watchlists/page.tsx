import { WatchlistsWorkspace } from "@/src/new-terminal/workspaces/FeedWorkspaces";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import type { Universe } from "@/src/new-terminal/feeds";

export default async function WatchlistsPage() {
  const [initialRows, universePayload] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<{ data: Universe[] }>("/api/v1/universe", 60),
  ]);
  return <WatchlistsWorkspace initialRows={initialRows} initialUniverse={universePayload?.data ?? []} />;
}
