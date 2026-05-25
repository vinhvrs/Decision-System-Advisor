import { redirect } from "next/navigation";

export default function IndicatorsPage() {
  redirect("/analysis?tab=indicators");
}
