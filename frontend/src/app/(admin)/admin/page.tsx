"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Building2, Newspaper, BarChart3, Terminal } from "lucide-react";

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

  const cards = [
    { href: "/admin/users", label: "User Management", icon: Users, desc: "Edit roles, manage accounts" },
    { href: "/admin/companies", label: "Company / Symbol", icon: Building2, desc: "Manage symbols and company profiles" },
    { href: "/admin/news", label: "News Management", icon: Newspaper, desc: "View and delete news articles" },
    { href: "/admin/statistics", label: "Most Watched", icon: BarChart3, desc: "Companies most added to watchlists" },
    { href: "/admin/logs", label: "Service logs", icon: Terminal, desc: "PHP, Python, and frontend log tails" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="p-6 rounded-xl bg-[#161D2C] border border-white/10 hover:border-blue-500/40 transition-all flex gap-4 items-start"
            >
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Icon size={24} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{card.label}</h2>
                <p className="text-sm text-white/60 mt-1">{card.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
