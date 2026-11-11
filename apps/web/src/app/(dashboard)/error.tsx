"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { reportWebError } from "@/lib/report-error";

/**
 * Segment-level error boundary for every /dashboard/* route. Catches errors thrown
 * while rendering a dashboard page (server or client) so the user sees a recoverable
 * screen instead of the framework's default error page. `reset()` re-renders the segment.
 */
export default function DashboardError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; the server also logs the original throw.
    console.error("[dashboard] render error:", error);
    reportWebError(error, { boundary: "dashboard", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center text-foreground">
      <BrandWordmark />
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold">This page couldn&apos;t load</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred while loading this screen. You can try again, or head back to
          your dashboard.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
