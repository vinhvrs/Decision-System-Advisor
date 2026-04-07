import Link from "next/link";
import type { Metadata } from "next";
import { ErrorFallback, errorBtnGhost, errorBtnPrimary } from "@/src/components/errors/ErrorFallback";

export const metadata: Metadata = {
  title: "Forbidden",
  description: "You don’t have access to this resource.",
};

export default function ForbiddenPage() {
  return (
    <ErrorFallback
      code={403}
      title="Access denied"
      description="You don’t have permission to view this page or resource. If you think this is a mistake, contact support or return to the home page."
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
