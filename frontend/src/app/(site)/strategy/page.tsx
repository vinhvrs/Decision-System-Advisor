import { redirect } from "next/navigation";

export default function StrategyPage() {
  redirect("/analysis?tab=strategy");
}
