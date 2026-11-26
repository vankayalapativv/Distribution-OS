import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stampPhoto, withStampTimeout } from "./photo-stamp";
import type { PickedPhoto } from "./photos";

const getCheckInFix = vi.fn<() => Promise<{ latitude: number; longitude: number } | null>>(() => Promise.resolve({ latitude: 17.4, longitude: 78.5 }));
const imageSize = vi.fn<(...a: unknown[]) => Promise<{ w: number; h: number }>>(() => Promise.resolve({ w: 2000, h: 1000 }));
const reverseGeocode = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve("MG Road"));
const buildLines = vi.fn<(...a: unknown[]) => string[]>(() => ["📍 Balaji", "MG Road"]);
type Job = { uri: string; width: number; height: number; lines: string[]; resolve: (u: string | null) => void };
let enqueueImpl: ((job: Job) => void) | null = (job) => job.resolve("file://stamped.jpg");

vi.mock("./gps", () => ({ getCheckInFix: () => getCheckInFix() }));
vi.mock("./photo-stamp-band", () => ({
  imageSize: (...a: unknown[]) => imageSize(...a),
  reverseGeocode: (...a: unknown[]) => reverseGeocode(...a),
  buildLines: (...a: unknown[]) => buildLines(...a),
}));
vi.mock("./photo-stamp-host", () => ({ get enqueue() { return enqueueImpl; }, PhotoStampHost: () => null }));

const photo: PickedPhoto = { uri: "file://orig.jpg", name: "orig.jpg", type: "image/jpeg" };
const ctx = { userName: "Ravi" };
beforeEach(() => {
  getCheckInFix.mockResolvedValue({ latitude: 17.4, longitude: 78.5 });
  imageSize.mockResolvedValue({ w: 2000, h: 1000 });
  reverseGeocode.mockResolvedValue("MG Road");
  enqueueImpl = (job) => job.resolve("file://stamped.jpg");
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("stampPhoto", () => {
  it("stamps the photo and carries the geo + stamped uri", async () => {
    const out = await stampPhoto(photo, ctx);
    expect(out).toEqual({
      uri: "file://stamped.jpg", name: "orig.jpg", type: "image/jpeg",
      latitude: 17.4, longitude: 78.5, address: "MG Road",
    });
    expect(buildLines).toHaveBeenCalledWith({ latitude: 17.4, longitude: 78.5 }, "MG Road", ctx);
  });

  it("fails open (original photo) when the host isn't mounted", async () => {
    enqueueImpl = null;
    expect(await stampPhoto(photo, ctx)).toBe(photo);
  });

  it("fails open when the source size can't be read", async () => {
    imageSize.mockResolvedValue({ w: 0, h: 0 });
    expect(await stampPhoto(photo, ctx)).toBe(photo);
  });

  it("skips geocoding when there's no GPS fix (null geo)", async () => {
    getCheckInFix.mockResolvedValue(null);
    const out = await stampPhoto(photo, ctx);
    expect(reverseGeocode).not.toHaveBeenCalled();
    expect(out).toMatchObject({ uri: "file://stamped.jpg", latitude: null, longitude: null, address: null });
  });

  it("keeps the original uri but attaches geo when the capture yields nothing", async () => {
    enqueueImpl = (job) => job.resolve(null);
    const out = await stampPhoto(photo, ctx);
    expect(out).toEqual({ ...photo, latitude: 17.4, longitude: 78.5, address: "MG Road" });
  });

  it("returns the original photo if the pipeline throws", async () => {
    imageSize.mockRejectedValue(new Error("decode failed"));
    expect(await stampPhoto(photo, ctx)).toBe(photo);
  });

  it("fails open after the 16s pipeline timeout when an inner call hangs", async () => {
    vi.useFakeTimers();
    enqueueImpl = () => { /* never resolves */ };
    const p = stampPhoto(photo, ctx);
    await vi.advanceTimersByTimeAsync(16000);
    expect(await p).toBe(photo);
  });
});

describe("withStampTimeout", () => {
  it("resolves to the value when the promise settles in time", async () => {
    expect(await withStampTimeout(Promise.resolve("ok"), 1000, "fb")).toBe("ok");
  });
  it("yields the fallback when the promise rejects", async () => {
    expect(await withStampTimeout(Promise.reject(new Error("boom")), 1000, "fb")).toBe("fb");
  });
});
