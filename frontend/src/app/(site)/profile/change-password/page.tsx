"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import ProfileSettingsLayout from "@/src/components/profile/ProfileSettingsLayout";
import { readIsLoggedIn, syncAccessTokenFromCookie } from "@/src/libs/session";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    syncAccessTokenFromCookie();
    if (!readIsLoggedIn()) {
      router.replace("/auth/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
        <div className="rounded-2xl border border-white/10 bg-[#161a21] p-8 text-sm text-white/45">
          Loading…
        </div>
      </ProfileSettingsLayout>
    );
  }

  return (
    <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
      <div className="rounded-2xl border border-white/10 bg-[#161a21] p-6 phone:p-8">
        <h2 className="text-lg font-semibold text-white">Change password</h2>
        <p className="mt-1 text-sm text-white/45">
          Update your password to keep your account secure.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {[
            {
              id: "current",
              label: "Current password",
              show: showCurrent,
              toggle: () => setShowCurrent((v) => !v),
            },
            {
              id: "new",
              label: "New password",
              show: showNew,
              toggle: () => setShowNew((v) => !v),
            },
            {
              id: "confirm",
              label: "Confirm new password",
              show: showConfirm,
              toggle: () => setShowConfirm((v) => !v),
            },
          ].map(({ id, label, show, toggle }) => (
            <div key={id} className="space-y-1.5">
              <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-white/40">
                {label}
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"
                  aria-hidden
                />
                <input
                  id={id}
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-[#0b0e14]/80 py-3 pl-10 pr-11 text-sm text-white placeholder:text-white/25 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <button
                  type="button"
                  onClick={toggle}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white/70"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Requirements</p>
            <ul className="mt-2 space-y-1 text-xs text-white/50">
              <li>At least 8 characters</li>
              <li>Include letters and numbers</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500"
            >
              Update password
            </button>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Back to profile
            </Link>
          </div>
        </form>
      </div>
    </ProfileSettingsLayout>
  );
}
