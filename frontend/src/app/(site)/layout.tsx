import Footer from "@/src/components/footer/page";
import Header from "@/src/components/header/page";
import ChatBoxLazy from "@/src/components/chatbox/ChatBoxLazy";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mb-0 sticky top-0 z-50">
        <Header />
      </header>

      <main className="min-w-0 overflow-x-hidden px-4 py-6 phone:px-5 tablet:px-6 tablet:py-8 laptop:py-10">
        {children}
        <ChatBoxLazy />
      </main>

      <Footer />
    </>
  );
}
