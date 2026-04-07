"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export type CornerNoticeVariant = "success" | "error" | "info";

type CornerNoticeProps = {
  message: string;
  variant: CornerNoticeVariant;
  onDismiss: () => void;
};

export function CornerNotice({ message, variant, onDismiss }: CornerNoticeProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 5200);
    return () => window.clearTimeout(id);
  }, [message, variant, onDismiss]);

  const surface =
    variant === "success"
      ? "border-emerald-500/45 bg-emerald-950/92 text-emerald-50"
      : variant === "error"
        ? "border-red-500/45 bg-red-950/92 text-red-50"
        : "border-slate-500/40 bg-slate-900/95 text-slate-100";

  return (
    <div
      className={`fixed bottom-5 right-5 z-[200] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md ${surface}`}
      role="status"
    >
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
