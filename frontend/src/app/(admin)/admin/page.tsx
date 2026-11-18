"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Building2, Newspaper, BarChart3, Terminal, Database, ArrowUpRight } from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) {
      router.replace("/auth/login");
      return;
    }
    try {
      const parsed = JSON.parse(u);
      if (parsed?.role !== "admin" && parsed?.role !== "staff") {
        router.replace("/auth/login");
      }
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  const modules = [
    { href: "/admin/users", label: "User Management", icon: Users, desc: "Roles, accounts, access state", group: "Access" },
    { href: "/admin/companies", label: "Company / Symbol", icon: Building2, desc: "Symbols and company profile coverage", group: "Market" },
    { href: "/admin/news", label: "News Management", icon: Newspaper, desc: "Review and remove stored news", group: "Content" },
    { href: "/admin/data-fill", label: "Fill Data", icon: Database, desc: "Backfill OHLC and supporting datasets", group: "Data" },
    { href: "/admin/statistics", label: "Most Watched", icon: BarChart3, desc: "Watchlist demand across users", group: "Usage" },
    { href: "/admin/logs", label: "Service Logs", icon: Terminal, desc: "Runtime and admin activity logs", group: "Ops" },
  ];

  return (
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div>
          <p className="dsa-section-label">Administration</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">Operations dashboard</h1>
        </div>
        <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">
          {modules.length} management modules
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Access</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Users & roles</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Market data</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Symbols & backfill</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Content</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">News & email</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Operations</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Logs & usage</p>
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">Management modules</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">Open an operational surface without changing public-site state.</p>
          </div>
        </div>

        <div className="divide-y divide-[var(--dsa-border)]">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group grid grid-cols-[32px_minmax(0,1fr)_72px_18px] items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--dsa-surface-2)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                  <Icon size={14} className="text-[#8ab4ff]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white group-hover:text-[#a9c7ff]">{module.label}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--dsa-text-muted)]">{module.desc}</p>
                </div>
                <span className="text-right text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">{module.group}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--dsa-text-muted)] group-hover:text-[#8ab4ff]" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
