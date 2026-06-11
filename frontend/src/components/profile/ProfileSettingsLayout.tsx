"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, ChevronRight } from "lucide-react";
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
    <div className="w-full">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-white/40">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <ChevronRight size={14} className="shrink-0" aria-hidden />
        <span className="text-white/70">Settings</span>
        <ChevronRight size={14} className="shrink-0" aria-hidden />
        <span className="text-indigo-300">{breadcrumbLabel}</span>
      </nav>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] md:gap-8 lg:gap-10">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white phone:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-white/45">Manage your DSA account preferences.</p>
          </div>

          <aside className="flex flex-row gap-2 md:flex-col md:gap-1.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition md:flex-none",
                    active
                      ? "border border-white/10 bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon size={17} className={active ? "text-indigo-300" : "text-white/40"} />
                  {label}
                </Link>
              );
            })}
          </aside>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
