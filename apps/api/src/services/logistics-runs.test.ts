import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { listDeliveryRuns } from "./logistics-runs";

/** Fake Neon client matching queries by their `/* tag *\/` comment (see logistics.test.ts). */
function fakeSql(handlers: Record<string, (values: unknown[]) => unknown[]>) {
  const calls: Record<string, unknown[]> = {};
  const match = (text: string, values: unknown[]) => {
    for (const [tag, handler] of Object.entries(handlers)) {
      if (text.includes(`/* ${tag} */`)) {
        calls[tag] = values;
        return Promise.resolve(handler(values));
      }
    }
    return Promise.resolve([]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = (strings: TemplateStringsArray, ...values: unknown[]) => match(strings.join(" "), values);
  fn.query = (text: string, params: unknown[] = []) => match(text, params);
  fn.calls = calls;
  return fn as SqlClient & { calls: Record<string, unknown[]> };
}

describe("listDeliveryRuns", () => {
  test("returns paged rows + total and computes distance from odometers", async () => {
    const sql = fakeSql({
      logistics_runs_count: () => [{ total: 2 }],
      logistics_runs: () => [
        {
          runId: "r1", date: new Date("2026-09-14T00:00:00Z"), driverName: "Ramesh",
          vehicleNumber: "TS07 UB 4521", startedAt: new Date("2026-09-14T02:42:00Z"),
          endedAt: new Date("2026-09-14T10:17:00Z"), startOdometer: "45210", endOdometer: "45352",
          status: "ended", stopCount: 9, photoCount: 22,
        },
      ],
    });

    const res = await listDeliveryRuns(sql, { page: 1, pageSize: 8 });
    expect(res.total).toBe(2);
    expect(res.rows[0]).toMatchObject({
      runId: "r1", date: "2026-09-14", driverName: "Ramesh", vehicleNumber: "TS07 UB 4521",
      startOdometer: 45210, endOdometer: 45352, distanceKm: 142, status: "ended", stopCount: 9, photoCount: 22,
    });
    expect(res.rows[0].endedAt).toContain("2026-09-14");
  });

  test("an active run has a null end time and null distance", async () => {
    const sql = fakeSql({
      logistics_runs_count: () => [{ total: 1 }],
      logistics_runs: () => [
        {
          runId: "r2", date: new Date("2026-09-14T00:00:00Z"), driverName: "Suresh",
          vehicleNumber: "TS08 AC 1187", startedAt: new Date("2026-09-14T03:10:00Z"),
          endedAt: null, startOdometer: "88904", endOdometer: null, status: "active",
          stopCount: 4, photoCount: 9,
        },
      ],
    });
    const res = await listDeliveryRuns(sql, {});
    expect(res.rows[0].endedAt).toBeNull();
    expect(res.rows[0].distanceKm).toBeNull();
    expect(res.rows[0].endOdometer).toBeNull();
  });

  test("passes a driver/vehicle search term and date range as positional params", async () => {
    const sql = fakeSql({
      logistics_runs_count: () => [{ total: 0 }],
      logistics_runs: () => [],
    });
    await listDeliveryRuns(sql, { q: "ramesh", from: "2026-09-01", to: "2026-09-14" });
    // count query params: [like, from, to]
    expect(sql.calls.logistics_runs_count).toEqual(["%ramesh%", "2026-09-01", "2026-09-14"]);
    // list query appends limit + offset
    expect(sql.calls.logistics_runs).toEqual(["%ramesh%", "2026-09-01", "2026-09-14", 8, 0]);
  });

  test("ignores a malformed date filter", async () => {
    const sql = fakeSql({ logistics_runs_count: () => [{ total: 0 }], logistics_runs: () => [] });
    await listDeliveryRuns(sql, { from: "not-a-date" });
    expect(sql.calls.logistics_runs_count).toEqual([]);
  });
});
