import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ symbol: string }>;
};

/** Legacy `/investing/:symbol` fundamentals URLs → `/fundamentals/:symbol`. */
export default async function InvestingSymbolRedirect({ params }: Props) {
  const { symbol } = await params;
  redirect(`/fundamentals/${encodeURIComponent(symbol)}`);
}
