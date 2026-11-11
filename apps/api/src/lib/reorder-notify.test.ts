import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import type { ApiEnv } from "../types";
import { makeSql, type Row } from "../test/sql-mock";
import { notifyReorder } from "./reorder-notify";
import { sendExpoPush } from "../services/invoices";

vi.mock("../services/invoices", () => ({
  sendExpoPush: vi.fn().mockResolvedValue(undefined),
}));

const ctx = () => ({ env: {} }) as unknown as Context<ApiEnv>;
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A `reorder_scan` row that triggers a downward crossing (low, no open alert). */
const lowRow: Row = {
  locationId: "loc-1", productId: "prod-1", packSizeLitres: "205",
  qtyUnits: "2", reorderLevel: "5", productName: "Fricofin LL",
  locationName: "Bachupally", openAlertId: null,
};
const KEYS = [{ locationId: "loc-1", productId: "prod-1", packSizeLitres: 205 }];

afterEach(() => vi.clearAllMocks());

describe("notifyReorder", () => {
  it("does nothing (no push) when no alert was raised", async () => {
    const sql = makeSql({ reorder_scan: [] });
    await notifyReorder(ctx(), sql, KEYS);
    await flush();
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  it("skips the push when no SUPER_ADMIN has a registered device", async () => {
    const sql = makeSql({ reorder_scan: [lowRow], reorder_superadmin_push_tokens: [] });
    await notifyReorder(ctx(), sql, KEYS);
    await flush();
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  it("sends an Expo push to every SUPER_ADMIN device on a low-stock crossing", async () => {
    const sql = makeSql({
      reorder_scan: [lowRow],
      reorder_superadmin_push_tokens: [{ token: "ExpoTok1" }, { token: "ExpoTok2" }],
    });
    await notifyReorder(ctx(), sql, KEYS);
    await flush();
    expect(sendExpoPush).toHaveBeenCalledTimes(1);
    const [tokens, title, , data] = vi.mocked(sendExpoPush).mock.calls[0];
    expect(tokens).toEqual(["ExpoTok1", "ExpoTok2"]);
    expect(title).toBe("Low stock");
    expect(data).toMatchObject({ type: "low_stock" });
  });
});
