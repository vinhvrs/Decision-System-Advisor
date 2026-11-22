import { DocumentsWorkspace } from "@/src/new-terminal/workspaces/FeedWorkspaces";
import { readData } from "@/src/new-terminal/serverData";
import type { Filing } from "@/src/new-terminal/feeds";

export default async function DocumentsPage() {
  const payload = await readData<{ data: Filing[] }>("/api/filings/AAPL", 120);
  return <DocumentsWorkspace initialFilings={payload?.data ?? []} />;
}
