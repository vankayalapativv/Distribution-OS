import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

/** Sections that carry a "new since last seen" sidebar badge. */
export const SEEN_SECTIONS = new Set(["orders", "collections"]);

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullIso(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function assertSection(section: string): void {
  if (!SEEN_SECTIONS.has(section)) {
    throw new ApiError("INVALID_FIELD", "Unknown section.", 422);
  }
}

/**
 * Mark a section as seen for this user (bumps last_seen_at to now, clearing the
 * badge). Returns the PREVIOUS last_seen so the page can highlight the rows that
 * were new, plus the new "now" the caller uses as its in-page baseline.
 */
export async function markSectionSeen(
  sql: SqlClient,
  userId: string,
  section: string,
): Promise<{ previousSeenAt: string | null; now: string }> {
  assertSection(section);
  const [prev] = (await sql`
    /* section_seen_prev */
    select last_seen_at as "lastSeenAt" from section_seen
    where user_id = ${userId}::uuid and section = ${section}
  `) as { lastSeenAt: unknown }[];

  const [row] = (await sql`
    /* section_seen_mark */
    insert into section_seen (user_id, section, last_seen_at)
    values (${userId}::uuid, ${section}, now())
    on conflict (user_id, section) do update set last_seen_at = now()
    returning last_seen_at as "now"
  `) as { now: unknown }[];

  return { previousSeenAt: prev ? nullIso(prev.lastSeenAt) : null, now: str(row?.now) };
}

/** Count items in a section created strictly after `since` (in-page "N new" banner). */
export async function countSectionUpdates(
  sql: SqlClient,
  section: string,
  since: string,
): Promise<number> {
  assertSection(section);
  if (!since) return 0;
  const rows = (
    section === "orders"
      ? await sql`
          /* section_updates_count_orders */
          select count(*)::int as n from orders where created_at > ${since}::timestamptz
        `
      : await sql`
          /* section_updates_count_collections */
          select count(*)::int as n from collections where created_at > ${since}::timestamptz
        `
  ) as { n: number }[];
  const n = rows[0]?.n;
  return typeof n === "number" ? n : Number(n ?? 0);
}
