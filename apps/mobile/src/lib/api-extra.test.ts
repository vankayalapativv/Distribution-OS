import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUpload } from "./api";
import { setAuthEventHandlers } from "./auth-events";
import { setTokenMinter } from "./token-refresh";

const jwt = (expSeconds: number) => `h.${Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url")}.s`;

const reportMobileError = vi.fn();
vi.mock("./report-error", () => ({ reportMobileError: (...a: unknown[]) => reportMobileError(...a) }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const bearerOf = (call: unknown) => ((call as [string, RequestInit])[1].headers as Record<string, string>).Authorization;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { setTokenMinter(async () => ({ status: "revoked" })); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("apiFetch error reporting", () => {
  it("reports a 5xx failure and rethrows it", async () => {
    fetchMock.mockResolvedValue(json(500, { success: false, error: { code: "SERVER", message: "boom" } }));
    await expect(apiFetch("/orders")).rejects.toMatchObject({ status: 500 });
    await new Promise((r) => setTimeout(r, 0)); // the dynamic reportServerError import settles
    expect(reportMobileError).toHaveBeenCalled();
  });

  it("maps an error envelope to an ApiRequestError with the server code", async () => {
    fetchMock.mockResolvedValue(json(409, { success: false, error: { code: "OPEN_VISIT", message: "busy", details: { customerId: "c1" } } }));
    await expect(apiFetch("/visits/checkin", { method: "POST", body: { a: 1 } })).rejects.toMatchObject({ code: "OPEN_VISIT", status: 409 });
  });

  it("defaults the code and message when the error envelope omits them", async () => {
    fetchMock.mockResolvedValue(json(400, { success: false }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ code: "UNKNOWN", status: 400, message: "Request failed with status 400." });
  });

  it("skips the retry attempt when the refresh returns the same token, then expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2033-01-01T00:00:00Z")); // clear the auth-expired debounce
    const tok = jwt(4102444800); // far-future exp → no proactive swap
    setTokenMinter(async () => ({ status: "active", token: tok })); // same token back
    const onExpired = vi.fn();
    setAuthEventHandlers({ onExpired: onExpired as () => void });
    fetchMock.mockResolvedValue(json(401, { success: false, error: { code: "UNAUTHORIZED", message: "dead" } }));
    await expect(apiFetch("/x", { token: tok })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second attempt (token unchanged)
    expect(onExpired).toHaveBeenCalled();
  });

  it("aborts a stalled request after the timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_u: string, init: { signal: AbortSignal }) =>
      new Promise((_res, rej) => { init.signal.addEventListener("abort", () => rej(new Error("aborted"))); }),
    );
    const p = apiFetch("/slow");
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});

describe("apiUpload", () => {
  it("posts the FormData with a bearer header and no Content-Type", async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: { id: "p1" } }));
    const form = new FormData();
    expect(await apiUpload<{ id: string }>("/photos", form, "tok")).toEqual({ id: "p1" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(bearerOf(fetchMock.mock.calls[0])).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(form);
  });
  it("omits the bearer header without a token", async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: {} }));
    await apiUpload("/photos", new FormData(), null);
    expect(bearerOf(fetchMock.mock.calls[0])).toBeUndefined();
  });
});
