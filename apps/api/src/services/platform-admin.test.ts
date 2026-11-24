import { describe, it, expect } from "vitest";
import type { SqlClient } from "../lib/db";
import {
  approveEnterprise,
  inclusiveFromBase,
  rejectEnterprise,
  setEnterpriseEnforcement,
  setEnterpriseStatus,
  updateEnterpriseDuesBands,
  updateEnterpriseFreePeriod,
  updateEnterpriseInvoiceSeries,
  updateEnterprisePricing,
  updateEnterpriseProfile,
  updateEnterpriseSettings,
  upsertEnterpriseGodowns,
} from "./platform-admin";

/** stubSql variant that also answers `sql.transaction([...])` (resolves the batch).
 *  The tagged-template calls built inside the array still advance the result cursor. */
function stubSqlTx(results: unknown[][]): SqlClient {
  let i = 0;
  const fn = (() => Promise.resolve(results[i++] ?? [])) as unknown as SqlClient & {
    transaction: (q: unknown[]) => Promise<unknown>;
  };
  (fn as unknown as { transaction: (q: unknown[]) => Promise<unknown> }).transaction = (q) => Promise.resolve(q);
  return fn;
}

/**
 * Capturing tagged-template stub: records each query's leading SQL comment (the
 * `/* tag *\/`) so a test can assert which statements ran, and returns canned
 * result sets in order like stubSql.
 */
