"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import ProfileSettingsLayout from "@/src/components/profile/ProfileSettingsLayout";
import { AuthService } from "@/src/services/Auth.service";
import { apiErrorMessage } from "@/src/libs/axiosError";
import { readIsLoggedIn, syncAccessTokenFromCookie } from "@/src/libs/session";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  show: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function PasswordField({
  id,
  label,
  value,
  show,
  autoComplete,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]"
      >
        {label}
      </label>
      <div className="relative">
        <Lock
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dsa-text-muted)]"
          aria-hidden
        />
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="dsa-control h-10 w-full py-2 pl-9 pr-10 text-sm outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[var(--dsa-radius-sm)] p-1 text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-3)] hover:text-white"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setError("New password must be at least 8 characters and include letters and numbers.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await AuthService.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmation,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccess(result.message || "Password updated. Sign in again.");
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Password could not be updated."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
        <div className="dsa-panel p-6 text-xs text-[var(--dsa-text-muted)]">
          Loading security settings…
        </div>
      </ProfileSettingsLayout>
    );
  }

  if (success) {
    return (
      <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
        <div className="dsa-panel p-5">
          <p className="text-sm font-semibold text-[var(--dsa-positive)]">Password updated</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
            {success}
          </p>
          <p className="mt-2 text-[10px] text-[var(--dsa-text-muted)]">
            Existing API sessions were revoked as part of the password change.
          </p>
          <Link href="/auth/login" className="dsa-button-primary mt-4">
            Sign in again
          </Link>
        </div>
      </ProfileSettingsLayout>
    );
  }

  return (
    <ProfileSettingsLayout title="Security" breadcrumbLabel="Security">
      <div className="dsa-panel p-4 phone:p-5">
        <div className="border-b border-[var(--dsa-border)] pb-3">
          <p className="dsa-section-label">Account security</p>
          <h2 className="dsa-section-title mt-1">Change password</h2>
          <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
            Your current password is required. Successful changes revoke all active API sessions.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-[var(--dsa-radius-sm)] border border-[rgba(231,91,100,0.3)] bg-[rgba(231,91,100,0.08)] px-3 py-2 text-xs text-[var(--dsa-negative)]">
            {error}
          </div>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={submit}>
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            show={showCurrent}
            autoComplete="current-password"
            onChange={setCurrentPassword}
            onToggle={() => setShowCurrent((value) => !value)}
          />
          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            show={showNew}
            autoComplete="new-password"
            onChange={setNewPassword}
            onToggle={() => setShowNew((value) => !value)}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirmation}
            show={showConfirm}
            autoComplete="new-password"
            onChange={setConfirmation}
            onToggle={() => setShowConfirm((value) => !value)}
          />

          <div className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">
              Requirements
            </p>
            <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">
              At least 8 characters, including letters and numbers.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--dsa-border)] pt-4 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="dsa-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
            <Link href="/profile" className="dsa-button-secondary">
              Back to profile
            </Link>
          </div>
        </form>
      </div>
    </ProfileSettingsLayout>
  );
}
