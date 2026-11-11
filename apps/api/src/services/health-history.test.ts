import { describe, expect, it, vi } from "vitest";
import { buildStatusSummary, emptyState, istDate, readState, recordObservations, writeState } from "./health-history";

describe("health-history", () => {
  it("istDate returns an IST calendar date", () => {
    expect(istDate(Date.parse("2026-06-01T20:00:00Z"))).toBe("2026-06-02"); // 01:30 IST next day
  });

  it("readState parses stored JSON, falls back to empty on miss/throw", async () => {
    const good = { get: vi.fn().mockResolvedValue({ text: async () => JSON.stringify(emptyState()) }) };
    expect(await readState(good as never)).toHaveProperty("days");
    const miss = { get: vi.fn().mockResolvedValue(null) };
    expect(await readState(miss as never)).toHaveProperty("current");
    const boom = { get: vi.fn().mockRejectedValue(new Error("r2 down")) };
    expect(await readState(boom as never)).toHaveProperty("updatedAt");
  });

  it("writeState swallows R2 errors", async () => {
    await expect(writeState({ put: vi.fn().mockResolvedValue(undefined) } as never, emptyState())).resolves.toBeUndefined();
    await expect(writeState({ put: vi.fn().mockRejectedValue(new Error("x")) } as never, emptyState())).resolves.toBeUndefined();
  });

  it("recordObservations + buildStatusSummary: overall down", () => {
    const now = Date.parse("2026-06-01T06:00:00Z");
    const state = recordObservations(emptyState(), {
      api: { status: "ok", latencyMs: 5, observedAt: "t" },
      database: { status: "down", latencyMs: null, observedAt: "t" },
    }, now);
    const summary = buildStatusSummary(state, now);
    expect(summary.overall).toBe("down");
    expect(summary.components.find((c) => c.key === "database")!.currentStatus).toBe("down");
  });

  it("buildStatusSummary: overall degraded when slow but up", () => {
    const now = Date.parse("2026-06-01T06:00:00Z");
    const state = recordObservations(emptyState(), {
      api: { status: "ok", latencyMs: 5, observedAt: "t" },
      database: { status: "degraded", latencyMs: 3000, observedAt: "t" },
    }, now);
    expect(buildStatusSummary(state, now).overall).toBe("degraded");
  });
});
