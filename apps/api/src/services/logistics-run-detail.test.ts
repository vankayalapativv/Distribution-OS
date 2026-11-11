import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { getRunDetail } from "./logistics-run-detail";

/** Fake Neon client matching tagged-template queries by their `/* tag *\/` comment. */
function fakeSql(handlers: Record<string, () => unknown[]>) {
  const match = (text: string) => {
    for (const [tag, handler] of Object.entries(handlers)) {
      if (text.includes(`/* ${tag} */`)) return Promise.resolve(handler());
    }
    return Promise.resolve([]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = (strings: TemplateStringsArray) => match(strings.join(" "));
  fn.query = (text: string) => match(text);
  return fn as SqlClient;
}

const runRow = {
  runId: "r1", date: new Date("2026-09-14T00:00:00Z"), driverName: "Ramesh",
  vehicleNumber: "TS07 UB 4521", startedAt: new Date("2026-09-14T02:42:00Z"),
  endedAt: new Date("2026-09-14T10:17:00Z"), startOdometer: "45210", endOdometer: "45352", status: "ended",
};

describe("getRunDetail", () => {
  test("maps the run bookends, odometer photos and distance", async () => {
    const sql = fakeSql({
      logistics_run: () => [runRow],
      logistics_run_odometer_photos: () => [
        { id: "p-start", kind: "start_odometer", contentType: "image/jpeg" },
        { id: "p-end", kind: "end_odometer", contentType: null },
      ],
      logistics_run_stops: () => [],
      logistics_run_stop_photos: () => [],
    });
    const { run } = await getRunDetail(sql, "r1");
    expect(run).toMatchObject({
      runId: "r1", driverName: "Ramesh", distanceKm: 142, status: "ended",
      startPhoto: { id: "p-start", contentType: "image/jpeg" },
      endPhoto: { id: "p-end", contentType: null },
    });
  });

  test("groups stop photos under each stop and orders stops by time", async () => {
    const sql = fakeSql({
      logistics_run: () => [runRow],
      logistics_run_odometer_photos: () => [],
      logistics_run_stops: () => [
        { stopId: "s1", customerId: "c1", customerName: "Sri Laxmi", customerCode: "CUST-1",
          createdAt: new Date("2026-09-14T03:04:00Z"), latitude: "17.05", longitude: "79.28" },
        { stopId: "s2", customerId: "c2", customerName: "Balaji", customerCode: "CUST-2",
          createdAt: new Date("2026-09-14T03:41:00Z"), latitude: null, longitude: null },
      ],
      logistics_run_stop_photos: () => [
        { id: "ph1", stopId: "s1", contentType: "image/jpeg", createdAt: new Date() },
        { id: "ph2", stopId: "s1", contentType: "image/jpeg", createdAt: new Date() },
      ],
    });
    const { stops } = await getRunDetail(sql, "r1");
    expect(stops).toHaveLength(2);
    expect(stops[0]).toMatchObject({ stopId: "s1", customerName: "Sri Laxmi", latitude: 17.05 });
    expect(stops[0].photos.map((p) => p.id)).toEqual(["ph1", "ph2"]);
    expect(stops[1].photos).toEqual([]); // no photos for s2
    expect(stops[1].latitude).toBeNull();
  });

  test("has null odometer photos and null distance when none/odometer missing", async () => {
    const sql = fakeSql({
      logistics_run: () => [{ ...runRow, startOdometer: null, endOdometer: null }],
      logistics_run_odometer_photos: () => [],
      logistics_run_stops: () => [],
      logistics_run_stop_photos: () => [],
    });
    const { run } = await getRunDetail(sql, "r1");
    expect(run.startPhoto).toBeNull();
    expect(run.endPhoto).toBeNull();
    expect(run.distanceKm).toBeNull();
  });

  test("throws 404 when the run does not exist", async () => {
    const sql = fakeSql({ logistics_run: () => [] });
    await expect(getRunDetail(sql, "missing")).rejects.toMatchObject({ status: 404 });
  });
});
