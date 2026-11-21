"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div className="nt-shell">
      <header className="nt-topbar">
        <Link href="/" className="nt-brand" aria-label="DSA home">
          <span className="nt-brand-mark">D</span>
          <span>DSA</span>
        </Link>

        <button type="button" className="nt-command" aria-label="Open command search">
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
        <span>Timestamp and source required for derived metrics</span>
      </footer>
    </div>
  );
}
