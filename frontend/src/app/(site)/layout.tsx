import Footer from "@/src/components/footer/page";
import Header from "@/src/components/header/page";
import ResearchTerminalChrome from "@/src/components/terminal/ResearchTerminalChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />

      <ResearchTerminalChrome>
        <main className="min-w-0 overflow-x-clip px-2 py-3 phone:px-3 tablet:px-4 tablet:py-4 laptop:px-5">
          {children}
        </main>
      </ResearchTerminalChrome>

      <Footer />
    </>
  );
}
