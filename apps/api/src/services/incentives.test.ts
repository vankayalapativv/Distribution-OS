import { describe, expect, it } from "vitest";
import { listIncentives, upsertIncentive } from "./incentives";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "admin-1" };
const SE = "se-1";

describe("listIncentives", () => {
  it("rejects a non YYYY-MM month with 422", async () => {
    await expect(listIncentives(makeSql(), { month: "2026" })).rejects.toMatchObject({ status: 422 });
    await expect(listIncentives(makeSql(), { month: null })).rejects.toMatchObject({ status: 422 });
  });

  it("maps actuals + knobs and sums the total incentive", async () => {
    const sql = makeSql({
      incentives_list: [
        {
          userId: SE,
          name: "Asha",
          collectionsTotal: "50000",
          litresTotal: "200",
          collectionPct: "2",
          perLitreRate: "1.5",
          targetLitres: "150",
          targetReward: "1000",
          collectionsIncentive: "1000",
          perLitreIncentive: "300",
          targetMet: true,
          targetIncentive: "1000",
        },
        {
          userId: "se-2",
          name: "Ravi",
          collectionsTotal: 0,
          litresTotal: 0,
          collectionPct: null,
          perLitreRate: null,
          targetLitres: null,
          targetReward: null,
          collectionsIncentive: 0,
          perLitreIncentive: 0,
          targetMet: false,
          targetIncentive: 0,
        },
      ],
      incentives_period_meta: [{ label: null, isCurrent: false }], // null label → str() falls back to ""
    });
    const res = await listIncentives(sql, { month: "2026-06" });
    expect(res.period).toEqual({ month: "2026-06", label: "", isCurrent: false });
    expect(res.executives[0]).toMatchObject({ targetMet: true, totalIncentive: 2300 });
    expect(res.executives[1]).toMatchObject({ collectionPct: null, perLitreRate: null, totalIncentive: 0 });
  });
});

describe("upsertIncentive", () => {
  const ok = { incentive_user_exists: [{ id: SE }], upsert_se_incentive: [] };
  const base = { month: "2026-06", collectionPct: 2, perLitreRate: 1.5, targetLitres: 150, targetReward: 1000 };

  it("upserts the knobs for a valid SE and month", async () => {
    expect(await upsertIncentive(makeSql(ok), CTX, SE, base)).toEqual({ ok: true });
  });

  it("rejects an invalid month (422)", async () => {
    await expect(upsertIncentive(makeSql(ok), CTX, SE, { ...base, month: "nope" })).rejects.toMatchObject({ status: 422 });
  });

  it("rejects a collection % above 100 and any negative knob (422)", async () => {
    await expect(upsertIncentive(makeSql(ok), CTX, SE, { ...base, collectionPct: 150 })).rejects.toMatchObject({ status: 422 });
    await expect(upsertIncentive(makeSql(ok), CTX, SE, { ...base, perLitreRate: -1 })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when the target user is not a sales executive", async () => {
    const sql = makeSql({ incentive_user_exists: [] });
    await expect(upsertIncentive(sql, CTX, SE, base)).rejects.toMatchObject({ status: 404 });
  });
});
