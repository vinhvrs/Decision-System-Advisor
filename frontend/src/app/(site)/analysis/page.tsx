import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AnalysisPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (sp.tab === "strategy") {
    redirect("/indicators?tab=strategy");
  }
  redirect("/indicators");
}
