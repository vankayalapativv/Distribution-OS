import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./sync-core.test-support";
import { sendCollection } from "./sync-send-collection";
import type { SyncQueueItem } from "./sync-core";

const apiFetch = vi.fn();
const uploadCollectionProof = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const deleteProofPhoto = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./photo-upload", () => ({ uploadCollectionProof: (...a: unknown[]) => uploadCollectionProof(...a) }));
vi.mock("./photo-files", () => ({ deleteProofPhoto: (...a: unknown[]) => deleteProofPhoto(...a) }));

const CUID = "coll-uuid-1";
function seedCollection(db: ReturnType<typeof freshDb>, over: Partial<{ proof_photo_path: string | null; proof_uploaded: number }> = {}) {
  db.run(
    `insert into collections (client_uuid, customer_id, collection_date, payment_mode, collection_amount, created_at, proof_photo_path, proof_uploaded, latitude, longitude, geocoded_address)
     values (?, 'c', '2026-08-05', 'cash', 100, 1, ?, ?, 17.25, 80.15, 'MG Road')`,
    [CUID, over.proof_photo_path === undefined ? "file:///proof.jpg" : over.proof_photo_path, over.proof_uploaded ?? 0],
  );
}
const item: SyncQueueItem = { id: 1, clientUuid: CUID, entityType: "collection", payload: { amount: 100 }, attempts: 0 };

afterEach(() => vi.clearAllMocks());

describe("sendCollection", () => {
  it("POSTs the collection then uploads the proof with its stamped geo", async () => {
    const db = freshDb();
    seedCollection(db);
    apiFetch.mockResolvedValue({ id: "srv-c" });

    const res = await sendCollection(item, db, "tok");
    expect(res).toEqual({ id: "srv-c" });
    expect(apiFetch).toHaveBeenCalledWith("/collections", { method: "POST", body: { amount: 100 }, token: "tok" });
    expect(uploadCollectionProof).toHaveBeenCalledWith("srv-c", "file:///proof.jpg", "tok", {
      latitude: 17.25, longitude: 80.15, address: "MG Road",
    });
    expect(db.first<{ proof_uploaded: number }>("select proof_uploaded from collections where client_uuid=?", [CUID])?.proof_uploaded).toBe(1);
    expect(deleteProofPhoto).toHaveBeenCalledWith("file:///proof.jpg");
  });

  it("skips the proof upload when the server returns no id", async () => {
    const db = freshDb();
    seedCollection(db);
    apiFetch.mockResolvedValue({});
    await sendCollection(item, db, "tok");
    expect(uploadCollectionProof).not.toHaveBeenCalled();
  });

  it("skips the proof upload when there is no proof photo", async () => {
    const db = freshDb();
    seedCollection(db, { proof_photo_path: null });
    apiFetch.mockResolvedValue({ id: "srv-c" });
    await sendCollection(item, db, "tok");
    expect(uploadCollectionProof).not.toHaveBeenCalled();
  });

  it("skips the proof upload when it was already uploaded", async () => {
    const db = freshDb();
    seedCollection(db, { proof_uploaded: 1 });
    apiFetch.mockResolvedValue({ id: "srv-c" });
    await sendCollection(item, db, "tok");
    expect(uploadCollectionProof).not.toHaveBeenCalled();
  });

  it("passes undefined geo when the stamp coordinates/address are absent", async () => {
    const db = freshDb();
    db.run(
      `insert into collections (client_uuid, customer_id, collection_date, payment_mode, collection_amount, created_at, proof_photo_path, proof_uploaded)
       values (?, 'c', '2026-08-05', 'cash', 100, 1, 'file:///p.jpg', 0)`,
      [CUID],
    );
    apiFetch.mockResolvedValue({ id: "srv-c" });
    await sendCollection(item, db, "tok");
    expect(uploadCollectionProof).toHaveBeenCalledWith("srv-c", "file:///p.jpg", "tok", {
      latitude: undefined, longitude: undefined, address: undefined,
    });
  });
});
