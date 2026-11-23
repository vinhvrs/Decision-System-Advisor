import { NewsWorkspace } from "@/src/new-terminal/workspaces/FeedWorkspaces";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readForexFactoryCalendar } from "@/src/new-terminal/forexFactoryCalendar";

export default async function EventsPage() {
  const [initialRows, initialCalendar] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readForexFactoryCalendar(),
  ]);

  return (
    <NewsWorkspace
      initialRows={initialRows}
      initialCalendar={initialCalendar ?? undefined}
    />
  );
}
