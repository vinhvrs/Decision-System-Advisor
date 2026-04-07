import Footer from "@/src/components/footer/page";
import Header from "@/src/components/header/page";
import { ErrorFallback } from "@/src/components/errors/ErrorFallback";

export default function NotFound() {
  return (
    <>
      <header className="sticky top-0 z-50 mb-0">
        <Header />
      </header>
      <main className="min-h-[55vh] px-4 py-6 phone:px-5 tablet:px-6 tablet:py-8">
        <ErrorFallback
          code={404}
          title="Page not found"
          description="The page you’re looking for doesn’t exist or was moved. Use search or return to the home dashboard."
        />
      </main>
      <Footer />
    </>
  );
}
