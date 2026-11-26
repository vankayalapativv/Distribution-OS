import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitCollection, type SubmitParams } from "./submit";
import type { PickedPhoto } from "../photos";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ id: "col1", collectionCode: "COL-1" }));
const uploadCollectionProof = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../day-flag", () => ({ istDate: () => "2026-11-27" }));
vi.mock("../photos", () => ({ uploadCollectionProof: (...a: unknown[]) => uploadCollectionProof(...a) }));

const photo = { uri: "file://p.jpg", name: "p.jpg", type: "image/jpeg", latitude: 17.4, longitude: 78.5, address: "MG Rd" } as PickedPhoto;
const onStatus = vi.fn();
function params(over: Partial<SubmitParams> = {}): SubmitParams {
  return {
    token: "tok", customerId: "c1", collectionType: "general", amountNum: 500,
    mode: "cash", reference: " ref-9 ", bankName: " HDFC ", photo, clientUuid: "uuid-1", onStatus, ...over,
  };
}
beforeEach(() => { apiFetch.mockResolvedValue({ id: "col1", collectionCode: "COL-1" }); });
afterEach(() => vi.clearAllMocks());

describe("submitCollection", () => {
  it("creates the collection (IST date, trimmed ref) then uploads the proof", async () => {
    expect(await submitCollection(params())).toBe("COL-1");
    const body = (apiFetch.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      customerId: "c1", collectionDate: "2026-11-27", paymentMode: "cash",
      collectionAmount: 500, paymentReferenceNumber: "ref-9", bankName: null, clientUuid: "uuid-1",
    });
    expect(uploadCollectionProof).toHaveBeenCalledWith("col1", "file://p.jpg", "tok", expect.objectContaining({ latitude: 17.4, address: "MG Rd" }));
    expect(onStatus).toHaveBeenCalledWith("Saving…");
    expect(onStatus).toHaveBeenCalledWith("Uploading receipt…");
  });

  it("keeps the bank name only for cheque payments", async () => {
    await submitCollection(params({ mode: "cheque" }));
    expect((apiFetch.mock.calls[0][1] as { body: { bankName: string | null } }).body.bankName).toBe("HDFC");
  });

  it("nulls a blank cheque bank name", async () => {
    await submitCollection(params({ mode: "cheque", bankName: "   " }));
    expect((apiFetch.mock.calls[0][1] as { body: { bankName: string | null } }).body.bankName).toBeNull();
  });

  it("sends a null reference when blank", async () => {
    await submitCollection(params({ reference: "   " }));
    expect((apiFetch.mock.calls[0][1] as { body: { paymentReferenceNumber: string | null } }).body.paymentReferenceNumber).toBeNull();
  });

  it("passes undefined geo fields through when the photo has none", async () => {
    await submitCollection(params({ photo: { uri: "file://x.jpg", name: "x", type: "image/jpeg" } as PickedPhoto }));
    expect(uploadCollectionProof).toHaveBeenCalledWith("col1", "file://x.jpg", "tok", { latitude: undefined, longitude: undefined, address: undefined });
  });

  it("wraps a proof-upload failure in a retry message", async () => {
    uploadCollectionProof.mockRejectedValue(new Error("network"));
    await expect(submitCollection(params())).rejects.toThrow(/Receipt saved failed to upload/);
  });

  it("propagates a create failure", async () => {
    apiFetch.mockRejectedValue(new Error("422 bad amount"));
    await expect(submitCollection(params())).rejects.toThrow("422 bad amount");
    expect(uploadCollectionProof).not.toHaveBeenCalled();
  });
});
