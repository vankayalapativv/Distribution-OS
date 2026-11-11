import { describe, expect, it } from "vitest";
import { runLocationNag } from "./location-nag";
import { makeSql } from "../test/sql-mock";

describe("runLocationNag", () => {
  it("no targets (null seId filtered) → no-op", async () => {
    const sql = makeSql({ find_location_off_sessions: [{ seId: null }] });
    expect(await runLocationNag(sql)).toEqual({ nagged: 0, pushes: [] });
  });
  it("nags on-duty SEs and groups push tokens", async () => {
    const sql = makeSql({
      find_location_off_sessions: [{ seId: "se-1" }],
      location_nag_push_tokens: [{ userId: "se-1", token: "tokA" }],
    });
    const out = await runLocationNag(sql, { now: "2026-06-01T09:00:00Z" });
    expect(out.nagged).toBe(1);
    expect(out.pushes[0].tokens).toEqual(["tokA"]);
  });
});
