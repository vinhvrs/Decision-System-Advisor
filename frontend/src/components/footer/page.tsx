import Link from "next/link";
import { Mail } from "lucide-react";

const PLATFORM_LINKS = [
  { name: "Market overview", href: "/" },
  { name: "Screener", href: "/screener" },
  { name: "Market research", href: "/investing" },
  { name: "Indicators", href: "/indicators" },
] as const;

const RESOURCE_LINKS = [
  { name: "Market news", href: "/news" },
  { name: "Documents", href: "/documents" },
  { name: "Contact", href: "/contact" },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-6 phone:px-4 tablet:px-5 laptop:px-6">
      <div className="dsa-page">
        <div className="grid gap-6 tablet:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
          <div className="max-w-xl">
            <Link href="/" className="inline-flex items-baseline gap-2 text-sm font-semibold text-white">
              <span className="tracking-[0.05em]">DSA</span>
              <span className="text-xs font-medium text-[var(--dsa-text-muted)]">
                Decision Support Advisor
              </span>
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-[var(--dsa-text-muted)]">
              Research interface for market data, rankings, indicators, news, and decision-support context.
              Data availability, freshness, and source coverage can vary by instrument and module.
            </p>
            <a
              href="mailto:ITITIU21345@hcmiu.edu.vn"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--dsa-text-secondary)] hover:text-white"
            >
              <Mail size={13} />
              Contact
            </a>
          </div>

          <div>
            <p className="dsa-section-label">Platform</p>
            <ul className="mt-2 space-y-1.5">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-[var(--dsa-text-secondary)] transition-colors hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="dsa-section-label">Resources</p>
            <ul className="mt-2 space-y-1.5">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-[var(--dsa-text-secondary)] transition-colors hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--dsa-border)] pt-4">
          <p className="max-w-5xl text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
            <span className="font-semibold text-[var(--dsa-warning)]">Risk disclosure:</span>{" "}
            Market data, scores, and directional labels on DSA are provided for research and educational use.
            They do not constitute investment advice, an offer, or a recommendation to transact in any security.
            Check the source and as-of information shown by each module before relying on a value.
          </p>
          <div className="mt-3 flex flex-col gap-1 text-[10px] text-[var(--dsa-text-muted)] phone:flex-row phone:items-center phone:justify-between">
            <p>© {currentYear} DSA.</p>
            <p>No hard-coded service-status claim. Data health should be verified from live module state.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
