"use client";

import { useEffect, useState } from "react";
import type { ActionConfig } from "@/lib/api-client";

// Fixed locale + timezone so server and client render identical text (hydration).
export const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export const DATETIME_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/** Renders a protected photo by fetching it with the auth header. */
export function AuthImage({
  photoId,
  config,
  className,
  onClick,
}: {
  readonly photoId: string;
  readonly config: ActionConfig;
  readonly className?: string;
  readonly onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetch(`${config.apiBaseUrl}/photos/${photoId}`, {
      headers: { Authorization: `Bearer ${config.authToken}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      // Swallow network failures so they don't surface as an unhandled rejection;
      // the tile stays in its placeholder (same as a non-ok response).
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, config]);

  if (!src) {
    return <div className={`animate-pulse bg-slate-200 ${className ?? ""}`} />;
  }
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="Market intelligence" className={className} onClick={onClick}
    role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined} />;
}
