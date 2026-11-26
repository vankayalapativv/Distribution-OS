import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, handleSessionHeaders, parseJsonEnvelope, reportServerError } from "./api-core";

const notifyTokenRefreshed = vi.fn();
const reportMobileError = vi.fn();
vi.mock("./auth-events", () => ({ notifyTokenRefreshed: (...a: unknown[]) => notifyTokenRefreshed(...a) }));
vi.mock("./report-error", () => ({ reportMobileError: (...a: unknown[]) => reportMobileError(...a) }));

afterEach(() => vi.clearAllMocks());

describe("handleSessionHeaders", () => {
  it("adopts a slid token when the header is present", () => {
    handleSessionHeaders({ headers: { get: () => "slid-token" } } as unknown as Response);
    expect(notifyTokenRefreshed).toHaveBeenCalledWith("slid-token");
  });
  it("does nothing without the header", () => {
    handleSessionHeaders({ headers: { get: () => null } } as unknown as Response);
    expect(notifyTokenRefreshed).not.toHaveBeenCalled();
  });
});

describe("parseJsonEnvelope", () => {
  it("returns the parsed envelope", async () => {
    const res = { status: 200, json: () => Promise.resolve({ success: true, data: 7 }) } as unknown as Response;
    expect(await parseJsonEnvelope<number>(res)).toEqual({ success: true, data: 7 });
  });
  it("turns a non-JSON body into a clean ApiRequestError", async () => {
    const res = { status: 503, json: () => Promise.reject(new SyntaxError("<html>")) } as unknown as Response;
    await expect(parseJsonEnvelope(res)).rejects.toMatchObject({ code: "NON_JSON_RESPONSE", status: 503 });
  });
});

describe("ApiRequestError", () => {
  it("carries code, status and optional details", () => {
    const e = new ApiRequestError("OPEN_VISIT", "busy", 409, { customerId: "c1" });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("OPEN_VISIT");
    expect(e.status).toBe(409);
    expect(e.details).toEqual({ customerId: "c1" });
  });
});

describe("reportServerError", () => {
  it("reports a server failure to the error monitor", async () => {
    reportServerError("/orders", 500, "boom");
    await new Promise((r) => setTimeout(r, 0)); // the dynamic import + report settle
    expect(reportMobileError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ boundary: "api", route: "/orders" }));
  });
  it("swallows a failure inside the error reporter itself", async () => {
    reportMobileError.mockImplementation(() => { throw new Error("reporter down"); });
    expect(() => reportServerError("/orders", 500, "boom")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
