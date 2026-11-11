"use client";

/**
 * Inline fetch-error card for the Reports page. Keeps the page chrome; surfaces
 * a specific message (offline / session-expired / server) instead of a generic
 * one, plus a Retry. `isAuthError` also gates query retries (never retry 4xx).
 */
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function isAuthError(error: unknown): boolean {
  const m = (error instanceof Error ? error.message : "").toLowerCase();
  return (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("login") ||
    m.includes("unauthor") ||
    m.includes("forbidden") ||
    m.includes("role")
  );
}

function isOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = (error instanceof Error ? error.message : "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed");
}

function describe(error: unknown): { title: string; message: string; offline: boolean } {
  if (isOffline(error)) {
    return {
      title: "You're offline",
      message: "Check your internet connection and try again.",
      offline: true,
    };
  }
  if (isAuthError(error)) {
    return {
      title: "Session expired",
      message: "Your session may have ended. Refresh the page or sign in again.",
      offline: false,
    };
  }
  return {
    title: "Couldn't load reports",
    message:
      error instanceof Error && error.message
        ? error.message
        : "The server didn't respond. Please try again.",
    offline: false,
  };
}

export function ReportsError({
  error,
  onRetry,
  retrying,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly retrying?: boolean;
}) {
  const { title, message, offline } = describe(error);
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {offline ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={`mr-1.5 size-4 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
