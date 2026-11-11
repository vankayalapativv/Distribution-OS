"use client";

import { useEffect, useState } from "react";
import type { ActionConfig } from "@/lib/api-client";

/** Fetches a collection's auth-gated payment proof as an object URL (bearer
 *  token → blob). Returns `{ src, failed }`; the URL is revoked on cleanup. */
export function useProofBlob(collectionId: string, actionConfig: ActionConfig) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetch(`${actionConfig.apiBaseUrl}/collections/${collectionId}/proof`, {
      headers: { Authorization: `Bearer ${actionConfig.authToken}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
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
  }, [collectionId, actionConfig]);

  return { src, failed };
}
