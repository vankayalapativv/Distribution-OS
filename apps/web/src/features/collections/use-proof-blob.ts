"use client";

import { useEffect, useState } from "react";
import { apiDownload, type ActionConfig } from "@/lib/api-client";

/** Fetches a collection's auth-gated payment proof as an object URL (bearer
 *  token → blob). Returns `{ src, failed }`; the URL is revoked on cleanup. */
export function useProofBlob(collectionId: string, actionConfig: ActionConfig) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    // apiDownload carries the live token and refreshes it on a 401, so the proof
    // still loads on a long-open page past the ~15-min token TTL.
    void apiDownload(actionConfig, `/collections/${collectionId}/proof`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [collectionId, actionConfig]);

  return { src, failed };
}
