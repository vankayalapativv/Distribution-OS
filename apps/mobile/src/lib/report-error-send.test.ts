import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPendingErrors, post } from "./report-error-send";

const h = vi.hoisted(() => ({ auth: { token: "tok" as string | null }, onlineCb: (_o: boolean) => {} }));
const getIsOnline = vi.fn<() => boolean>(() => true);
const readErrorBuffer = vi.fn<(...a: unknown[]) => unknown[]>(() => [{ source: "mobile" }]);
const flushErrorBuffer = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());

vi.mock("./api", () => ({ API_BASE_URL: "http://api" }));
vi.mock("./auth", () => ({ useAuth: { getState: () => h.auth } }));
vi.mock("./connectivity", () => ({ getIsOnline: () => getIsOnline(), subscribeOnline: (cb: (o: boolean) => void) => { h.onlineCb = cb; } }));
vi.mock("./db", () => ({ getLocalDb: () => ({}) }));
vi.mock("./error-buffer", () => ({ readErrorBuffer: (...a: unknown[]) => readErrorBuffer(...a), flushErrorBuffer: (...a: unknown[]) => flushErrorBuffer(...a) }));


let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  h.auth.token = "tok";
  getIsOnline.mockReturnValue(true);
  readErrorBuffer.mockReturnValue([{ source: "mobile" }]);
  flushErrorBuffer.mockResolvedValue(undefined);
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("post", () => {
  it("returns true on an ok response", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect(await post("tok", { source: "mobile", message: "x", level: "error" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://api/errors/ingest", expect.objectContaining({ method: "POST" }));
  });
  it("returns false on a non-ok response or a thrown fetch", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    expect(await post("tok", { source: "mobile", message: "x", level: "error" })).toBe(false);
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await post("tok", { source: "mobile", message: "x", level: "error" })).toBe(false);
  });
});

describe("flushPendingErrors", () => {
  it("flushes the buffer when online with a token and items (sending each via post)", async () => {
    const fetchOk = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchOk);
    flushErrorBuffer.mockImplementation(async (...a: unknown[]) => { await (a[1] as (i: unknown) => Promise<boolean>)({ source: "mobile" }); });
    await flushPendingErrors();
    expect(flushErrorBuffer).toHaveBeenCalled();
    expect(fetchOk).toHaveBeenCalledWith("http://api/errors/ingest", expect.anything()); // the mapper routed through post
  });
  it("skips when offline", async () => {
    getIsOnline.mockReturnValue(false);
    await flushPendingErrors();
    expect(flushErrorBuffer).not.toHaveBeenCalled();
  });
  it("skips when signed out", async () => {
    h.auth.token = null;
    await flushPendingErrors();
    expect(flushErrorBuffer).not.toHaveBeenCalled();
  });
  it("skips when the buffer is empty", async () => {
    readErrorBuffer.mockReturnValue([]);
    await flushPendingErrors();
    expect(flushErrorBuffer).not.toHaveBeenCalled();
  });
  it("is re-entrancy guarded while a flush is in flight", async () => {
    let release!: () => void;
    flushErrorBuffer.mockReturnValue(new Promise((r) => { release = () => r(); }));
    const first = flushPendingErrors();
    await flushPendingErrors(); // guarded out
    expect(flushErrorBuffer).toHaveBeenCalledTimes(1);
    release(); await first;
  });
  it("auto-flushes when connectivity returns", () => {
    const spy = vi.fn();
    readErrorBuffer.mockImplementation(() => { spy(); return []; });
    h.onlineCb(true); // the subscribeOnline callback
    expect(spy).toHaveBeenCalled();
    h.onlineCb(false); // offline → no flush
  });
});
