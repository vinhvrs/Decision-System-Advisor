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
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-white/40">{label}</label>
      <div className="relative">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"
          aria-hidden
        />
        <div
          className={[
            "w-full rounded-xl border border-white/10 bg-[#0b0e14]/80 px-4 py-3 pl-10 text-white/90",
            mono ? "font-mono text-sm" : "text-sm",
          ].join(" ")}
        >
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    syncAccessTokenFromCookie();
    if (!readIsLoggedIn()) {
      router.replace("/auth/login");
      return;
    }
    setUser(readStoredUser());
    setReady(true);

    const onAuth = () => {
      if (!readIsLoggedIn()) {
        router.replace("/auth/login");
        return;
      }
      setUser(readStoredUser());
    };
    window.addEventListener("auth-changed", onAuth);
    return () => window.removeEventListener("auth-changed", onAuth);
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
        <div className="rounded-2xl border border-white/10 bg-[#161a21] p-8 text-sm text-white/45">
          Loading your profile…
        </div>
      </ProfileSettingsLayout>
    );
  }

  if (!user) return null;

  return (
    <ProfileSettingsLayout title="Profile" breadcrumbLabel="Profile">
      <div className="rounded-2xl border border-white/10 bg-[#161a21] p-6 phone:p-8">
        <div className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-2xl font-bold text-indigo-100 ring-2 ring-indigo-500/30">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-white">{displayName}</h2>
            <p className="mt-0.5 truncate text-sm text-white/45">{user.email}</p>
            <span className="mt-3 inline-flex rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
              {roleLabel(user.role)}
            </span>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ProfileField label="First name" value={first} icon={UserIcon} />
            <ProfileField label="Last name" value={last} icon={UserIcon} />
          </div>

          <ProfileField label="Display name" value={displayName} icon={UserIcon} />
          <ProfileField label="Username" value={user.username} icon={AtSign} mono />
          <ProfileField label="Email address" value={user.email} icon={Mail} />
          <ProfileField label="Phone" value={user.phone || "Not provided"} icon={Phone} />

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/40">
            Profile details are loaded from your signed-in session. To change your password, go to{" "}
            <Link href="/profile/change-password" className="text-indigo-300 hover:text-indigo-200">
              Security
            </Link>
            .
          </div>
        </div>
      </div>
    </ProfileSettingsLayout>
  );
}
