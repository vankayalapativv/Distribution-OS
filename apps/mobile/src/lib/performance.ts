/**
 * SE performance (actual vs target) for the Home screen card.
 * Online-only from GET /targets/me — returns null when the fetch fails.
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { cacheKeys } from "./cache-keys";
import { cachedFetch } from "./read-cache";

export const OIL_SEGMENTS = [
  "Car",
  "2W",
  "3W",
  "Commercial",
  "Agri",
  "Gear Oil",
  "Coolant",
  "Grease",
] as const;

export interface SegmentLitres {
  segment: string;
  litres: number;
}

/** ₹ the SE collected in a period; `verified` = accountant-approved subset. */
export interface CollectionActual {
  total: number;
  verified: number;
}

export interface PeriodProgress {
  periodStart: string;
  oilActual: SegmentLitres[];
  oilTarget: SegmentLitres[] | null;
  collections: CollectionActual;
}

export interface MyPerformance {
  today: {
    date: string;
    oilActual: SegmentLitres[];
    collections: CollectionActual;
  };
  week: PeriodProgress;
  month: PeriodProgress;
}

/** Sum litres across the segment array (overall oil figure). */
export function sumLitres(segments: SegmentLitres[] | null | undefined): number {
  if (!Array.isArray(segments)) return 0;
  return segments.reduce((acc, s) => acc + (s?.litres ?? 0), 0);
}

/** One segment's litres from an array, default 0. */
export function segLitres(
  segments: SegmentLitres[] | null | undefined,
  segment: string,
): number {
  if (!Array.isArray(segments)) return 0;
  return segments.find((s) => s.segment === segment)?.litres ?? 0;
}

export async function fetchMyPerformance(): Promise<MyPerformance | null> {
  const token = useAuth.getState().token;
  try {
    // Read-through cache: serves the last-synced figures offline; null only when
    // the fetch fails AND there is no cache (card then stays hidden).
    const r = await cachedFetch(cacheKeys.performance, () =>
      apiFetch<MyPerformance>("/targets/me", { token }),
    );
    return r.data;
  } catch {
    return null;
  }
}
