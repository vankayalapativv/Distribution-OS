import { describe, expect, it } from "vitest";
import { rankByPeriod, type LeaderboardRow } from "./leaderboard";

const rows: LeaderboardRow[] = [
  { userId: "a", name: "Anil", today: 0, week: 50, month: 200 },
  { userId: "b", name: "Bala", today: 10, week: 120, month: 120 },
  { userId: "c", name: "Chan", today: 10, week: 0, month: 300 },
];

describe("rankByPeriod", () => {
  it("drops zero-sale SEs, sorts by litres desc, ranks, flags the viewer", () => {
    const out = rankByPeriod(rows, "week", "b");
    expect(out).toEqual([
      { rank: 1, userId: "b", name: "Bala", litres: 120, isMe: true },
      { rank: 2, userId: "a", name: "Anil", litres: 50, isMe: false },
    ]);
    // Chan has 0 litres this week → excluded.
  });

  it("breaks litre ties by name and keeps rank order", () => {
    const out = rankByPeriod(rows, "today", null); // Anil=0 excluded; Bala=10, Chan=10
    expect(out.map((r) => r.name)).toEqual(["Bala", "Chan"]);
    expect(out.map((r) => r.rank)).toEqual([1, 2]);
    expect(out.every((r) => !r.isMe)).toBe(true);
  });
});
