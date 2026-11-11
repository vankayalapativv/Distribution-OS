"use client";

import { useEffect, useState } from "react";
import type { ActionConfig } from "@/lib/api-client";

/** Fetch an entry's auth-protected bill as an object URL (image or PDF). */
export function useBillBlob(actionConfig: ActionConfig, entryId: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset synchronously when the entry changes (render-time "adjust on change"
  // pattern) so the effect body holds only the async fetch — no cascading render.
  const [prevId, setPrevId] = useState(entryId);
  if (entryId !== prevId) {
    setPrevId(entryId);
    setSrc(null);
    setIsPdf(false);
    setFailed(false);
  }

  useEffect(() => {
    if (!entryId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetch(`${actionConfig.apiBaseUrl}/expenditures/${entryId}/bill`, {
      headers: { Authorization: `Bearer ${actionConfig.authToken}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setIsPdf(blob.type === "application/pdf");
          setSrc(objectUrl);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entryId, actionConfig]);

  return { src, isPdf, failed };
}
