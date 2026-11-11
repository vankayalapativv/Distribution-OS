import { describe, expect, it } from "vitest";
import { auditLogFilterOptions, listAuditLogsPaged } from "./audit-logs";
import { makeSql } from "../test/sql-mock";

const auditRow = {
  id: "a1",
  createdAt: new Date("2026-06-01T10:00:00Z"),
  actorUserId: "u1",
  actorName: "Admin",
  actorRole: "SUPER_ADMIN",
  action: "customer.update",
  entityType: "customer",
  entityId: "c1",
  entityLabel: "Ravi Motors",
  summary: "Changed address",
  metadata: { before: {} },
};

describe("listAuditLogsPaged", () => {
  it("maps rows and total, with no filters", async () => {
    const sql = makeSql({
      list_audit_logs_paged_count: [{ total: 1 }],
      list_audit_logs_paged: [
        auditRow,
        { ...auditRow, id: "a2", actorName: null, actorUserId: null, entityType: null, summary: null, metadata: null },
      ],
    });
    const res = await listAuditLogsPaged(sql, {});
    expect(res.total).toBe(1);
    expect(res.rows[0]).toMatchObject({ id: "a1", action: "customer.update", entityLabel: "Ravi Motors" });
    expect(res.rows[0].createdAt).toBe("2026-06-01T10:00:00.000Z");
    // A null actorName coerces to "" (str) and a null entityType to null (nullStr).
    expect(res.rows[1]).toMatchObject({ actorName: "", entityType: null, summary: "" });
    // No filters → no WHERE params were accumulated.
    const countCall = sql.calls.find((c) => c.tag === "list_audit_logs_paged_count")!;
    expect(countCall.params).toEqual([]);
  });

  it("accumulates every filter into the WHERE clause params", async () => {
    const sql = makeSql({ list_audit_logs_paged_count: [{ total: 0 }], list_audit_logs_paged: [] });
    await listAuditLogsPaged(sql, {
      actorId: "u1",
      entityType: "customer",
      action: "customer.update",
      fromDate: "2026-01-01",
      toDate: "2026-12-31",
      q: "ravi",
    });
    const countCall = sql.calls.find((c) => c.tag === "list_audit_logs_paged_count")!;
    // 5 scalar filters + 1 ilike term = 6 params.
    expect(countCall.params).toEqual(["u1", "customer", "customer.update", "2026-01-01", "2026-12-31", "%ravi%"]);
    expect(countCall.text).toMatch(/where/);
  });

  it("defaults a missing count to 0", async () => {
    const sql = makeSql({ list_audit_logs_paged_count: [], list_audit_logs_paged: [] });
    const res = await listAuditLogsPaged(sql, {});
    expect(res.total).toBe(0);
  });
});

describe("auditLogFilterOptions", () => {
  it("returns distinct actors / entity types / actions (blank values filtered)", async () => {
    const sql = makeSql({
      audit_filter_actors: [{ id: "u1", name: "Admin" }],
      audit_filter_entity_types: [{ value: "customer" }, { value: "" }],
      audit_filter_actions: [{ value: "customer.update" }, { value: "" }],
    });
    const opts = await auditLogFilterOptions(sql);
    expect(opts.actors).toEqual([{ id: "u1", name: "Admin" }]);
    expect(opts.entityTypes).toEqual(["customer"]);
    expect(opts.actions).toEqual(["customer.update"]);
  });
});
