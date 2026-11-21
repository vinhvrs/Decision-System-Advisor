import ScreenerWorkspace from "@/src/new-terminal/workspaces/ScreenerWorkspace";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <ScreenerWorkspace initialQuery={(q ?? "").slice(0, 80)} />;
}
