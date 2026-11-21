import type { Metadata } from "next";
import MarketsWorkspace from "@/src/new-terminal/workspaces/MarketsWorkspace";

export const metadata: Metadata = {
  title: "Markets | DSA",
  description: "Source-aware market research workspace.",
};

export default function HomePage() {
  return <MarketsWorkspace />;
}
