import Header from "../../../src/components/header/page";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mb-0 sticky top-0 z-50">
        <Header />
      </header>

      <main className="px-6 py-10">{children}</main>
    </>
  );
}
