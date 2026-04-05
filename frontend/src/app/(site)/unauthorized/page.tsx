import Link from "next/link";
import type { Metadata } from "next";
import { ErrorFallback, errorBtnGhost, errorBtnPrimary } from "@/src/components/errors/ErrorFallback";

export const metadata: Metadata = {
  title: "Unauthorized",
  description: "Sign in to continue.",
};

export default function UnauthorizedPage() {
  return (
    <ErrorFallback
      code={401}
      title="Sign in required"
      description="You need to be signed in to view this page. Log in with your account to continue."
      actions={
        <>
          <Link href="/auth/login" className={errorBtnPrimary}>
            Sign in
          </Link>
          <Link href="/" className={errorBtnGhost}>
            Home
          </Link>
        </>
      }
    />
  );
}
