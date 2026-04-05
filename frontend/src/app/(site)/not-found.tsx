import { ErrorFallback } from "@/src/components/errors/ErrorFallback";

export default function SiteNotFound() {
  return (
    <ErrorFallback
      code={404}
      title="Page not found"
      description="The page you’re looking for doesn’t exist or was moved. Use search or return to the home dashboard."
    />
  );
}
