import type { Metadata } from "next";
import BeginnerTestHome from "./BeginnerTestHome";

export const metadata: Metadata = {
  title: "Stock basics for beginners | DSA",
  description:
    "A simple test page: price, daily or yearly candles, volume, liquidity, and how many people watch each symbol — explained in plain language.",
};

export default function TestBeginnerPage() {
  return <BeginnerTestHome />;
}
