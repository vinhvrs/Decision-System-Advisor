import CompanyWorkspace, { type CompanyOverview, type CompanyStatement } from "@/src/new-terminal/workspaces/CompanyWorkspace";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import type { Filing, Metrics, News } from "@/src/new-terminal/feeds";

type Props = {
  params: Promise<{ "inc-slug": string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function CompanyProfileBySlugPage({ params, searchParams }: Props) {
  const { "inc-slug": slug } = await params;
  const { view } = await searchParams;
  const symbol = slug.trim().toUpperCase();
  const id = encodeURIComponent(symbol);
  const activeTab = view ? view.charAt(0).toUpperCase() + view.slice(1) : "Overview";

  const [initialRows, initialOverview, initialFund, quarterly, filings, news] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<CompanyOverview>(`/api/companies/${id}/overview`, 120),
    readData<Metrics>(`/api/v1/sourced-fundamentals/${id}`, 120),
    readData<{ data: CompanyStatement[] }>(`/api/fundamentals/${id}/quarterly`, 120),
    readData<{ data: Filing[] }>(`/api/filings/${id}`, 120),
    readData<News[]>(`/api/news/symbol/${id}`, 60),
  ]);

  return <CompanyWorkspace
    symbol={symbol}
    activeTab={activeTab}
    initialRows={initialRows}
    initialOverview={initialOverview}
    initialFund={initialFund}
    initialOverviewFinancials={quarterly?.data ?? []}
    initialFilings={filings?.data ?? []}
    initialNews={news ?? []}
  />;
}
