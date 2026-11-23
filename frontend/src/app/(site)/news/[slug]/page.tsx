import { notFound } from "next/navigation";
import { NewsArticleWorkspace } from "@/src/new-terminal/workspaces/NewsroomWorkspace";
import { readData } from "@/src/new-terminal/serverData";
import type { News } from "@/src/new-terminal/feeds";

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await readData<News>(`/api/news/${encodeURIComponent(slug)}`, 60);
  if (!article) notFound();
  return <NewsArticleWorkspace article={article} />;
}
