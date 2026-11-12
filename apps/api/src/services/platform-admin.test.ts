import { describe, it, expect } from "vitest";
import type { SqlClient } from "../lib/db";
import { updateEnterprisePricing } from "./platform-admin";

/**
 * Minimal tagged-template SqlClient stub: returns the next canned result set per
 * call, in order. updateEnterprisePricing issues two queries — the status SELECT,
 * then the config upsert — so pass `[statusRows, upsertRows]`.
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
    const sql = stubSql([OK_STATUS, [{ model: "per_seat", unitAmountPaisa: 70800, flatAmountPaisa: null }]]);
    await expect(updateEnterprisePricing(sql, "owner-1", "ent-1", { model: "per_seat", amountPaisa: 70800 })).resolves.toEqual({
      model: "per_seat",
      unitAmountPaisa: 70800,
      flatAmountPaisa: null,
    });
  });

  it("switches an active enterprise to a flat price", async () => {
    const sql = stubSql([OK_STATUS, [{ model: "flat", unitAmountPaisa: null, flatAmountPaisa: 500000 }]]);
    await expect(updateEnterprisePricing(sql, "owner-1", "ent-1", { model: "flat", amountPaisa: 500000 })).resolves.toEqual({
      model: "flat",
      unitAmountPaisa: null,
      flatAmountPaisa: 500000,
    });
  });
});
