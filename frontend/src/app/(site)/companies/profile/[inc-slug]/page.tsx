"use client";

import { use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import CompanyWorkspace from "@/src/new-terminal/workspaces/CompanyWorkspace";

type Props = {
  params: Promise<{ "inc-slug": string }>;
};

export default function CompanyProfileBySlugPage({ params }: Props) {
  const { "inc-slug": slug } = use(params);
  const search = useSearchParams();
  const activeTab = useMemo(() => {
    const view = search.get("view");
    if (!view) return "Overview";
    return view.charAt(0).toUpperCase() + view.slice(1);
  }, [search]);

  return <CompanyWorkspace symbol={slug} activeTab={activeTab} />;
}
