import type { Metadata } from "next";
import BeginnerTestHome from "./BeginnerTestHome";

export const metadata: Metadata = {
  title: "Beginner market view | DSA",
  description:
    "Dashboard-style view: ranked symbols, radar scores, snapshot price and change, volume, liquidity, and watchlist interest — explained in plain language.",
};

export default function TestBeginnerPage() {
  return <BeginnerTestHome />;
}
