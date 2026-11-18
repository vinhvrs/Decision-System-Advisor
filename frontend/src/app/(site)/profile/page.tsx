"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Mail, Phone, User as UserIcon } from "lucide-react";
import ProfileSettingsLayout from "@/src/components/profile/ProfileSettingsLayout";
import { stripParentheticals } from "@/src/libs/displayString";
import { readIsLoggedIn, readStoredUser, syncAccessTokenFromCookie } from "@/src/libs/session";
import type { User } from "@/src/types/User";

function splitDisplayName(name: string): { first: string; last: string } {
  const trimmed = stripParentheticals(name).trim();
  if (!trimmed) return { first: "", last: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function roleLabel(role?: string): string {
  if (!role) return "Member";
  if (role === "admin") return "Administrator";
  if (role === "staff") return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function ProfileField({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[132px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--dsa-border)] px-3 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
        <Icon size={13} className="shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <div className={`min-w-0 truncate text-xs text-white ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hydrate = () => {
      syncAccessTokenFromCookie();
      if (!readIsLoggedIn()) {
        router.replace("/auth/login");
        return;
      }
      setUser(readStoredUser());
      setReady(true);
    };

    const initialHydration = window.setTimeout(hydrate, 0);
    const onAuth = () => {
      if (!readIsLoggedIn()) {
        router.replace("/auth/login");
        return;
      }
      setUser(readStoredUser());
    };
    window.addEventListener("auth-changed", onAuth);
    return () => {
      window.clearTimeout(initialHydration);
      window.removeEventListener("auth-changed", onAuth);
    };
  }, [router]);

  const displayName = useMemo(() => {
    if (!user) return "";
    return (
      stripParentheticals(user.name || "").trim() ||
      user.username?.trim() ||
      user.email?.split("@")[0] ||
      "User"
    );
  }, [user]);

  const { first, last } = useMemo(() => splitDisplayName(displayName), [displayName]);
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  if (!ready) {
    return (
      <ProfileSettingsLayout title="Profile" breadcrumbLabel="Profile">
        <div className="dsa-terminal-panel flex min-h-28 items-center justify-center text-xs text-[var(--dsa-text-muted)]">
          Loading profile…
        </div>
      </ProfileSettingsLayout>
    );
  }

  if (!user) return null;

  return (
    <ProfileSettingsLayout title="Profile" breadcrumbLabel="Profile">
      <div className="space-y-3">
        <section className="dsa-terminal-panel overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Account identity</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">Session-backed account information.</p>
            </div>
            <span className="rounded-[var(--dsa-radius-sm)] border border-[rgba(76,141,255,0.28)] bg-[var(--dsa-accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#a9c7ff]">
              {roleLabel(user.role)}
            </span>
          </div>

          <div className="flex items-center gap-3 border-b border-[var(--dsa-border)] px-3 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] font-mono text-sm font-semibold text-[#8ab4ff]">
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">{displayName}</h2>
              <p className="mt-0.5 truncate text-[10px] text-[var(--dsa-text-muted)]">{user.email}</p>
            </div>
          </div>

          <div>
            <ProfileField label="First name" value={first} icon={UserIcon} />
            <ProfileField label="Last name" value={last} icon={UserIcon} />
            <ProfileField label="Display name" value={displayName} icon={UserIcon} />
            <ProfileField label="Username" value={user.username} icon={AtSign} mono />
            <ProfileField label="Email" value={user.email} icon={Mail} />
            <ProfileField label="Phone" value={user.phone || "Not provided"} icon={Phone} />
          </div>
        </section>

        <section className="dsa-terminal-panel px-3 py-2.5">
          <div className="flex flex-col gap-1 phone:flex-row phone:items-center phone:justify-between">
            <p className="text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
              Profile details are loaded from your signed-in session.
            </p>
            <Link
              href="/profile/change-password"
              className="text-[10px] font-semibold text-[#8ab4ff] hover:text-white"
            >
              Open security settings →
            </Link>
          </div>
        </section>
      </div>
    </ProfileSettingsLayout>
  );
}
