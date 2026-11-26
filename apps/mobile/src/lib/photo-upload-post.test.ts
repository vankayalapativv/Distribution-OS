import { afterEach, describe, expect, it, vi } from "vitest";
import { appendGeo, postPhotoUpload } from "./photo-upload-post";

const expoFetch = vi.fn();
vi.mock("expo/fetch", () => ({ fetch: (...a: unknown[]) => expoFetch(...a) }));

const okRes = (body: unknown, ok = true, status = 200) => ({ ok, status, json: () => Promise.resolve(body) });
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("postPhotoUpload", () => {
  it("resolves on a success envelope", async () => {
    expoFetch.mockResolvedValue(okRes({ success: true }));
    await expect(postPhotoUpload("http://x/up", { Authorization: "Bearer t" }, new FormData())).resolves.toBeUndefined();
  });

  it("throws the server error message on a non-ok response", async () => {
    expoFetch.mockResolvedValue(okRes({ success: false, error: { message: "too big" } }, false, 413));
    await expect(postPhotoUpload("http://x/up", undefined, new FormData())).rejects.toThrow("too big");
  });

  it("throws a status-based default when the body isn't JSON", async () => {
    expoFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error("not json")) });
    await expect(postPhotoUpload("http://x/up", undefined, new FormData())).rejects.toThrow("Photo upload failed (500).");
  });

  it("throws when the envelope reports success:false despite a 200", async () => {
    expoFetch.mockResolvedValue(okRes({ success: false }));
    await expect(postPhotoUpload("http://x/up", undefined, new FormData())).rejects.toThrow(/Photo upload failed/);
  });

  it("rethrows a plain network failure (not aborted)", async () => {
    expoFetch.mockRejectedValue(new Error("network down"));
    await expect(postPhotoUpload("http://x/up", undefined, new FormData())).rejects.toThrow("network down");
  });

  it("surfaces a timeout message when the 60s abort fires", async () => {
    vi.useFakeTimers();
    expoFetch.mockImplementation((_url: string, opts: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new Error("The user aborted a request.")));
      }),
    );
    const p = postPhotoUpload("http://x/up", undefined, new FormData());
    const assertion = expect(p).rejects.toThrow(/Upload timed out/);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});

describe("appendGeo", () => {
  it("no-ops when geo is undefined", () => {
    const form = new FormData();
    appendGeo(form, undefined);
    expect([...form.keys()]).toHaveLength(0);
  });
  it("appends only the present fields", () => {
    const form = new FormData();
    appendGeo(form, { latitude: 17.4, longitude: null, address: "MG Rd" });
    expect(form.get("latitude")).toBe("17.4");
    expect(form.has("longitude")).toBe(false);
    expect(form.get("address")).toBe("MG Rd");
  });
  it("omits a blank address", () => {
    const form = new FormData();
    appendGeo(form, { latitude: null, longitude: 78.5, address: null });
    expect(form.get("longitude")).toBe("78.5");
    expect(form.has("address")).toBe(false);
  });
});
