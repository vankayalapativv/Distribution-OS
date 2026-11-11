"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiRequest, type ActionConfig } from "@/lib/api-client";
import { refreshBadges } from "./badge-refresh";

interface SectionSeenResult {
  previousSeenAt: string | null;
  now: string;
}

export type SeenSection = "orders" | "collections";

/**
 * Drives the "new since you last looked" experience for the Orders/Collections
 * pages:
 *  - on open, marks the section seen (clears the sidebar badge) and captures the
 *    previous seen time so the page can highlight rows that are new to the user;
 *  - polls how many items have arrived since the page opened → the "N new" banner;
 *  - `acknowledge()` (banner click) re-marks seen, re-baselines, and shifts the
 *    highlight window so the freshly-loaded batch lights up.
 *
 * `highlightSince` is an ISO instant; a row is "new" when its `createdAt > highlightSince`.
 */
export function useSectionNotifications(actionConfig: ActionConfig, section: SeenSection) {
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [highlightSince, setHighlightSince] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<SectionSeenResult>(actionConfig, "POST", "/me/section-seen", { section })
      .then((res) => {
        if (cancelled) return;
        setHighlightSince(res.previousSeenAt);
        setOpenedAt(res.now);
        refreshBadges();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [actionConfig, section]);

  const { data } = useQuery({
    queryKey: ["section-updates", section, openedAt],
    enabled: !!openedAt,
    queryFn: async () => {
      const r = await apiGet<{ count: number }>(
        actionConfig,
        `/me/section-updates?section=${section}&since=${encodeURIComponent(openedAt!)}`,
      );
      return r.count;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  async function acknowledge() {
    const prevOpenedAt = openedAt;
    try {
      const res = await apiRequest<SectionSeenResult>(actionConfig, "POST", "/me/section-seen", {
        section,
      });
      setHighlightSince(prevOpenedAt); // rows since the last baseline are the new ones
      setOpenedAt(res.now);
      refreshBadges();
    } catch {
      // ignore — the list still refetches; the badge just clears on next poll
    }
  }

  return { newCount: data ?? 0, highlightSince, acknowledge };
}
