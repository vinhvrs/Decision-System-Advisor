"use client";

import Link from "next/link";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Shown when paper trading / positions require a signed-in user. */
export default function TradingSignInPrompt({ className = "", compact = false }: Props) {
  return (
    <div
      className={`rounded-lg border border-[#2b3139] bg-[#1e2329]/90 px-3 py-2.5 text-xs text-[#848e9c] ${className}`}
    >
      {compact ? (
        <p>
          <Link href="/auth/login" className="font-semibold text-[#7b9cff] hover:underline">
            Sign in
          </Link>{" "}
          to trade and manage positions.
        </p>
      ) : (
        <>
          <p className="font-semibold text-white">Paper trading requires an account</p>
          <p className="mt-1 leading-relaxed">
            Buy, sell, close, and sync open positions are only available when you are logged in.
          </p>
          <Link
            href="/auth/login"
            className="mt-2 inline-block rounded-md bg-[#3861fb] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#3861fb]/90"
          >
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}
