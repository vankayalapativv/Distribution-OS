import { describe, expect, it, vi } from "vitest";
import { actorOf, logAudit } from "./audit";
import { makeSql, calledTag } from "../test/sql-mock";

describe("audit", () => {
  it("actorOf lifts the auth fields", () => {
    expect(actorOf({ userId: "u1", email: "a@b.c", role: "MANAGER" } as never)).toEqual({ userId: "u1", email: "a@b.c", role: "MANAGER" });
  });

  it("logAudit writes an entry (null actor tolerated)", async () => {
    const sql = makeSql({ insert_audit_log: [] });
    await logAudit(sql, { userId: null, email: null, role: null }, { action: "x.y", summary: "s" });
    expect(calledTag(sql, "insert_audit_log")).toBe(true);
  });

  it("logAudit swallows a DB failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sql = makeSql({ insert_audit_log: () => { throw new Error("db down"); } });
    await expect(logAudit(sql, { userId: "u1", email: "a@b.c", role: "MANAGER" }, { action: "x.y", summary: "s", metadata: { k: 1 } })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
