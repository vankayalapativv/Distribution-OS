/**
 * SE oil-litres leaderboard — pure ranking logic (the network fetch lives in the
 * screen so this stays RN-free and unit-testable). Ranks every active SE by total
 * oil litres for the selected period; matches the Home "My performance" litres.
 */
export type LeaderPeriod = "today" | "week" | "month";

/** One SE's litres across the three periods (from GET /leaderboard). */
export interface LeaderboardRow {
  userId: string;
  name: string;
  today: number;
  week: number;
  month: number;
}

export interface RankedRow {
  rank: number;
  userId: string;
  name: string;
  litres: number;
  isMe: boolean;
}

/**
 * Rows for one period: drop zero-sale SEs, sort by litres desc (ties broken by
 * name), number the ranks 1..n, and flag the viewer's own row.
 */
export function rankByPeriod(
  rows: LeaderboardRow[],
  period: LeaderPeriod,
  myId: string | null,
): RankedRow[] {
  return rows
    .map((r) => ({ userId: r.userId, name: r.name, litres: r[period] }))
    .filter((r) => r.litres > 0)
    .sort((a, b) => b.litres - a.litres || a.name.localeCompare(b.name))
    .map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.name,
      litres: r.litres,
      isMe: r.userId === myId,
    }));
}
