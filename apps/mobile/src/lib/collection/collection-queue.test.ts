import { describe, expect, test, vi } from "vitest";
import { freshDb, NOW } from "../sync-core.test-support";
import { getQueueStats } from "../sync-core";
import { recordCollection } from "./collection-queue";
import type { PickedPhoto } from "../photos";

// Stub the photo file I/O (expo-file-system) — we only test the DB write here.
// (vi.mock is hoisted above the imports by vitest at transform time.)
vi.mock("../photo-files", () => ({
  persistProofPhoto: (clientUuid: string) => `file:///documents/proofs/${clientUuid}.jpg`,
}));

const CUST = "cust-1";
const COLL_UUID = "cccccccc-0000-4000-8000-000000000001";
const photo = {
  uri: "file:///cache/pick.jpg",
  latitude: 17.4,
  longitude: 78.5,
  address: "12 Market St",
  type: "image/jpeg",
} as unknown as PickedPhoto;

describe("offline collection queue", () => {
  test("recordCollection persists the proof, writes the row, and enqueues", () => {
    const db = freshDb();
    recordCollection(
      db,
      {
        clientUuid: COLL_UUID,
        customerId: CUST,
        collectionDate: "2026-10-14",
        paymentMode: "cash",
        collectionType: "general",
        collectionAmount: 500,
        paymentReferenceNumber: null,
        bankName: null,
        photo,
      },
      NOW,
    );

    const row = db.first<{
      collection_amount: number;
      proof_photo_path: string | null;
      proof_uploaded: number;
      latitude: number | null;
      geocoded_address: string | null;
    }>(
      "select collection_amount, proof_photo_path, proof_uploaded, latitude, geocoded_address from collections where client_uuid = ?",
      [COLL_UUID],
    );
    expect(row?.collection_amount).toBe(500);
    expect(row?.proof_photo_path).toBe(`file:///documents/proofs/${COLL_UUID}.jpg`);
    expect(row?.proof_uploaded).toBe(0);
    expect(row?.latitude).toBe(17.4);
    expect(row?.geocoded_address).toBe("12 Market St");
    expect(getQueueStats(db)).toEqual({ pending: 1, failed: 0 });
  });
});
