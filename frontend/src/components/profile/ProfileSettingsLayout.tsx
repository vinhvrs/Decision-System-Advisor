"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield } from "lucide-react";
import clsx from "clsx";

type ProfileSettingsLayoutProps = {
  title: string;
  breadcrumbLabel: string;
  children: React.ReactNode;
};

const NAV = [
  { href: "/profile", label: "Profile details", icon: User },
  { href: "/profile/change-password", label: "Security", icon: Shield },
] as const;

export default function ProfileSettingsLayout({
  title,
  breadcrumbLabel,
  children,
}: ProfileSettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <p className="dsa-section-label">Account settings</p>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-sm font-semibold text-white">{title}</h1>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">
              {breadcrumbLabel}
            </span>
          </div>
        </div>
        <Link
          href="/"
          className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
        >
          Back to terminal
        </Link>
      </section>

      <div className="grid min-w-0 gap-3 tablet:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="dsa-terminal-panel overflow-hidden tablet:sticky tablet:top-[calc(var(--dsa-header-height)_+_12px)] tablet:self-start">
          <div className="dsa-terminal-panel-head">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">
              Settings
            </p>
          </div>
          <nav className="p-1.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex min-h-9 items-center gap-2 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[rgba(76,141,255,0.28)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                      : "border-transparent text-[var(--dsa-text-secondary)] hover:border-[var(--dsa-border)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                  )}
                >
                  <Icon size={14} className={active ? "text-[#8ab4ff]" : "text-[var(--dsa-text-muted)]"} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
