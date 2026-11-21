"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Health, Universe } from "../feeds";
import { useFeed } from "../useFeed";
import {
  BarChart3,
  Building2,
  ChartNoAxesCombined,
  FileText,
  Gauge,
  Newspaper,
  Search,
  Star,
  Table2,
} from "lucide-react";

const items = [
  { href: "/", label: "Markets", icon: Gauge },
  { href: "/screener", label: "Screener", icon: Table2 },
  { href: "/companies", label: "Company", icon: Building2 },
  { href: "/investing", label: "Chart Lab", icon: ChartNoAxesCombined },
  { href: "/indicators", label: "Indicators", icon: BarChart3 },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/watchlists", label: "Watchlists", icon: Star },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/companies") return pathname.startsWith("/companies");
  return pathname.startsWith(href);
}

export default function TerminalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const universe = useFeed<{ data: Universe[] }>(searchOpen ? "/api/v1/universe" : null);
  const health = useFeed<Health>("/api/v1/data-health", 60000);
  const matching = (universe.data?.data ?? []).filter(row =>
    `${row.symbol} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(value => !value);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  return (
    <div className="nt-shell">
      <header className="nt-topbar">
        <Link href="/" className="nt-brand" aria-label="DSA home">
          <span className="nt-brand-mark">D</span>
          <span>DSA</span>
        </Link>

        <button type="button" className="nt-command" aria-label="Open command search" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}>
          <Search size={13} aria-hidden />
          <kbd>⌘K</kbd>
          <span>Search symbol, company, metric or command…</span>
        </button>

        <div className="nt-top-context">
          <span>US Equities</span>
          <span>Research Workspace</span>
          <span>Source-aware</span>
        </div>

        <span className="nt-label nt-status-warn">Data status varies</span>
      </header>

      {searchOpen && <section className="nt-panel" aria-label="Search instruments">
        <div className="nt-toolbar"><label>Symbol or company <input autoFocus value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={() => setSearchOpen(false)}>Close</button></div>
        <div className="nt-toolbar">{matching.map(row => <Link key={row.symbol} href={`/companies/profile/${encodeURIComponent(row.symbol)}`} onClick={() => setSearchOpen(false)}>{row.symbol} · {row.name}</Link>)}
          {!matching.length && <span>{universe.error ?? (universe.data ? "No matching instruments" : "Loading universe…")}</span>}
        </div>
      </section>}

      <div className="nt-tape" aria-label="Global data tape">
        <span className="nt-tape-item"><b>SESSION</b> Source timestamp</span>
        <span className="nt-tape-item"><b>MARKET</b> SOURCE DEPENDENT</span>
        <span className="nt-tape-item"><b>OHLC</b> HIST / LIVE MIX</span>
        <span className="nt-tape-item"><b>FUNDAMENTALS</b> PARTIAL</span>
        <span className="nt-tape-item"><b>ESTIMATES</b> COVERAGE GATED</span>
        <span className="nt-tape-item"><b>FILINGS</b> SEC</span>
        <span className="nt-tape-item"><b>NEWS</b> TIMESTAMP REQUIRED</span>
        <span className="nt-tape-item"><b>PIPELINE</b> {health.data ? `${health.data.pipeline.covered}/${health.data.pipeline.total}` : "—"}</span>
        <span className="nt-tape-item"><b>UPDATED</b> {health.data?.generated_at?.replace("T", " ").slice(0, 19) ?? "—"} {health.data && "UTC"}</span>
      </div>

      <div className="nt-layout">
        <nav className="nt-nav" aria-label="Primary workspaces">
          <div className="nt-nav-label">Workspaces</div>
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="nt-nav-link" data-active={active(pathname, href)}>
              <Icon size={14} strokeWidth={1.6} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <main className="nt-main">{children}</main>
      </div>

      <footer className="nt-statusbar">
        <span className="nt-status-warn">DATA · SOURCE DEPENDENT</span>
        <span>Missing values remain neutral</span>
        <span>Timestamp + source required</span>
        <span>Coverage: Markets / Screener / Company / Chart / Filings</span>
        <span>Errors: 0 UI-inferred values</span>
      </footer>
    </div>
  );
}
