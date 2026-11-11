"use client";

import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { reportWebError } from "@/lib/report-error";

/**
 * Root error boundary — catches uncaught render errors on non-dashboard routes
 * (e.g. /login, /status), so the visitor sees a recoverable branded screen
 * instead of the framework default. `reset()` re-renders the route.
 */
export default function RootError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error:", error);
    reportWebError(error, { boundary: "root", digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center text-foreground">
      <BrandWordmark />
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold">This page couldn&apos;t load</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. You can try again, or go back to the login page.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <a href="/login" className={buttonVariants({ variant: "outline" })}>
          Go to login
        </a>
      </div>
    </main>
  );
}
