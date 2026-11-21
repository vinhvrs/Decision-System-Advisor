import ChartLabWorkspace from "@/src/new-terminal/workspaces/ChartLabWorkspace";

export default async function InvestingPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  return <ChartLabWorkspace initialSymbol={symbol && /^[A-Z0-9.\-^=]{1,20}$/i.test(symbol) ? symbol.toUpperCase() : "AAPL"} />;
}
