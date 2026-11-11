import { describe, expect, it } from "vitest";
import { closeAlert, listAlerts } from "./alerts";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "u1" };

describe("alerts", () => {
  it("listAlerts maps rows (null str-field → '')", async () => {
    const sql = makeSql({ list_alerts: [{ id: "a1", alertType: "X", severity: "high", alertMessage: null, status: "open", createdAt: "2026-06-01", alertDate: "2026-06-01" }] });
    const rows = await listAlerts(sql, CTX, { status: "open", severity: "high", alertType: "X" });
    expect(rows[0]).toMatchObject({ id: "a1", alertMessage: "" });
  });
  it("closeAlert 404s then closes", async () => {
    await expect(closeAlert(makeSql({ get_alert_by_id: [] }), CTX, "x")).rejects.toMatchObject({ status: 404 });
    const sql = makeSql({ get_alert_by_id: [{ id: "a1" }], close_alert: [{ id: "a1", status: "closed" }] });
    expect(await closeAlert(sql, CTX, "a1")).toMatchObject({ id: "a1", status: "closed" });
  });
});
