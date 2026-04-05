import Link from "next/link";
import type { ReactNode } from "react";

export type ErrorFallbackProps = {
  code: number;
  title: string;
  description: string;
  /** If omitted, default Home + Search links are shown. */
  actions?: ReactNode;
};

export const errorBtnPrimary =
  "rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90";
export const errorBtnGhost =
  "rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10";

const btnPrimary = errorBtnPrimary;
const btnGhost = errorBtnGhost;

export function ErrorFallback({ code, title, description, actions }: ErrorFallbackProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p
        className="text-7xl font-black tabular-nums tracking-tight text-white/[0.12] sm:text-8xl"
        aria-hidden
      >
        {code}
      </p>
      <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {actions ?? (
          <>
            <Link href="/" className={errorBtnPrimary}>
              Home
            </Link>
            <Link href="/search" className={errorBtnGhost}>
              Search
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