function capturingSql(results: unknown[][]): { sql: SqlClient; tags: string[] } {
  const tags: string[] = [];
  let i = 0;
  const sql = ((strings: TemplateStringsArray) => {
    const m = /\/\*\s*([a-z0-9_]+)\s*\*\//i.exec(strings[0] ?? "");
    tags.push(m ? m[1] : "");
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { sql, tags };
}

/**
 * Minimal tagged-template SqlClient stub: returns the next canned result set per
 * call, in order. updateEnterprisePricing (keep-existing-free path) issues four
 * queries — status SELECT, pricing UPDATE, the reprice-current-charge UPDATE, then
 * the final config SELECT — so pass `[statusRows, [], [], configRows]`.
 */
function stubSql(results: unknown[][]): SqlClient {
  let i = 0;
  return (() => Promise.resolve(results[i++] ?? [])) as unknown as SqlClient;
}

describe("updateEnterprisePricing", () => {
  const OK_STATUS = [{ status: "active" }];

  it("rejects an invalid model (422)", async () => {
    await expect(
      updateEnterprisePricing(stubSql([]), "owner-1", "ent-1", { model: "nope" as "flat", amountPaisa: 100 }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects a non-positive amount (422)", async () => {
    await expect(
      updateEnterprisePricing(stubSql([]), "owner-1", "ent-1", { model: "per_seat", amountPaisa: 0 }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("404 when the enterprise does not exist", async () => {
    await expect(
      updateEnterprisePricing(stubSql([[]]), "owner-1", "ent-1", { model: "per_seat", amountPaisa: 100 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("409 when the enterprise is not active (pending uses approve)", async () => {
    await expect(
      updateEnterprisePricing(stubSql([[{ status: "pending" }]]), "owner-1", "ent-1", {
        model: "per_seat",
        amountPaisa: 100,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("updates an active enterprise to a per-user price", async () => {
    const sql = stubSql([OK_STATUS, [], [], [{ model: "per_seat", unitAmountPaisa: 70800, flatAmountPaisa: null }]]);
    await expect(updateEnterprisePricing(sql, "owner-1", "ent-1", { model: "per_seat", amountPaisa: 70800 })).resolves.toEqual({
      model: "per_seat",
      unitAmountPaisa: 70800,
      flatAmountPaisa: null,
    });
  });

  it("switches an active enterprise to a flat price", async () => {
    const sql = stubSql([OK_STATUS, [], [], [{ model: "flat", unitAmountPaisa: null, flatAmountPaisa: 500000 }]]);
    await expect(updateEnterprisePricing(sql, "owner-1", "ent-1", { model: "flat", amountPaisa: 500000 })).resolves.toEqual({
      model: "flat",
      unitAmountPaisa: null,
      flatAmountPaisa: 500000,
    });
  });
});

describe("inclusiveFromBase", () => {
  it("adds 18% GST to a base and rounds (₹999 → ₹1,178.82)", () => {
    expect(inclusiveFromBase(99900, 1800)).toBe(117882);
  });
  it("clamps a negative base to 0", () => {
    expect(inclusiveFromBase(-500, 1800)).toBe(0);
  });
});

describe("updateEnterprisePricing re-prices the current charge (bug-2)", () => {
  it("runs the reprice UPDATE after the pricing write", async () => {
    const { sql, tags } = capturingSql([
      [{ status: "active", gstRateBp: 1800 }], // status/gst SELECT
      [], // platform_update_pricing_only
      [], // platform_reprice_current
      [{ model: "per_seat", unitAmountPaisa: 70800, flatAmountPaisa: null }], // final config SELECT
    ]);
    await updateEnterprisePricing(sql, "owner-1", "ent-1", { model: "per_seat", amountPaisa: 70800 });
    expect(tags).toContain("platform_update_pricing_only");
    expect(tags).toContain("platform_reprice_current");
    // the reprice must run after the config write
    expect(tags.indexOf("platform_reprice_current")).toBeGreaterThan(tags.indexOf("platform_update_pricing_only"));
  });
});

describe("setEnterpriseEnforcement", () => {
  it("404 when the enterprise does not exist", async () => {
    await expect(setEnterpriseEnforcement(stubSql([[]]), "owner-1", "ent-1", true)).rejects.toMatchObject({ status: 404 });
  });

  it("409 when the enterprise is not active", async () => {
    await expect(
      setEnterpriseEnforcement(stubSql([[{ status: "pending" }]]), "owner-1", "ent-1", true),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("turns enforcement on for an active enterprise", async () => {
    const sql = stubSql([[{ status: "active" }], [{ enforced: true }]]);
    await expect(setEnterpriseEnforcement(sql, "owner-1", "ent-1", true)).resolves.toEqual({ enforced: true });
  });

  it("turns enforcement off", async () => {
    const sql = stubSql([[{ status: "active" }], [{ enforced: false }]]);
    await expect(setEnterpriseEnforcement(sql, "owner-1", "ent-1", false)).resolves.toEqual({ enforced: false });
  });
});

describe("approveEnterprise", () => {
  it("rejects a bad model / non-positive base (422)", async () => {
    await expect(approveEnterprise(stubSqlTx([]), "o", "e", { model: "x" as "flat", amountPaisa: 100 })).rejects.toMatchObject({ status: 422 });
    await expect(approveEnterprise(stubSqlTx([]), "o", "e", { model: "flat", amountPaisa: 0 })).rejects.toMatchObject({ status: 422 });
  });
  it("404 when missing, 409 when already active", async () => {
    await expect(approveEnterprise(stubSqlTx([[]]), "o", "e", { model: "flat", amountPaisa: 100 })).rejects.toMatchObject({ status: 404 });
    await expect(approveEnterprise(stubSqlTx([[{ status: "active" }]]), "o", "e", { model: "flat", amountPaisa: 100 })).rejects.toMatchObject({ status: 409 });
  });
  it("approves a pending enterprise (writes config + seeds the month in one transaction)", async () => {
    // status SELECT, then the 3 transaction statements.
    const sql = stubSqlTx([[{ status: "pending" }], [], [], []]);
    await expect(approveEnterprise(sql, "owner-1", "ent-1", { model: "per_seat", amountPaisa: 70800, freeMonths: 1 })).resolves.toEqual({ status: "active" });
  });
});

describe("rejectEnterprise", () => {
  it("422 on a blank reason", async () => {
    await expect(rejectEnterprise(stubSql([]), "o", "e", "  ")).rejects.toMatchObject({ status: 422 });
  });
  it("404 when the enterprise does not exist", async () => {
    await expect(rejectEnterprise(stubSql([[]]), "o", "e", "needs GST")).rejects.toMatchObject({ status: 404 });
  });
  it("rejects with a reason", async () => {
    const sql = stubSql([[{ status: "pending" }], []]);
    await expect(rejectEnterprise(sql, "o", "e", "needs GST")).resolves.toEqual({ status: "rejected" });
  });
});

describe("setEnterpriseStatus", () => {
  it("404 when missing", async () => {
    await expect(setEnterpriseStatus(stubSql([[]]), "o", "e", "suspend")).rejects.toMatchObject({ status: 404 });
  });
  it("suspends an active enterprise; 409 if not active", async () => {
    await expect(setEnterpriseStatus(stubSql([[{ status: "active" }], []]), "o", "e", "suspend")).resolves.toEqual({ status: "suspended" });
    await expect(setEnterpriseStatus(stubSql([[{ status: "suspended" }]]), "o", "e", "suspend")).rejects.toMatchObject({ status: 409 });
  });
  it("reactivates a suspended enterprise; 409 if not suspended", async () => {
    await expect(setEnterpriseStatus(stubSql([[{ status: "suspended" }], []]), "o", "e", "reactivate")).resolves.toEqual({ status: "active" });
    await expect(setEnterpriseStatus(stubSql([[{ status: "active" }]]), "o", "e", "reactivate")).rejects.toMatchObject({ status: 409 });
  });
});

describe("updateEnterpriseProfile", () => {
  it("404 when missing", async () => {
    await expect(updateEnterpriseProfile(stubSql([[]]), "o", "e", { name: "X" })).rejects.toMatchObject({ status: 404 });
  });
  it("422 when name is explicitly blanked", async () => {
    await expect(updateEnterpriseProfile(stubSql([[{ id: "e" }]]), "o", "e", { name: "   " })).rejects.toMatchObject({ status: 422 });
  });
  it("updates only the provided fields", async () => {
    const sql = stubSql([[{ id: "e" }], []]);
    await expect(updateEnterpriseProfile(sql, "o", "e", { addressCity: "Warangal" })).resolves.toEqual({ updated: true });
  });
});

describe("updateEnterpriseFreePeriod", () => {
  it("404 when missing, 409 when not active", async () => {
    await expect(updateEnterpriseFreePeriod(stubSql([[]]), "o", "e", { freeMonths: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(updateEnterpriseFreePeriod(stubSql([[{ status: "pending" }]]), "o", "e", { freeMonths: 1 })).rejects.toMatchObject({ status: 409 });
  });
  it("sets the free period and reprices (status SELECT, update, reprice, read-back)", async () => {
    const sql = stubSql([[{ status: "active" }], [], [], [{ freeForever: true, freeUntil: null }]]);
    await expect(updateEnterpriseFreePeriod(sql, "owner-1", "ent-1", { freeForever: true })).resolves.toEqual({ freeForever: true, freeUntil: null });
  });
});

describe("updateEnterpriseSettings", () => {
  it("404 when missing", async () => {
    await expect(updateEnterpriseSettings(stubSql([[]]), "o", "e", { company_bank_name: "X" })).rejects.toMatchObject({ status: 404 });
  });
  it("drops unknown keys (no write when nothing is whitelisted)", async () => {
    // Only the existence SELECT runs; no insert needed.
    await expect(updateEnterpriseSettings(stubSql([[{ id: "e" }]]), "o", "e", { bogus: "x" })).resolves.toEqual({ updated: true });
  });
  it("upserts whitelisted settings", async () => {
    const sql = stubSql([[{ id: "e" }], []]);
    await expect(updateEnterpriseSettings(sql, "o", "e", { company_bank_name: "HDFC", bogus: "nope" })).resolves.toEqual({ updated: true });
  });
});

describe("updateEnterpriseInvoiceSeries", () => {
  it("422 on blank prefix / financial year", async () => {
    await expect(updateEnterpriseInvoiceSeries(stubSql([]), "o", "e", { prefix: "", finYear: "2026-27" })).rejects.toMatchObject({ status: 422 });
  });
  it("404 when the enterprise or series is missing", async () => {
    await expect(updateEnterpriseInvoiceSeries(stubSql([[]]), "o", "e", { prefix: "INV", finYear: "2026-27" })).rejects.toMatchObject({ status: 404 });
    await expect(updateEnterpriseInvoiceSeries(stubSql([[{ id: "e" }], []]), "o", "e", { prefix: "INV", finYear: "2026-27" })).rejects.toMatchObject({ status: 404 });
  });
  it("updates prefix + financial year", async () => {
    const sql = stubSql([[{ id: "e" }], [{ id: "s" }]]);
    await expect(updateEnterpriseInvoiceSeries(sql, "o", "e", { prefix: "INV", finYear: "2026-27" })).resolves.toEqual({ updated: true });
  });
});

describe("upsertEnterpriseGodowns", () => {
  it("404 when missing", async () => {
    await expect(upsertEnterpriseGodowns(stubSqlTx([[]]), "o", "e", [])).rejects.toMatchObject({ status: 404 });
  });
  it("422 when a godown lacks name/state/state code", async () => {
    await expect(upsertEnterpriseGodowns(stubSqlTx([[{ id: "e" }]]), "o", "e", [{ name: "", state: "TG", stateCode: "36" }])).rejects.toMatchObject({ status: 422 });
  });
  it("edits an existing godown and adds a new one", async () => {
    // existence SELECT, then the two statements built for the transaction.
    const sql = stubSqlTx([[{ id: "e" }], [], []]);
    await expect(
      upsertEnterpriseGodowns(sql, "o", "e", [
        { id: "g1", name: "Main", state: "Telangana", stateCode: "36" },
        { name: "New Depot", state: "Andhra Pradesh", stateCode: "37" },
      ]),
    ).resolves.toEqual({ updated: true });
  });
});

describe("updateEnterpriseDuesBands", () => {
  it("404 when missing", async () => {
    await expect(updateEnterpriseDuesBands(stubSqlTx([[]]), "o", "e", [])).rejects.toMatchObject({ status: 404 });
  });
  it("422 unless exactly 4 bands", async () => {
    await expect(updateEnterpriseDuesBands(stubSqlTx([[{ id: "e" }]]), "o", "e", [{ fromDays: 0, toDays: 30, label: "A" }])).rejects.toMatchObject({ status: 422 });
  });
  it("updates all 4 bands", async () => {
    const sql = stubSqlTx([[{ id: "e" }], [], [], [], []]);
    const bands = [
      { fromDays: 0, toDays: 30, label: "0–30" },
      { fromDays: 30, toDays: 45, label: "30–45" },
      { fromDays: 45, toDays: 60, label: "45–60" },
      { fromDays: 60, toDays: null, label: "60+" },
    ];
    await expect(updateEnterpriseDuesBands(sql, "o", "e", bands)).resolves.toEqual({ updated: true });
  });
});
