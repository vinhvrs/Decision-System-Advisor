import { NewsWorkspace } from "@/src/new-terminal/workspaces/FeedWorkspaces";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import type { Calendar, News } from "@/src/new-terminal/feeds";

export default async function EventsPage() {
  const [initialRows, newsPayload, initialCalendar] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<{ data: News[]; last_page: number }>("/api/news?page=1", 60),
    readData<Calendar>("/api/v1/economic-calendar?limit=30", 60),
  ]);
  return <NewsWorkspace
    initialRows={initialRows}
    initialNews={newsPayload?.data ?? []}
    initialCalendar={initialCalendar}
  />;
}
