/**
 * Shared, de-duplicated fetch for `/api/badge-counts`.
 *
 * Two islands poll these counts — the sidebar badges (every 60s) and the sound
 * notifier (every 20s) — and both fire on page load. Routing every caller through
 * this one function means concurrent calls (notably both firing at mount) share a
 * SINGLE in-flight network request instead of hitting the endpoint twice. There's
 * no caching beyond the in-flight window, so each poll still gets fresh counts.
 */
export interface BadgeCountsPayload {
  tasksActive: number;
  alertsOpen: number;
  ordersNew: number;
  collectionsNew: number;
  visitsNew: number;
  latestCollection: { amount: number; customer: string; executive: string | null } | null;
  latestOrder: { value: number; customer: string; executive: string | null } | null;
  latestVisit: { customer: string; executive: string | null } | null;
}

const EMPTY: BadgeCountsPayload = {
  tasksActive: 0,
  alertsOpen: 0,
  ordersNew: 0,
  collectionsNew: 0,
  visitsNew: 0,
  latestCollection: null,
  latestOrder: null,
  latestVisit: null,
};

let inFlight: Promise<BadgeCountsPayload> | null = null;

export async function fetchBadgeCounts(): Promise<BadgeCountsPayload> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/badge-counts", { cache: "no-store" });
      if (!res.ok) return EMPTY;
      return { ...EMPTY, ...((await res.json()) as Partial<BadgeCountsPayload>) };
    } catch {
      return EMPTY;
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
