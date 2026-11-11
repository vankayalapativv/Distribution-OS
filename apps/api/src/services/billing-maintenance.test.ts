import { afterEach, describe, expect, it, vi } from "vitest";

const { ensureCurrentCharge, runBillingReminders, createScopedSqlClient } = vi.hoisted(() => ({
  ensureCurrentCharge: vi.fn(),
  runBillingReminders: vi.fn(),
  createScopedSqlClient: vi.fn(),
}));
vi.mock("./billing-v2", () => ({ ensureCurrentCharge }));
vi.mock("./billing-reminders", () => ({ runBillingReminders }));
vi.mock("../lib/db", () => ({ createScopedSqlClient }));

import { runBillingMaintenance } from "./billing-maintenance";
import { makeSql } from "../test/sql-mock";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("runBillingMaintenance", () => {
  it("scopes each active enterprise, aggregates created + reminded, and survives one failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createScopedSqlClient.mockImplementation((_b: unknown, id: string) => ({ __scoped: id }));
    ensureCurrentCharge
      .mockResolvedValueOnce({ created: true, chargeId: "c1" })
      .mockRejectedValueOnce(new Error("charge boom")) // enterprise 2 charge fails
      .mockResolvedValueOnce({ created: false });
    runBillingReminders
      .mockResolvedValueOnce({ sent: ["due"] })
      .mockResolvedValueOnce({ sent: [] })
      .mockResolvedValueOnce({ sent: ["due", "grace"] });

    const base = makeSql({ billing_active_enterprises: [{ id: "e1" }, { id: "e2" }, { id: "e3" }] });
    const out = await runBillingMaintenance(base, {} as never);

    expect(out).toEqual({ enterprises: 3, created: 1, reminded: 3 });
    expect(createScopedSqlClient).toHaveBeenCalledTimes(3);
    expect(createScopedSqlClient).toHaveBeenNthCalledWith(1, base, "e1");
    // A per-enterprise charge failure doesn't stop reminders or the other enterprises.
    expect(runBillingReminders).toHaveBeenCalledTimes(3);
  });

  it("no active enterprises → zero work", async () => {
    const base = makeSql({ billing_active_enterprises: [] });
    expect(await runBillingMaintenance(base, {} as never)).toEqual({ enterprises: 0, created: 0, reminded: 0 });
    expect(createScopedSqlClient).not.toHaveBeenCalled();
  });
});
