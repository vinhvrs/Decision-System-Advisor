import { redirect } from "next/navigation";

export default async function FundamentalsSymbolPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const normalized = decodeURIComponent(symbol || "").trim().toLowerCase();
  redirect(`/companies/profile/${encodeURIComponent(normalized)}?view=financials`);
}
