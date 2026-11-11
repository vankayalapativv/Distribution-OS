import { describe, expect, it, vi } from "vitest";
import { getCollectionProof, uploadCollectionProof } from "./collection-proofs";
import { makeSql, calledTag } from "../test/sql-mock";

const bucket = () => ({ put: vi.fn().mockResolvedValue(undefined), get: vi.fn() });
const file = (over = {}) => ({ type: "image/jpeg", size: 100, arrayBuffer: async () => new ArrayBuffer(4), ...over }) as unknown as File;
const CTX = { userId: "u1", role: "SUPER_ADMIN" as const };

describe("uploadCollectionProof", () => {
  it("rejects bad type / empty / oversize (422)", async () => {
    await expect(uploadCollectionProof(makeSql(), bucket() as never, CTX, "col1", file({ type: "text/plain" }))).rejects.toMatchObject({ status: 422 });
    await expect(uploadCollectionProof(makeSql(), bucket() as never, CTX, "col1", file({ size: 0 }))).rejects.toMatchObject({ status: 422 });
    await expect(uploadCollectionProof(makeSql(), bucket() as never, CTX, "col1", file({ size: 11 * 1024 * 1024 }))).rejects.toMatchObject({ status: 422 });
  });
  it("404s a missing collection and an SE's non-owned collection", async () => {
    await expect(uploadCollectionProof(makeSql({ get_collection_for_proof: [] }), bucket() as never, CTX, "x", file())).rejects.toMatchObject({ status: 404 });
    const sql = makeSql({ get_collection_for_proof: [{ id: "col1", collectedByUserId: "other" }] });
    await expect(uploadCollectionProof(sql, bucket() as never, { userId: "me", role: "SALES_EXECUTIVE" }, "col1", file())).rejects.toMatchObject({ status: 404 });
  });
  it("replays an existing proof without touching R2", async () => {
    const b = bucket();
    const sql = makeSql({ get_collection_for_proof: [{ id: "col1", collectedByUserId: "u1" }], get_existing_payment_proof: [{ id: "pp1", fileKey: "k", contentType: "image/jpeg", createdAt: "t" }] });
    const res = await uploadCollectionProof(sql, b as never, CTX, "col1", file());
    expect(res).toMatchObject({ existing: true });
    expect(b.put).not.toHaveBeenCalled();
  });
  it("stores a new proof", async () => {
    const b = bucket();
    const sql = makeSql({ get_collection_for_proof: [{ id: "col1", collectedByUserId: "u1" }], get_existing_payment_proof: [], create_payment_proof: [{ id: "pp1", collectionId: "col1", contentType: "image/jpeg", createdAt: "t" }] });
    const res = await uploadCollectionProof(sql, b as never, CTX, "col1", file({ type: "application/pdf" }));
    expect(res).toMatchObject({ existing: false, id: "pp1" });
    expect(b.put).toHaveBeenCalledOnce();
  });
});

describe("getCollectionProof", () => {
  it("streams it, or 404s a missing row / missing object", async () => {
    const b = { get: vi.fn().mockResolvedValue({ body: "STREAM" }) };
    expect(await getCollectionProof(makeSql({ get_collection_proof_file: [{ fileKey: "k", contentType: "image/png" }] }), b as never, "col1")).toMatchObject({ contentType: "image/png" });
    await expect(getCollectionProof(makeSql({ get_collection_proof_file: [{ fileKey: null }] }), b as never, "col1")).rejects.toMatchObject({ status: 404 });
    const gone = { get: vi.fn().mockResolvedValue(null) };
    await expect(getCollectionProof(makeSql({ get_collection_proof_file: [{ fileKey: "k", contentType: "" }] }), gone as never, "col1")).rejects.toMatchObject({ status: 404 });
  });
});
