import Footer from "@/src/components/footer/page";
import Header from "@/src/components/header/page";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />

      <main className="min-w-0 overflow-x-clip px-3 py-4 phone:px-4 tablet:px-5 tablet:py-5 laptop:px-6">
        {children}
      </main>

      <Footer />
    </>
  );
}
