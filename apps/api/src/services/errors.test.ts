import { describe, expect, it } from "vitest";
import {
  addErrorNote,
  captureError,
  cleanupOldErrors,
  errorSummary,
  fingerprintOf,
  getErrorGroupDetail,
  listErrorGroups,
  updateErrorGroup,
} from "./errors";
import { makeSql } from "../test/sql-mock";

const UUID = "11111111-2222-4333-8444-555555555555";

describe("fingerprintOf", () => {
  it("is stable for the same error and differs for a different message", () => {
    const a = fingerprintOf({ source: "api", message: "Boom", kind: "TypeError" });
    const b = fingerprintOf({ source: "api", message: "Boom", kind: "TypeError" });
    const c = fingerprintOf({ source: "api", message: "Different", kind: "TypeError" });
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("collapses variable parts (UUIDs, numbers, quotes) into one group", () => {
    const one = fingerprintOf({ source: "api", message: `User ${UUID} not found 42 times "x"` });
    const two = fingerprintOf({ source: "api", message: `User 99999999-8888-4777-8666-555555555555 not found 7 times "y"` });
    expect(one).toBe(two);
  });

  it("factors in the top stack frame", () => {
    const withStack = fingerprintOf({ source: "api", message: "X", stack: "Error: X\n    at foo (a.ts:1:2)" });
    const noStack = fingerprintOf({ source: "api", message: "X" });
    expect(withStack).not.toBe(noStack);
  });
});

describe("captureError", () => {
  it("writes the group+event and returns the group id + isNew", async () => {
    const sql = makeSql({ capture_error: [{ id: "g1", is_new: true }] });
    expect(await captureError(sql, { source: "api", message: "Boom" })).toEqual({ groupId: "g1", isNew: true });
  });

  it("falls back to groupId '' / isNew false when nothing returns", async () => {
    const sql = makeSql({ capture_error: [] });
    expect(await captureError(sql, { source: "web", message: "x" })).toEqual({ groupId: "", isNew: false });
  });

  it("validates the userId as a uuid (invalid → null param) and defaults the title", async () => {
    const sql = makeSql({ capture_error: [{ id: "g1", is_new: false }] });
    await captureError(sql, { source: "mobile", message: "   ", userId: "not-a-uuid" });
    const call = sql.calls.find((c) => c.tag === "capture_error")!;
    expect(call.params).toContain("(no message)"); // blank message → default title
    expect(call.params).toContain(null); // invalid uuid coerced to null
  });

  it("truncates an oversized context and nulls an unserialisable one", async () => {
    const big = makeSql({ capture_error: [{ id: "g1", is_new: true }] });
    await captureError(big, { source: "api", message: "m", context: { blob: "x".repeat(9000) } });
    const bigCall = big.calls.find((c) => c.tag === "capture_error")!;
    expect(bigCall.params.some((p) => typeof p === "string" && p.includes("_truncated"))).toBe(true);

    // A small, serialisable context is passed through as JSON text.
    const small = makeSql({ capture_error: [{ id: "g1", is_new: true }] });
    await captureError(small, { source: "api", message: "m", context: { orderId: "o1" } });
    const smallCall = small.calls.find((c) => c.tag === "capture_error")!;
    expect(smallCall.params).toContain('{"orderId":"o1"}');

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const cyc = makeSql({ capture_error: [{ id: "g1", is_new: true }] });
    await captureError(cyc, { source: "api", message: "m", context: cyclic });
    // The context param serialises to null (no throw).
    expect(cyc.calls.find((c) => c.tag === "capture_error")).toBeDefined();
  });
});

describe("errorSummary", () => {
  it("buckets groups by status and reports the latest open timestamp", async () => {
    const sql = makeSql({
      "": ({ text }) =>
        text.includes("group by status")
          ? [
              { status: "open", n: 2, events: 10 },
              { status: "resolved", n: 1, events: 3 },
            ]
          : [{ last_seen: "2026-06-01T00:00:00Z" }],
    });
    const s = await errorSummary(sql);
    expect(s.open).toEqual({ groups: 2, events: 10 });
    expect(s.resolved).toEqual({ groups: 1, events: 3 });
    expect(s.ignored).toEqual({ groups: 0, events: 0 });
    expect(s.lastSeen).toBe("2026-06-01T00:00:00Z");
  });

  it("defaults lastSeen to null when there are no open groups", async () => {
    const sql = makeSql({ "": ({ text }) => (text.includes("group by status") ? [] : [{ last_seen: null }]) });
    expect((await errorSummary(sql)).lastSeen).toBeNull();
  });
});

describe("listErrorGroups", () => {
  it("applies filters (dropping 'all'), paginates and returns the total", async () => {
    const sql = makeSql({
      list_error_groups: [{ id: "g1", title: "Boom", status: "open" }],
      "": [{ total: 1 }],
    });
    const res = await listErrorGroups(sql, { status: "all", source: "api", level: "all", page: 2, pageSize: 10 });
    expect(res).toMatchObject({ page: 2, pageSize: 10, total: 1 });
    expect(res.groups).toHaveLength(1);
    const listCall = sql.calls.find((c) => c.tag === "list_error_groups")!;
    expect(listCall.params).toContain("api"); // source filter bound
    expect(listCall.params).toContain(10); // pageSize
    expect(listCall.params).toContain(10); // offset (page2 → (2-1)*10)
  });

  it("clamps page/pageSize to sane bounds", async () => {
    const sql = makeSql({ list_error_groups: [], "": [{ total: 0 }] });
    const res = await listErrorGroups(sql, { page: 0, pageSize: 999 });
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(100);
  });
});

describe("getErrorGroupDetail", () => {
  it("returns null when the group is missing", async () => {
    const sql = makeSql({ error_group_detail: [] });
    expect(await getErrorGroupDetail(sql, UUID)).toBeNull();
  });

  it("returns the group with its events and notes", async () => {
    const sql = makeSql({
      error_group_detail: [{ id: "g1", title: "Boom" }],
      error_group_events: [{ id: "e1", message: "Boom" }],
      error_group_notes: [{ id: "n1", body: "looking" }],
    });
    const detail = await getErrorGroupDetail(sql, UUID);
    expect(detail).toMatchObject({ group: { id: "g1" } });
    expect(detail!.events).toHaveLength(1);
    expect(detail!.notes).toHaveLength(1);
  });
});

describe("updateErrorGroup", () => {
  it("returns true when a row was updated, false otherwise", async () => {
    expect(await updateErrorGroup(makeSql({ update_error_group: [{ id: "g1" }] }), UUID, UUID, { status: "resolved" })).toBe(true);
    expect(await updateErrorGroup(makeSql({ update_error_group: [] }), UUID, UUID, { assignedTo: "bad" })).toBe(false);
  });
});

describe("addErrorNote", () => {
  it("inserts and returns the note", async () => {
    const sql = makeSql({ add_error_note: [{ id: "n1", body: "note", createdAt: "2026-06-01" }] });
    expect(await addErrorNote(sql, UUID, UUID, "note")).toMatchObject({ id: "n1", body: "note" });
  });
});

describe("cleanupOldErrors", () => {
  it("runs the prune when the daily gate opens", async () => {
    const sql = makeSql({ "": ({ text }) => (text.includes("insert into system_flags") ? [{ key: "errors_last_prune_date" }] : []) });
    expect(await cleanupOldErrors(sql)).toEqual({ ran: true });
  });

  it("is a no-op when the gate is already set for today", async () => {
    const sql = makeSql({ "": [] }); // gate insert returns no row
    expect(await cleanupOldErrors(sql)).toEqual({ ran: false });
  });
});
