import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCollectionProof, uploadCustomerPhoto, uploadDeliveryPhoto } from "./photo-upload";
import type { PickedPhoto } from "./photo-picker";

const postPhotoUpload = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const appendGeo = vi.fn();
const h = vi.hoisted(() => {
  // Extend Blob so node's FormData.append accepts it as the file part.
  class File extends Blob { constructor(public uri: string) { super([]); } }
  return { File };
});
vi.mock("expo-file-system", () => ({ File: h.File }));
vi.mock("./api", () => ({ API_BASE_URL: "http://api" }));
vi.mock("./photo-upload-post", () => ({
  postPhotoUpload: (...a: unknown[]) => postPhotoUpload(...a),
  appendGeo: (...a: unknown[]) => appendGeo(...a),
}));

const lastCall = () => postPhotoUpload.mock.calls.at(-1) as [string, Record<string, string> | undefined, FormData];
afterEach(() => vi.clearAllMocks());

describe("uploadCollectionProof", () => {
  it("posts to the proof endpoint with a bearer header and geo", async () => {
    await uploadCollectionProof("col1", "file://dir/receipt.jpg", "tok", { latitude: 1 });
    const [url, headers, form] = lastCall();
    expect(url).toBe("http://api/collections/col1/proof");
    expect(headers).toEqual({ Authorization: "Bearer tok" });
    expect((form.get("photo") as File).name).toBe("receipt.jpg"); // filename derived from the uri
    expect(appendGeo).toHaveBeenCalledWith(form, { latitude: 1 });
  });
  it("omits the auth header when there's no token", async () => {
    await uploadCollectionProof("col1", "file://dir/receipt.jpg", null);
    expect(lastCall()[1]).toBeUndefined();
  });
  it("falls back to a default filename when the uri has no basename", async () => {
    await uploadCollectionProof("col1", "dir/", "tok");
    expect((lastCall()[2].get("photo") as File).name).toBe("proof.jpg");
  });
});

describe("uploadDeliveryPhoto", () => {
  it("includes kind and stopId when a stop is given", async () => {
    await uploadDeliveryPhoto("run1", "file://o.jpg", "delivery", "stop9", "tok");
    const [url, , form] = lastCall();
    expect(url).toBe("http://api/deliveries/runs/run1/photos");
    expect(form.get("kind")).toBe("delivery");
    expect(form.get("stopId")).toBe("stop9");
  });
  it("omits stopId for an odometer shot and defaults the filename", async () => {
    await uploadDeliveryPhoto("run1", "dir/", "start_odometer", null, null);
    expect(lastCall()[2].has("stopId")).toBe(false);
    expect((lastCall()[2].get("photo") as File).name).toBe("photo.jpg");
  });
});

describe("uploadCustomerPhoto", () => {
  it("defaults the category to market_intelligence and forwards the photo geo", async () => {
    const photo: PickedPhoto = { uri: "file://p.jpg", name: "p.jpg", type: "image/jpeg", latitude: 2 };
    await uploadCustomerPhoto("c1", photo, "tok");
    const [url, , form] = lastCall();
    expect(url).toBe("http://api/customers/c1/photos");
    expect(form.get("category")).toBe("market_intelligence");
    expect(appendGeo).toHaveBeenCalledWith(form, photo);
  });
  it("accepts an explicit customer category and omits the header without a token", async () => {
    await uploadCustomerPhoto("c1", { uri: "f", name: "f", type: "image/jpeg" }, null, "customer");
    expect(lastCall()[2].get("category")).toBe("customer");
    expect(lastCall()[1]).toBeUndefined();
  });
});
