"use client";

import { use } from "react";
import { StockProfilePage } from "./StockProfilePage";

type Props = {
  params: Promise<{ "inc-slug": string }>;
};

export default function CompanyProfileBySlugPage({ params }: Props) {
  const { "inc-slug": slug } = use(params);
  return <StockProfilePage slug={slug} />;
}
