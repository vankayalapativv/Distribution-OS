"use client";

import { useEffect, useState } from "react";
import type { ActionConfig } from "@/lib/api-client";

/** `01:05 am` IST time (Asia/Kolkata) for a delivery timestamp, or "". */
export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "";
  }
}

/** Downloads an R2 delivery photo (bearer-auth fetch → blob → anchor click). */
export async function downloadPhoto(config: ActionConfig, photoId: string, filename: string) {
  const res = await fetch(`${config.apiBaseUrl}/logistics/photos/${photoId}`, {
    headers: { Authorization: `Bearer ${config.authToken}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Fetches an R2 photo with the bearer token and shows it via an object URL. */
export function AuthImage({
  config,
  photoId,
  className,
  onClick,
}: {
  readonly config: ActionConfig;
  readonly photoId: string;
  readonly className?: string;
  readonly onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetch(`${config.apiBaseUrl}/logistics/photos/${photoId}`, {
      headers: { Authorization: `Bearer ${config.authToken}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [config, photoId]);
  if (!src) return <div className={`animate-pulse bg-slate-200 ${className ?? ""}`} />;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="Delivery proof" className={className} onClick={onClick}
    role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined} />;
}

/** Small "▦ n" pill showing a proof-photo count. */
export const PhotoCountBadge = ({ n }: { readonly n: number }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
    ▦ {n}
  </span>
);
