import Link from "next/link";
import { Mail } from "lucide-react";

const TERMINAL_LINKS = [
  { name: "Markets", href: "/" },
  { name: "Screener", href: "/screener" },
  { name: "Companies", href: "/companies" },
  { name: "Research", href: "/investing" },
  { name: "Indicators", href: "/indicators" },
  { name: "News", href: "/news" },
  { name: "Documents", href: "/documents" },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--dsa-border)] bg-[#0b1118] px-2 py-2 phone:px-3 tablet:px-4 laptop:px-5">
      <div className="dsa-page space-y-2">
        <div className="flex min-w-0 flex-col gap-2 laptop:flex-row laptop:items-center laptop:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="shrink-0 font-mono text-[11px] font-semibold tracking-[0.06em] text-white">
              DSA
            </Link>
            <span className="hidden h-3 w-px bg-[var(--dsa-border)] phone:block" />
            <p className="min-w-0 truncate text-[10px] text-[var(--dsa-text-muted)]">
              Decision Support Advisor · research terminal
            </p>
          </div>

          <nav className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Footer research modules">
            {TERMINAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-[var(--dsa-radius-sm)] px-2 py-1 text-[10px] font-medium text-[var(--dsa-text-muted)] transition-colors hover:bg-[var(--dsa-surface-2)] hover:text-white"
              >
                {link.name}
              </Link>
            ))}
            <a
              href="mailto:ITITIU21345@hcmiu.edu.vn"
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-[var(--dsa-radius-sm)] px-2 py-1 text-[10px] text-[var(--dsa-text-muted)] transition-colors hover:bg-[var(--dsa-surface-2)] hover:text-white"
            >
              <Mail size={11} />
              Contact
            </a>
          </nav>
        </div>

        <div className="flex flex-col gap-1 border-t border-[var(--dsa-border)] pt-2 text-[9px] leading-relaxed text-[var(--dsa-text-muted)] tablet:flex-row tablet:items-center tablet:justify-between">
          <p className="max-w-5xl">
            <span className="font-semibold text-[var(--dsa-warning)]">Research use only.</span>{" "}
            Market data, scores, and directional labels are not investment advice. Verify source and as-of state before relying on a value.
          </p>
          <p className="shrink-0 font-mono">© {currentYear} DSA</p>
        </div>
      </div>
    </footer>
  );
}
