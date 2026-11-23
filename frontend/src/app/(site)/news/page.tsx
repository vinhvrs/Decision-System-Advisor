import NewsroomWorkspace from "@/src/new-terminal/workspaces/NewsroomWorkspace";
import { readData } from "@/src/new-terminal/serverData";
import type { News } from "@/src/new-terminal/feeds";

export default async function NewsPage() {
  const payload = await readData<{ data: News[]; last_page?: number; total?: number }>("/api/news?per_page=100&page=1", 60);
  return (
    <NewsroomWorkspace
      initialNews={payload?.data ?? []}
      initialLastPage={payload?.last_page ?? 1}
      initialTotal={payload?.total ?? 0}
    />
  );
}
