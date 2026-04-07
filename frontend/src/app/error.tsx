"use client";

import { useEffect } from "react";
import Link from "next/link";
import Footer from "@/src/components/footer/page";
import Header from "@/src/components/header/page";
import { ErrorFallback, errorBtnGhost, errorBtnPrimary } from "@/src/components/errors/ErrorFallback";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <header className="sticky top-0 z-50 mb-0">
        <Header />
      </header>
      <main className="min-h-[55vh] px-4 py-6 phone:px-5 tablet:px-6 tablet:py-8">
        <ErrorFallback
          code={500}
          title="Something went wrong"
          description="An unexpected error occurred. You can retry or return to the home page. If this keeps happening, try again later."
          actions={
            <>
              <button type="button" onClick={() => reset()} className={errorBtnPrimary}>
                Try again
              </button>
              <Link href="/" className={errorBtnGhost}>
                Home
              </Link>
            </>
          }
        />
      </main>
      <Footer />
    </>
  );
}
