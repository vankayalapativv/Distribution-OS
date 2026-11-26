import { afterEach, describe, expect, it, vi } from "vitest";
import { rearmNativeTracking } from "./native-rearm";

const setNativeSignedIn = vi.fn();
vi.mock("./gps", () => ({ setNativeSignedIn: (...a: unknown[]) => setNativeSignedIn(...a) }));

afterEach(() => vi.clearAllMocks());

describe("rearmNativeTracking", () => {
  it("re-arms the native GPS uploader for the signed-in session", async () => {
    setNativeSignedIn.mockResolvedValue(undefined);
    await rearmNativeTracking();
    expect(setNativeSignedIn).toHaveBeenCalledWith(true);
  });

  it("swallows a native failure (best-effort)", async () => {
    setNativeSignedIn.mockRejectedValue(new Error("native down"));
    await expect(rearmNativeTracking()).resolves.toBeUndefined();
  });
});
