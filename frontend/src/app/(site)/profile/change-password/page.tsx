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
    const timer = window.setTimeout(() => {
      syncAccessTokenFromCookie();
      if (!readIsLoggedIn()) {
        router.replace("/auth/login");
        return;
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  if (!ready) {
    return (
      <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
        <div className="dsa-terminal-panel flex min-h-28 items-center justify-center text-xs text-[var(--dsa-text-muted)]">
          Loading security settings…
        </div>
      </ProfileSettingsLayout>
    );
  }

  const fields = [
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
  ];

  return (
    <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">Change password</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">Update your account credential.</p>
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">
            Security
          </span>
        </div>

        <form
          className="space-y-0"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {fields.map(({ id, label, show, toggle }) => (
            <div
              key={id}
              className="grid min-w-0 gap-2 border-b border-[var(--dsa-border)] px-3 py-3 tablet:grid-cols-[160px_minmax(0,1fr)] tablet:items-center"
            >
              <label
                htmlFor={id}
                className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]"
              >
                {label}
              </label>
              <div className="relative max-w-xl">
                <Lock
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dsa-text-muted)]"
                  aria-hidden
                />
                <input
                  id={id}
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  className="dsa-control h-8 min-h-0 w-full py-1.5 pl-8 pr-9 text-xs placeholder:text-[var(--dsa-text-muted)]"
                />
                <button
                  type="button"
                  onClick={toggle}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[var(--dsa-radius-sm)] p-1 text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-3)] hover:text-white"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          ))}

          <div className="grid gap-3 px-3 py-3 tablet:grid-cols-[160px_minmax(0,1fr)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
              Requirements
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--dsa-text-secondary)]">
              <span>≥ 8 characters</span>
              <span>Letters + numbers</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--dsa-border)] bg-[#0b1118] px-3 py-2">
            <Link
              href="/profile"
              className="dsa-button-secondary min-h-0 px-3 py-1.5 text-[11px]"
            >
              Back to profile
            </Link>
            <button
              type="submit"
              className="dsa-button-primary min-h-0 px-3 py-1.5 text-[11px]"
            >
              Update password
            </button>
          </div>
        </form>
      </section>
    </ProfileSettingsLayout>
  );
}
