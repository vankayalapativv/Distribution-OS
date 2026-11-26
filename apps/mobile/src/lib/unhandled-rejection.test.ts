import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installUnhandledRejectionReporting } from "./unhandled-rejection";

const reportMobileError = vi.fn();
vi.mock("./report-error", () => ({ reportMobileError: (...a: unknown[]) => reportMobileError(...a) }));

const g = globalThis as unknown as { HermesInternal?: unknown };
afterEach(() => { delete g.HermesInternal; vi.clearAllMocks(); });
beforeEach(() => { delete g.HermesInternal; });

describe("installUnhandledRejectionReporting", () => {
  it("enables Hermes' rejection tracker and routes unhandled rejections to the monitor", () => {
    let opts: { allRejections: boolean; onUnhandled: (id: number, e: unknown) => void; onHandled?: (id: number) => void } | undefined;
    g.HermesInternal = { enablePromiseRejectionTracker: (o: typeof opts) => { opts = o; } };
    installUnhandledRejectionReporting();
    expect(opts?.allRejections).toBe(true);
    const err = new Error("rejected");
    opts!.onUnhandled(1, err);
    expect(reportMobileError).toHaveBeenCalledWith(err, { boundary: "unhandled-rejection" });
    expect(() => opts!.onHandled?.(1)).not.toThrow();
  });
  it("is a no-op when Hermes' tracker is unavailable", () => {
    expect(() => installUnhandledRejectionReporting()).not.toThrow();
    expect(reportMobileError).not.toHaveBeenCalled();
  });
  it("swallows a throw from the tracker setup", () => {
    g.HermesInternal = { enablePromiseRejectionTracker: () => { throw new Error("boom"); } };
    expect(() => installUnhandledRejectionReporting()).not.toThrow();
  });
});
