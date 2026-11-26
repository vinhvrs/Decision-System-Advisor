import CompanyWorkspace, { type CompanyOverview, type CompanyStatement, type CompanyPriceBar, type CompanyPeer } from "@/src/new-terminal/workspaces/CompanyWorkspace";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import type { Filing, Metrics, News } from "@/src/new-terminal/feeds";

type Props = {
  params: Promise<{ "inc-slug": string }>;
  searchParams: Promise<{ view?: string }>;
};

export const dynamic = "force-dynamic";

export default async function CompanyProfileBySlugPage({ params, searchParams }: Props) {
  const { "inc-slug": slug } = await params;
  const { view } = await searchParams;
  const symbol = slug.trim().toUpperCase();
  const id = encodeURIComponent(symbol);
  const activeTab = view?.toLowerCase() === "kpis" ? "KPIs" : view ? view.charAt(0).toUpperCase() + view.slice(1).toLowerCase() : "Overview";
  const now = new Date();
  const from = new Date(now.getTime() - 160 * 86400000).toISOString().slice(0,10);
  const to = now.toISOString().slice(0,10);

  const [initialRows, initialOverview, initialFund, quarterly, filings, news, history] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<CompanyOverview>(`/api/companies/${id}/overview`, 120),
    readData<Metrics>(`/api/v1/sourced-fundamentals/${id}`, 120),
    readData<{ data: CompanyStatement[] }>(`/api/fundamentals/${id}/quarterly`, 120),
    readData<{ data: Filing[] }>(`/api/filings/${id}`, 120),
    readData<News[]>(`/api/news/symbol/${id}`, 60),
    readData<{ data: CompanyPriceBar[] }>(`/api/market/daily-history/${id}?from=${from}&to=${to}`, 300),
  ]);

  const peerDefs = (initialOverview?.similar ?? []).filter(peer => peer.symbol !== symbol).slice(0,6);
  const peerMetrics = await Promise.all(peerDefs.map(peer => readData<Metrics>(`/api/v1/sourced-fundamentals/${encodeURIComponent(peer.symbol)}`, 300)));
  const initialPeers: CompanyPeer[] = peerDefs.map((peer,index) => ({
    symbol: peer.symbol,
    name: peer.company_name,
    metrics: peerMetrics[index],
    quote: initialRows.find(row => row.symbol === peer.symbol),
  }));

  return <CompanyWorkspace
    symbol={symbol}
    activeTab={activeTab}
    initialRows={initialRows}
    initialOverview={initialOverview}
    initialFund={initialFund}
    initialOverviewFinancials={quarterly?.data ?? []}
    initialFilings={filings?.data ?? []}
    initialNews={news ?? []}
    initialHistory={history?.data ?? []}
    initialPeers={initialPeers}
  />;
}
