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

    const token = localStorage.getItem("accessToken");
    if (!token) {
      localStorage.removeItem("user");
      router.replace("/admin/auth");
      return;
    }

    const u = localStorage.getItem("user");
    if (u) {
      try {
        const parsed = JSON.parse(u);
        setUser(parsed);
        const role = parsed?.role;
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
    <div className="min-h-screen bg-[#0b1220] text-white flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0f172a] border-r border-white/10 transform transition-transform laptop:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/admin" className="font-bold text-lg">
            DSA Admin
          </Link>
          <button
            className="laptop:hidden p-2"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive ? "bg-blue-600/20 text-blue-400" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin/email" && contactUnread > 0 ? (
                  <span className="shrink-0 text-xs font-semibold text-amber-300" aria-label={`${contactUnread} unread contacts`}>
                    ({contactUnread > 99 ? "99+" : contactUnread})
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 laptop:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 laptop:ml-64">
        <header className="sticky top-0 z-20 h-16 bg-[#0b1220]/90 backdrop-blur border-b border-white/10 flex items-center px-4 gap-4">
          <button
            className="laptop:hidden p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <span className="text-sm text-white/60">
            {user?.name} <span className="text-blue-400">({user?.role})</span>
          </span>
        </header>
        <main className="p-4 tablet:p-6">{children}</main>
      </div>
    </div>
  );
}
