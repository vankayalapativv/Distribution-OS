import { describe, expect, it } from "vitest";
import { makeSql, calledTag, type Row } from "../test/sql-mock";
import { checkReorder, keysForInvoice, superAdminPushTokens, type ReorderKey } from "./stock-reorder";

const KEY: ReorderKey = { locationId: "loc-1", productId: "prod-1", packSizeLitres: 205 };

/** One `reorder_scan` row with sensible defaults (Neon returns numerics as strings). */
function scanRow(over: Partial<Row> = {}): Row {
  return {
    locationId: "loc-1",
    productId: "prod-1",
    packSizeLitres: "205",
    qtyUnits: "3",
    reorderLevel: "5",
    productName: "Fricofin LL",
    locationName: "Bachupally",
    openAlertId: null,
    ...over,
  };
}

describe("checkReorder", () => {
  it("returns [] and runs no query for an empty key list", async () => {
    const sql = makeSql();
    expect(await checkReorder(sql, [])).toEqual([]);
    expect(sql.calls).toHaveLength(0);
  });

  it("de-duplicates repeated keys before scanning", async () => {
    const sql = makeSql({ reorder_scan: [] });
    await checkReorder(sql, [KEY, { ...KEY }, { ...KEY }]);
    const scan = sql.calls.find((c) => c.tag === "reorder_scan");
    // unnest arrays are the 1st/2nd/3rd params — each collapsed to a single element.
    const locIds = (scan?.params[0] ?? []) as string[];
    expect(locIds).toHaveLength(1);
  });

  it("raises a medium alert + push on a downward crossing (qty > 0)", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: "3", reorderLevel: "5" })] });
    const pushes = await checkReorder(sql, [KEY]);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].title).toBe("Low stock");
    expect(pushes[0].body).toContain("Fricofin LL");
    expect(pushes[0].body).toContain("Bachupally");
    expect(calledTag(sql, "reorder_alert_insert")).toBe(true);
    expect(calledTag(sql, "reorder_state_arm")).toBe(true);
    const insert = sql.calls.find((c) => c.tag === "reorder_alert_insert");
    expect(insert?.params).toContain("medium");
  });

  it("raises a high-severity alert when qty is zero or below", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: "0", reorderLevel: "5" })] });
    const pushes = await checkReorder(sql, [KEY]);
    expect(pushes).toHaveLength(1);
    const insert = sql.calls.find((c) => c.tag === "reorder_alert_insert");
    expect(insert?.params).toContain("high");
  });

  it("fires exactly at the reorder level (qty == reorder)", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: "5", reorderLevel: "5" })] });
    expect(await checkReorder(sql, [KEY])).toHaveLength(1);
  });

  it("stays silent while already alerted (open alert exists, still low)", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: "2", openAlertId: "alert-9" })] });
    const pushes = await checkReorder(sql, [KEY]);
    expect(pushes).toEqual([]);
    expect(calledTag(sql, "reorder_alert_insert")).toBe(false);
    expect(calledTag(sql, "reorder_alert_close")).toBe(false);
  });

  it("auto-closes the open alert on recovery (restocked above reorder)", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: "9", reorderLevel: "5", openAlertId: "alert-9" })] });
    const pushes = await checkReorder(sql, [KEY]);
    expect(pushes).toEqual([]);
    expect(calledTag(sql, "reorder_alert_close")).toBe(true);
    expect(calledTag(sql, "reorder_state_clear")).toBe(true);
    const close = sql.calls.find((c) => c.tag === "reorder_alert_close");
    expect(close?.params).toContain("alert-9");
  });

  it("does nothing when above reorder with no open alert", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: "20", openAlertId: null })] });
    expect(await checkReorder(sql, [KEY])).toEqual([]);
    expect(calledTag(sql, "reorder_alert_insert")).toBe(false);
    expect(calledTag(sql, "reorder_alert_close")).toBe(false);
  });

  it("ignores SKUs with no reorder level set", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ reorderLevel: null })] });
    expect(await checkReorder(sql, [KEY])).toEqual([]);
    expect(calledTag(sql, "reorder_alert_insert")).toBe(false);
  });

  it("handles a numeric (not string) reorder level and qty", async () => {
    const sql = makeSql({ reorder_scan: [scanRow({ qtyUnits: 1, reorderLevel: 4, packSizeLitres: 4 })] });
    expect(await checkReorder(sql, [KEY])).toHaveLength(1);
  });
});

describe("superAdminPushTokens", () => {
  it("returns super-admin device tokens, dropping blanks", async () => {
    const sql = makeSql({ reorder_superadmin_push_tokens: [{ token: "A" }, { token: "" }, { token: "B" }] });
    expect(await superAdminPushTokens(sql)).toEqual(["A", "B"]);
  });

  it("returns [] when no super admin has a device", async () => {
    const sql = makeSql({ reorder_superadmin_push_tokens: [] });
    expect(await superAdminPushTokens(sql)).toEqual([]);
  });
});

describe("keysForInvoice", () => {
  it("maps the invoice's movement SKUs to reorder keys", async () => {
    const sql = makeSql({
      reorder_keys_for_invoice: [
        { locationId: "loc-1", productId: "prod-1", packSizeLitres: "205" },
        { locationId: "loc-1", productId: "prod-2", packSizeLitres: 4 },
      ],
    });
    const keys = await keysForInvoice(sql, "inv-1");
    expect(keys).toEqual([
      { locationId: "loc-1", productId: "prod-1", packSizeLitres: 205 },
      { locationId: "loc-1", productId: "prod-2", packSizeLitres: 4 },
    ]);
  });
});
