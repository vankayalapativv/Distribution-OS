import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installGlobalErrorLogging } from "./global-error-logging";

const reportMobileError = vi.fn();
vi.mock("./report-error", () => ({ reportMobileError: (...a: unknown[]) => reportMobileError(...a) }));

type Handler = (e: unknown, isFatal?: boolean) => void;
const g = globalThis as unknown as Record<string, unknown> & { ErrorUtils?: unknown; __distributionOsErrHooked?: boolean };
let prevHandler: ReturnType<typeof vi.fn>;
let setHandler: Handler | undefined;

beforeEach(() => {
  delete g.__distributionOsErrHooked;
  prevHandler = vi.fn();
  setHandler = undefined;
  g.ErrorUtils = {
    getGlobalHandler: () => prevHandler,
    setGlobalHandler: (hdl: Handler) => { setHandler = hdl; },
  };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { delete g.ErrorUtils; delete g.__distributionOsErrHooked; vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("installGlobalErrorLogging", () => {
  it("wraps the global handler: logs, reports, and chains the previous handler", () => {
    installGlobalErrorLogging();
    expect(setHandler).toBeTypeOf("function");
    const err = new Error("kaboom");
    setHandler!(err, true);
    expect(console.error).toHaveBeenCalled();
    expect(reportMobileError).toHaveBeenCalledWith(err, { boundary: "global-handler", fatal: true });
    expect(prevHandler).toHaveBeenCalledWith(err, true);
  });
  it("treats a non-fatal error as non-fatal", () => {
    installGlobalErrorLogging();
    setHandler!(new Error("x"), false);
    expect(reportMobileError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fatal: false }));
  });
  it("installs only once", () => {
    installGlobalErrorLogging();
    const firstHandler = setHandler;
    installGlobalErrorLogging(); // already hooked → no-op
    expect(setHandler).toBe(firstHandler);
  });
  it("does nothing when ErrorUtils is unavailable", () => {
    delete g.ErrorUtils;
    expect(() => installGlobalErrorLogging()).not.toThrow();
  });
});
