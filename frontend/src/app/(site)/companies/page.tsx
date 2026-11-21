import CompanyWorkspace from "@/src/new-terminal/workspaces/CompanyWorkspace";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  return <CompanyWorkspace symbol={symbol && /^[A-Z0-9.\-^=]{1,20}$/i.test(symbol) ? symbol : "AAPL"} />;
}
