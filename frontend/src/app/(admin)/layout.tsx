"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthService } from "@/src/services/Auth.service";
import { AdminService } from "@/src/services/Admin.service";
import {
  Users,
  Building2,
  Newspaper,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Terminal,
  Mail,
  SlidersHorizontal,
  Database,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/companies", label: "Company / Symbol", icon: Building2 },
  { href: "/admin/news", label: "News Management", icon: Newspaper },
  { href: "/admin/data-fill", label: "Fill Data", icon: Database },
  { href: "/admin/statistics", label: "Most Watched", icon: BarChart3 },
  { href: "/admin/logs", label: "Logs & activity", icon: Terminal },
  { href: "/admin/email", label: "Email desk", icon: Mail },
  { href: "/admin/indicators", label: "Indicator params", icon: SlidersHorizontal },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contactUnread, setContactUnread] = useState(0);

  useEffect(() => {
    if (pathname === "/admin/auth") return;

    const timer = window.setTimeout(() => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        localStorage.removeItem("user");
        router.replace("/admin/auth");
        return;
      }

      const u = localStorage.getItem("user");
      if (u) {
        try {
          const parsed = JSON.parse(u) as { name?: string; role?: string };
          setUser(parsed);
          const role = parsed.role;
          if (role !== "admin" && role !== "staff") {
            alert("Forbidden. Admin or staff role required.");
            router.replace("/auth/login");
          }
        } catch {
          router.replace("/admin/auth");
        }
      } else {
        router.replace("/admin/auth");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router, pathname]);

  useEffect(() => {
    if (pathname === "/admin/auth" || !user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const n = await AdminService.email.contactUnreadCount();
        if (!cancelled) setContactUnread(Number.isFinite(n) ? n : 0);
      } catch {
        if (!cancelled) setContactUnread(0);
      }
    };
    void load();
    const id = window.setInterval(load, 45_000);
    const onUpdate = () => void load();
    window.addEventListener("dsa-contact-inbox-updated", onUpdate);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("dsa-contact-inbox-updated", onUpdate);
    };
  }, [pathname, user]);

  const handleLogout = () => {
    AuthService.logout();
    router.replace("/admin/auth");
  };

  if (pathname === "/admin/auth") {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--dsa-bg)] text-[var(--dsa-text)]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[208px] border-r border-[var(--dsa-border)] bg-[#0b1118] transition-transform laptop:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center justify-between border-b border-[var(--dsa-border)] px-3">
          <Link href="/admin" className="font-mono text-xs font-semibold tracking-[0.06em] text-white">
            DSA ADMIN
          </Link>
          <button
            type="button"
            className="rounded-[var(--dsa-radius-sm)] p-1.5 text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white laptop:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close admin navigation"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="space-y-0.5 p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-9 items-center gap-2 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "border-[rgba(76,141,255,0.28)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                    : "border-transparent text-[var(--dsa-text-secondary)] hover:border-[var(--dsa-border)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={14} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.href === "/admin/email" && contactUnread > 0 ? (
                  <span className="shrink-0 font-mono text-[9px] font-semibold text-[var(--dsa-warning)]" aria-label={`${contactUnread} unread contacts`}>
                    {contactUnread > 99 ? "99+" : contactUnread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--dsa-border)] p-2">
          <Link
            href="/"
            className="mb-1 flex min-h-8 items-center rounded-[var(--dsa-radius-sm)] px-2.5 text-[10px] text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
          >
            ← Public terminal
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-9 w-full items-center gap-2 rounded-[var(--dsa-radius-sm)] px-2.5 py-1.5 text-[11px] text-[var(--dsa-negative)] hover:bg-[rgba(231,91,100,0.08)]"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/55 laptop:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="min-w-0 laptop:ml-[208px]">
        <header className="sticky top-0 z-20 flex h-11 items-center justify-between gap-3 border-b border-[var(--dsa-border)] bg-[#0b1118]/95 px-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-[var(--dsa-radius-sm)] p-1.5 text-[var(--dsa-text-secondary)] hover:bg-[var(--dsa-surface-2)] hover:text-white laptop:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin navigation"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[var(--dsa-text-muted)]">Administration</p>
              <p className="truncate text-[11px] font-medium text-white">{pathname.replace(/^\/admin\/?/, "") || "dashboard"}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-[10px] text-[var(--dsa-text-muted)]">
            <span className="hidden phone:inline">{user?.name}</span>
            <span className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-1.5 py-0.5 font-mono uppercase text-[#8ab4ff]">
              {user?.role}
            </span>
          </div>
        </header>

        <main className="min-w-0 p-3 tablet:p-4">{children}</main>
      </div>
    </div>
  );
}
