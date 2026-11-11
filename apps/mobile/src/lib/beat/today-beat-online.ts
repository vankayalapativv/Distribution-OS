/**
 * Online-only fetch of today's beat plan for the SE. No SQLite, no offline
 * cache — matches the recent online-only screen rewrites. Mirrors the
 * GET /beats/today contract exactly.
 */
import { apiFetch } from "../api";
import { cacheKeys } from "../cache-keys";
import type { DuesBucket } from "../dues-bucket";
import { cachedFetch } from "../read-cache";

export interface BeatStop {
  stopId: string;
  sequenceNo: number;
  /** "pending" | "checked_in" | "completed" */
  stopStatus: string;
  customerId: string;
  customerCode: string;
  legalName: string;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  /** This customer's total collection due (₹); 0 when they owe nothing. */
  outstanding: number;
  /** Ageing bucket of the oldest unpaid invoice; null when nothing is due. */
  dueBucket: DuesBucket | null;
}

export interface TodayBeat {
  beatPlanId: string | null;
  planDate: string | null;
  planStatus: string | null;
  stops: BeatStop[];
}

/** Fetch today's beat. Read-through cached so the Home beat card survives offline
 *  from the last sync. Empty stops on Sunday / no beat. */
export async function fetchTodayBeat(token: string | null): Promise<TodayBeat> {
  const r = await cachedFetch(cacheKeys.beatToday, () =>
    apiFetch<TodayBeat>("/beats/today", { token }),
  );
  return r.data;
}
