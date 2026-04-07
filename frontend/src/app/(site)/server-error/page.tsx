import Link from "next/link";
import type { Metadata } from "next";
import { ErrorFallback, errorBtnGhost, errorBtnPrimary } from "@/src/components/errors/ErrorFallback";

export const metadata: Metadata = {
  title: "Server error",
  description: "Something went wrong on our side.",
};

/** Use as a manual fallback (e.g. redirect from middleware or after failed API bootstrap). Runtime errors use `app/error.tsx`. */
export default function ServerErrorPage() {
  return (
    <ErrorFallback
      code={500}
      title="Server error"
      description="Something went wrong while loading this page. Please try again in a moment."
      actions={
        <>
          <Link href="/" className={errorBtnPrimary}>
            Home
          </Link>
          <Link href="/search" className={errorBtnGhost}>
            Search
          </Link>
        </>
      }
    />
  );
}
