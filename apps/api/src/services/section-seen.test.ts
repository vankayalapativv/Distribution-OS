import { describe, expect, it } from "vitest";
import { countSectionUpdates, markSectionSeen } from "./section-seen";
import { makeSql } from "../test/sql-mock";

describe("section-seen", () => {
  it("markSectionSeen returns previous + now (null now → '')", async () => {
    const sql = makeSql({ section_seen_prev: [{ lastSeenAt: "2026-06-01T00:00:00Z" }], section_seen_mark: [{ now: null }] });
    expect(await markSectionSeen(sql, "u1", "orders")).toEqual({ previousSeenAt: "2026-06-01T00:00:00Z", now: "" });
  });
  it("rejects an unknown section", async () => {
    await expect(markSectionSeen(makeSql(), "u1", "bogus")).rejects.toMatchObject({ status: 422 });
  });
  it("countSectionUpdates: 0 when no since, else the count", async () => {
    expect(await countSectionUpdates(makeSql(), "orders", "")).toBe(0);
    expect(await countSectionUpdates(makeSql({ section_updates_count_collections: [{ n: 4 }] }), "collections", "2026-06-01")).toBe(4);
  });
});
