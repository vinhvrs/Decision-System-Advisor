"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorFallback, errorBtnGhost, errorBtnPrimary } from "@/src/components/errors/ErrorFallback";

export default function GlobalError({
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
    <html lang="en">
      <body className="bg-[#0B1220] text-[#E5E7EB]">
        <ErrorFallback
          code={500}
          title="Application error"
          description="The app failed to load. Please try again or refresh the page."
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
      </body>
    </html>
  );
}
