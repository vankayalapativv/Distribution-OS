import { describe, expect, it, vi } from "vitest";
import { listCustomerPhotos, uploadCustomerPhoto } from "./photos";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "u1", role: "SUPER_ADMIN" } as never;
const bucket = { put: vi.fn(), delete: vi.fn() } as never;
const file = (over = {}) => ({ type: "image/jpeg", size: 100, arrayBuffer: async () => new ArrayBuffer(4), ...over }) as unknown as File;

describe("photos validation", () => {
  it("uploadCustomerPhoto rejects bad type and oversize (before any DB)", async () => {
    await expect(uploadCustomerPhoto(makeSql(), bucket, CTX, "c1", file({ type: "application/pdf" }))).rejects.toMatchObject({ status: 422 });
    await expect(uploadCustomerPhoto(makeSql(), bucket, CTX, "c1", file({ size: 11 * 1024 * 1024 }))).rejects.toMatchObject({ status: 422 });
  });
  it("listCustomerPhotos rejects an unknown category", async () => {
    await expect(listCustomerPhotos(makeSql(), CTX, "c1", "bogus")).rejects.toMatchObject({ status: 422 });
  });
});
