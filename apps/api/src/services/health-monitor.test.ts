import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  checkHealth: vi.fn(),
  readState: vi.fn(),
  recordObservations: vi.fn(),
  writeState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./health", () => ({ checkHealth: h.checkHealth, degradedMsFromEnv: () => 500 }));
vi.mock("./health-history", () => ({
  COMPONENTS: [{ key: "api", name: "API" }, { key: "database", name: "Database" }],
  readState: h.readState, recordObservations: h.recordObservations, writeState: h.writeState,
}));
vi.mock("@sri-aparajita/shared", () => ({ BRAND: { name: "SA" } }));

import { inStatusWindow, runHealthMonitor } from "./health-monitor";

const okDb = { status: "ok", database: { latencyMs: 5 } };
const downDb = { status: "down", database: { latencyMs: null } };
const alertEnv = { ENVIRONMENT: "test", PHOTOS: {}, RESEND_API_KEY: "re_x", REPORTS_TO: "ops@x.co" } as never;

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("inStatusWindow", () => {
  it("handles the default (now) arg, Sunday, pre-9am and mid-window", () => {
    expect(typeof inStatusWindow()).toBe("boolean"); // default Date.now() arg
    expect(inStatusWindow(Date.parse("2026-06-07T04:30:00Z"))).toBe(false); // Sunday
    expect(inStatusWindow(Date.parse("2026-05-31T23:30:00Z"))).toBe(false); // Mon 05:00 IST
    expect(inStatusWindow(Date.parse("2026-06-01T04:30:00Z"))).toBe(true); // Mon 10:00 IST
  });
});

describe("runHealthMonitor", () => {
  it("probe-only (no bucket), all components ok", async () => {
    h.checkHealth.mockResolvedValue(okDb);
    const res = await runHealthMonitor({ ENVIRONMENT: "test" } as never, null);
    expect(res).toMatchObject({ status: "ok", changed: false, emailed: false });
  });

  it("no status change → records history, no email", async () => {
    h.checkHealth.mockResolvedValue(downDb);
    h.readState.mockResolvedValue({ notified: { status: "down" } });
    const res = await runHealthMonitor(alertEnv, null);
    expect(res).toMatchObject({ status: "down", changed: false, emailed: false });
    expect(h.writeState).toHaveBeenCalled();
  });

  it("status change → emails via Resend (success path)", async () => {
    h.checkHealth.mockResolvedValue(downDb);
    h.readState.mockResolvedValue({ notified: { status: "ok" } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await runHealthMonitor(alertEnv, null);
    expect(res).toMatchObject({ changed: true, emailed: true });
  });

  it("status change with no RESEND config → logs, no email", async () => {
    h.checkHealth.mockResolvedValue(downDb);
    h.readState.mockResolvedValue({ notified: { status: "ok" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runHealthMonitor({ ENVIRONMENT: "test", PHOTOS: {} } as never, null);
    expect(res).toMatchObject({ changed: true, emailed: false });
    spy.mockRestore();
  });

  it("surfaces a Resend send failure", async () => {
    h.checkHealth.mockResolvedValue(downDb);
    h.readState.mockResolvedValue({ notified: { status: "ok" } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "boom" }), { status: 500 }));
    await expect(runHealthMonitor(alertEnv, null)).rejects.toThrow(/Resend 500/);
  });
});
