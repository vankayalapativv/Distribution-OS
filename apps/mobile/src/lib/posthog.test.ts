import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctor = vi.fn();
const captureException = vi.fn();
class PostHogMock {
  constructor(...a: unknown[]) { ctor(...a); }
  captureException(...a: unknown[]) { captureException(...a); }
}

async function load(token: string | undefined, dev = false) {
  vi.resetModules();
  if (token === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN;
  else process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN = token;
  (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  vi.doMock("posthog-react-native", () => ({ default: PostHogMock }));
  return import("./posthog");
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => { vi.clearAllMocks(); vi.resetModules(); delete process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN; });

describe("capturePostHogException", () => {
  it("lazily builds one client and forwards the exception", async () => {
    const { capturePostHogException } = await load("phc_test");
    const err = new Error("boom");
    capturePostHogException(err, { route: "/x" });
    capturePostHogException(err); // reuses the cached client
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith("phc_test", { host: "https://eu.i.posthog.com" });
    expect(captureException).toHaveBeenCalledWith(err, { route: "/x" });
  });

  it("no-ops without a token, warning once in dev", async () => {
    const { capturePostHogException } = await load(undefined, true);
    capturePostHogException(new Error("a"));
    capturePostHogException(new Error("b")); // second call must not re-warn
    expect(ctor).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    const tokenWarns = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter((c) => typeof c[0] === "string" && c[0].includes("POSTHOG_PROJECT_TOKEN"));
    expect(tokenWarns).toHaveLength(1); // warned exactly once despite two calls
  });

  it("stays silent without a token in production (no client, no warn)", async () => {
    const { capturePostHogException } = await load(undefined, false);
    capturePostHogException(new Error("a"));
    expect(ctor).not.toHaveBeenCalled();
  });

  it("swallows a capture failure", async () => {
    captureException.mockImplementation(() => { throw new Error("posthog down"); });
    const { capturePostHogException } = await load("phc_test");
    expect(() => capturePostHogException(new Error("x"))).not.toThrow();
  });
});
