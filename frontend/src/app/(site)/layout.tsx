import Header from "@/src/components/header/page";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mb-0 sticky top-0 z-50">
        <Header />
      </header>

      <main className="px-6 py-10">{children}</main>

      <footer className="mt-20 py-6 border-t border-white/10 text-center text-sm text-white/50">
        <div className="max-w-7xl mx-auto text-sm text-white/40 flex flex-col md:flex-row justify-between gap-4">
          <p>
            © {new Date().getFullYear()} Decision Stock Advisor · Academic Project
          </p>
          <div className="flex gap-6">
            <a href="/about" className="hover:text-white">About</a>
            <a href="/contact" className="hover:text-white">Contact</a>
            <a href="/documents" className="hover:text-white">Documents</a>
          </div>
        </div>
      </footer>
    </>
  );
}
