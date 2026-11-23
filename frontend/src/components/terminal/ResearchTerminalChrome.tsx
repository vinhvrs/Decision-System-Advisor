"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FileText,
  Gauge,
  LineChart,
  Newspaper,
  ScanSearch,
} from "lucide-react";

const MODULES = [
  { label: "Markets", href: "/", icon: Gauge },
  { label: "Screener", href: "/screener", icon: ScanSearch },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Research", href: "/investing", icon: BarChart3 },
  { label: "Indicators", href: "/indicators", icon: LineChart },
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Documents", href: "/documents", icon: FileText },
] as const;

function isModuleActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/screener") return pathname.startsWith("/screener") || pathname.startsWith("/instrument");
  if (href === "/companies") return pathname.startsWith("/companies") || pathname.startsWith("/stock-profile");
  if (href === "/investing") {
    return pathname.startsWith("/investing") || pathname.startsWith("/trading") || pathname.startsWith("/strategy");
  }
  if (href === "/indicators") return pathname.startsWith("/indicators") || pathname.startsWith("/analysis");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function ResearchTerminalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dsa-terminal-shell">
      <div className="dsa-terminal-modulebar">
        <div className="dsa-page flex min-h-9 items-stretch justify-between gap-3 px-2 phone:px-3 laptop:px-4">
          <nav className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto" aria-label="Research modules">
            {MODULES.map(({ label, href }) => {
              const active = isModuleActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`dsa-terminal-tab ${active ? "dsa-terminal-tab-active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--dsa-text-muted)] laptop:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--dsa-positive)]" />
            <span>US equities</span>
            <span className="text-[var(--dsa-border-strong)]">|</span>
            <span>40-symbol workspace</span>
            <span className="text-[var(--dsa-border-strong)]">|</span>
            <span>Research mode</span>
          </div>
        </div>
      </div>

      <div className="dsa-terminal-grid">
        <aside className="dsa-terminal-rail" aria-label="Quick research navigation">
          <div className="dsa-terminal-rail-inner">
            {MODULES.slice(0, 6).map(({ label, href, icon: Icon }) => {
              const active = isModuleActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`dsa-terminal-rail-link ${active ? "dsa-terminal-rail-link-active" : ""}`}
                  title={label}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label.slice(0, 3).toUpperCase()}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
