import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportMobileError, setErrorRoute } from "./report-error";

const h = vi.hoisted(() => ({ auth: { token: "tok" as string | null }, version: "1.0.1" as string | undefined }));
const getIsOnline = vi.fn<() => boolean>(() => true);
const enqueueError = vi.fn();
const capturePostHogException = vi.fn();
const post = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("expo-constants", () => ({ default: { expoConfig: { get version() { return h.version; } } } }));
vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 33 } }));
vi.mock("./auth", () => ({ useAuth: { getState: () => h.auth } }));
vi.mock("./connectivity", () => ({ getIsOnline: () => getIsOnline() }));
vi.mock("./db", () => ({ getLocalDb: () => ({}) }));
vi.mock("./error-buffer", () => ({ enqueueError: (...a: unknown[]) => enqueueError(...a) }));
vi.mock("./posthog", () => ({ capturePostHogException: (...a: unknown[]) => capturePostHogException(...a) }));
vi.mock("./report-error-send", () => ({ post: (...a: unknown[]) => post(...a), flushPendingErrors: vi.fn() }));

let n = 0;
const uniq = () => `err-${Date.now()}-${n++}`;
const flush = () => new Promise((r) => setTimeout(r, 0));
beforeEach(() => { h.auth.token = "tok"; h.version = "1.0.1"; getIsOnline.mockReturnValue(true); post.mockResolvedValue(true); setErrorRoute(undefined); });
afterEach(() => vi.clearAllMocks());

describe("reportMobileError", () => {
  it("no-ops when signed out", () => {
    h.auth.token = null;
    reportMobileError(new Error(uniq()));
    expect(post).not.toHaveBeenCalled();
    expect(capturePostHogException).not.toHaveBeenCalled();
  });

  it("posts an Error online and mirrors to PostHog", async () => {
    const msg = uniq();
    reportMobileError(new Error(msg), { boundary: "api" });
    await flush();
    const payload = post.mock.calls[0][1] as { message: string; level: string; kind: string; appVersion: string };
    expect(payload).toMatchObject({ message: msg, level: "error", appVersion: "1.0.1" });
    expect(capturePostHogException).toHaveBeenCalled();
  });

  it("wraps a non-Error thrown value", async () => {
    reportMobileError("just a string");
    await flush();
    expect((post.mock.calls[0][1] as { message: string }).message).toBe("just a string");
  });

  it("honours fatal / level / kind / route context", async () => {
    reportMobileError(new Error(uniq()), { fatal: true });
    reportMobileError(new Error(uniq()), { level: "warning" });
    reportMobileError(new Error(uniq()), { kind: "Custom", route: "/orders" });
    await flush();
    expect((post.mock.calls[0][1] as { level: string }).level).toBe("fatal");
    expect((post.mock.calls[1][1] as { level: string }).level).toBe("warning");
    expect(post.mock.calls[2][1]).toMatchObject({ kind: "Custom", route: "/orders" });
  });

  it("uses the tracked route when none is passed", async () => {
    setErrorRoute("/(tabs)/home");
    reportMobileError(new Error(uniq()));
    await flush();
    expect((post.mock.calls[0][1] as { route: string }).route).toBe("/(tabs)/home");
  });

  it("de-dups a repeated error within the window", async () => {
    const e = new Error(uniq());
    reportMobileError(e);
    reportMobileError(e);
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("falls back to a placeholder message and tolerates a missing stack", async () => {
    const e = new Error(""); e.stack = undefined;
    reportMobileError(e);
    await flush();
    const payload = post.mock.calls[0][1] as { message: string; stack?: string };
    expect(payload.message).toBe("(no message)");
    expect(payload.stack).toBeUndefined();
  });

  it("clears the de-dup map once it grows past 100 entries", async () => {
    for (let i = 0; i < 101; i++) reportMobileError(new Error(`cap-${i}`));
    await flush();
    expect(post).toHaveBeenCalledTimes(101); // all distinct, none deduped away
  });

  it("omits the app version when the config has none", async () => {
    h.version = undefined;
    reportMobileError(new Error(uniq()));
    await flush();
    expect((post.mock.calls[0][1] as { appVersion?: string }).appVersion).toBeUndefined();
  });

  it("buffers the report when offline", () => {
    getIsOnline.mockReturnValue(false);
    reportMobileError(new Error(uniq()));
    expect(post).not.toHaveBeenCalled();
    expect(enqueueError).toHaveBeenCalled();
  });

  it("buffers the report when the send fails", async () => {
    post.mockResolvedValue(false);
    reportMobileError(new Error(uniq()));
    await flush();
    expect(enqueueError).toHaveBeenCalled();
  });

  it("never throws, even if an internal step fails", () => {
    capturePostHogException.mockImplementation(() => { throw new Error("boom"); });
    expect(() => reportMobileError(new Error(uniq()))).not.toThrow();
    expect(post).not.toHaveBeenCalled(); // threw before the send
  });
});
