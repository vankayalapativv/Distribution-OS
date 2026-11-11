import { describe, expect, it } from "vitest";
import { checkHealth, degradedMsFromEnv } from "./health";
import { makeSql } from "../test/sql-mock";

describe("checkHealth", () => {
  it("is down with no sql client", async () => {
    const h = await checkHealth(null);
    expect(h).toMatchObject({ status: "down", database: { configured: false, reachable: false } });
  });
  it("is ok on a fast probe, degraded when over threshold, down on a throw", async () => {
    expect((await checkHealth(makeSql({ health_check: [{ ok: 1 }] }))).status).toBe("ok");
    expect((await checkHealth(makeSql({ health_check: [{ ok: 1 }] }), { degradedMs: -1 })).status).toBe("degraded");
    const bad = makeSql({ health_check: () => { throw new Error("db down"); } });
    expect((await checkHealth(bad)).status).toBe("down");
  });
});

describe("degradedMsFromEnv", () => {
  it("parses a positive number, else the default", () => {
    expect(degradedMsFromEnv({ HEALTH_DEGRADED_MS: "1000" })).toBe(1000);
    expect(degradedMsFromEnv({})).toBe(2000);
  });
});
