import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { getRunsSummary } from "./logistics-runs-summary";

function fakeSql(handler: () => unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = (strings: TemplateStringsArray) =>
    Promise.resolve(strings.join(" ").includes("/* logistics_runs_summary */") ? handler() : []);
  return fn as SqlClient;
}

describe("getRunsSummary", () => {
  test("coerces the aggregate row and rounds distance", async () => {
    const sql = fakeSql(() => [{ runsToday: 6, activeNow: 2, stopsToday: 37, distanceKm: "611.97" }]);
    expect(await getRunsSummary(sql)).toEqual({ runsToday: 6, activeNow: 2, stopsToday: 37, distanceKm: 612 });
  });

  test("defaults everything to zero when there is no row", async () => {
    const sql = fakeSql(() => []);
    expect(await getRunsSummary(sql)).toEqual({ runsToday: 0, activeNow: 0, stopsToday: 0, distanceKm: 0 });
  });
});
