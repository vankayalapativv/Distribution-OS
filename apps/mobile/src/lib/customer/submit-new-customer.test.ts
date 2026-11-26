import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitNewCustomer } from "./submit-new-customer";
import { EMPTY_CUSTOMER, type CreatedCustomer } from "./new-customer";
import type { PickedPhoto } from "../photos";

const apiFetch = vi.fn();
const uploadCustomerPhoto = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../photos", () => ({ uploadCustomerPhoto: (...a: unknown[]) => uploadCustomerPhoto(...a) }));

const CUSTOMER: CreatedCustomer = { id: "cust-1", customerCode: "C01", legalName: "Balaji Auto" };
const photo = (uri: string) => ({ uri }) as PickedPhoto;

function opts(over: Partial<Parameters<typeof submitNewCustomer>[0]> = {}) {
  return {
    token: "tok",
    fields: { ...EMPTY_CUSTOMER, legalName: "  Balaji Auto ", customerName: "", phone: "9000000001", alternativePhone: "9000000002", segments: ["Car", "2W"], creditLimit: "5000", creditDays: "30", salesExecutiveId: "se-1", email: " a@b.com " },
    isSuperAdmin: true,
    geo: { latitude: 17.25, longitude: 80.15 },
    createdRef: { current: null as CreatedCustomer | null },
    clientUuid: "uuid-1",
    photos: [] as PickedPhoto[],
    setUploadingUri: vi.fn(),
    setPhotos: vi.fn(),
    setError: vi.fn(),
    ...over,
  };
}

beforeEach(() => { apiFetch.mockResolvedValue(CUSTOMER); });
afterEach(() => vi.clearAllMocks());

describe("submitNewCustomer", () => {
  it("creates the customer with a normalized body then returns it", async () => {
    const o = opts();
    const res = await submitNewCustomer(o);
    expect(res).toBe(CUSTOMER);
    expect(o.createdRef.current).toBe(CUSTOMER);
    const body = (apiFetch.mock.calls.at(-1)![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      clientUuid: "uuid-1", legalName: "Balaji Auto", customerName: null,
      segment: "Car,2W", phone: "+919000000001", alternativePhone: "+919000000002", email: "a@b.com",
      creditLimit: 5000, creditDays: 30, salesExecutiveId: "se-1",
      latitude: 17.25, longitude: 80.15,
    });
  });

  it("does not create again when the ref already holds the customer", async () => {
    const o = opts({ createdRef: { current: CUSTOMER }, photos: [photo("file://a.jpg")] });
    await submitNewCustomer(o);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(uploadCustomerPhoto).toHaveBeenCalledWith("cust-1", { uri: "file://a.jpg" }, "tok", "customer");
  });

  it("uploads every staged photo, pruning as it goes", async () => {
    const o = opts({ photos: [photo("a"), photo("b")] });
    await submitNewCustomer(o);
    expect(uploadCustomerPhoto).toHaveBeenCalledTimes(2);
    expect(o.setPhotos).toHaveBeenLastCalledWith([]);
    expect(o.setUploadingUri).toHaveBeenLastCalledWith(null);
  });

  it("keeps the record and surfaces an error when a photo upload fails", async () => {
    uploadCustomerPhoto.mockRejectedValueOnce(new Error("offline"));
    const o = opts({ photos: [photo("a"), photo("b")] });
    expect(await submitNewCustomer(o)).toBeNull();
    expect(o.setError).toHaveBeenCalledWith(expect.stringMatching(/Customer saved, but a photo failed/));
    expect(uploadCustomerPhoto).toHaveBeenCalledTimes(1); // stopped at the failure
  });

  it("omits the SE assignment for a non-super-admin and nulls a missing geo", async () => {
    const o = opts({ isSuperAdmin: false, geo: null });
    await submitNewCustomer(o);
    const body = (apiFetch.mock.calls.at(-1)![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ salesExecutiveId: null, latitude: null, longitude: null });
  });

  it("maps blank optional fields to null", async () => {
    const o = opts({ fields: { ...EMPTY_CUSTOMER, legalName: "X" } }); // all optionals empty
    await submitNewCustomer(o);
    const body = (apiFetch.mock.calls.at(-1)![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ phone: null, email: null, creditLimit: null, creditDays: null, addressStreet: null });
  });
});
