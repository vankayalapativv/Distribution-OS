import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/photos", () => ({
  deletePhoto: vi.fn().mockResolvedValue(undefined),
  getPhotoStream: vi.fn().mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg" }),
  listCustomerPhotos: vi.fn().mockResolvedValue([]),
  uploadCustomerPhoto: vi.fn().mockResolvedValue({ id: "p1" }),
}));
vi.mock("../services/audit", () => ({ actorOf: () => ({}), logAudit: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => { vi.resetModules(); installAuth(); });
const app = () => import("../index").then((m) => m.default);
describe("photos — storage not configured", () => {
  it("500s the stream route when PHOTOS is missing", async () => {
    expect((await (await app()).request("/api/v1/photos/ph1", { headers: headers("manager") }, ENV)).status).toBe(500);
  });
});
