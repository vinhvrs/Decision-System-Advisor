import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import type { Metadata } from "next";
import MarketsWorkspace from "@/src/new-terminal/workspaces/MarketsWorkspace";

export const metadata: Metadata = {
  title: "Markets | DSA",
  description: "Source-aware market research workspace.",
};

export default async function HomePage() {
  const rows = await readMarketSnapshot().catch(() => []);
  return <MarketsWorkspace initialRows={rows} />;
}

export const dynamic = "force-dynamic";
