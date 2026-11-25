import { NewsWorkspace } from "@/src/new-terminal/workspaces/FeedWorkspaces";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { ECONOMIC_CALENDAR_PATH, type Calendar } from "@/src/new-terminal/feeds";
import { readData } from "@/src/new-terminal/serverData";

export default async function EventsPage() {
  const [initialRows, initialCalendar] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<Calendar>(ECONOMIC_CALENDAR_PATH),
  ]);

  return (
    <NewsWorkspace
      initialRows={initialRows}
      initialCalendar={initialCalendar ?? undefined}
    />
  );
}
