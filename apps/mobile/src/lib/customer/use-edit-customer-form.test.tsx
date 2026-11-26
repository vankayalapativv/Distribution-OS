import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditCustomerForm, type CustomerDetail } from "./use-edit-customer-form";

const back = vi.fn();
const getCheckInFix = vi.fn();
const reverseGeocodeFix = vi.fn();
const saveCustomerEdit = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
let authUser: { name: string } | null = { name: "Ravi" };

vi.mock("expo-router", () => ({ router: { back: () => back() } }));
vi.mock("../../components/phone-field", () => ({ toLocalPhone: (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10) }));
vi.mock("../auth", () => ({ useAuth: (sel: (s: { user: { name: string } | null }) => unknown) => sel({ user: authUser }) }));
vi.mock("../gps", () => ({
  getCheckInFix: (...a: unknown[]) => getCheckInFix(...a),
  reverseGeocodeFix: (...a: unknown[]) => reverseGeocodeFix(...a),
}));
vi.mock("./save-customer-edit", () => ({ saveCustomerEdit: (...a: unknown[]) => saveCustomerEdit(...a) }));
vi.mock("./use-edit-photos", () => ({ useEditPhotos: () => ({ query: { data: [] }, photoBusy: false, onAddPhotos: vi.fn(), onDeletePhoto: vi.fn() }) }));

const base: CustomerDetail = {
  legalName: "Balaji Motors", phone: "9876543210", segment: "Car, 2W",
  addressStreet: "MG Rd", addressCity: "Hyd", addressState: "TG", addressPincode: "500001", addressLandmark: "Near park",
};
const setup = (initial: Partial<CustomerDetail> = {}) =>
  renderHook(() => useEditCustomerForm("c1", "tok", { ...base, ...initial }));

beforeEach(() => { vi.useFakeTimers(); authUser = { name: "Ravi" }; });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("useEditCustomerForm init", () => {
  it("seeds phone + segments from the initial detail", () => {
    const { result } = setup();
    expect(result.current.phone).toBe("9876543210");
    expect(result.current.segments).toEqual(["Car", "2W"]);
  });
  it("handles a null segment / blank address fields, a signed-out user and a null legal name", () => {
    authUser = null;
    const { result } = setup({ segment: null, legalName: null as unknown as string, addressStreet: null, addressCity: null, addressState: null, addressPincode: null, addressLandmark: null });
    expect(result.current.segments).toEqual([]);
    expect(result.current.addressStreet).toBe("");
  });
});

describe("useEditCustomerForm.validate via onSave", () => {
  it("flags missing street/city/pincode and does not save", async () => {
    const { result } = setup({ addressStreet: "", addressCity: "", addressPincode: "" });
    await act(async () => { await result.current.onSave(); });
    expect(result.current.fieldErrors).toEqual({ street: "Street is required.", city: "City is required.", pincode: "Pincode is required." });
    expect(saveCustomerEdit).not.toHaveBeenCalled();
  });
  it("clearFieldError removes a set error and no-ops when unset", () => {
    const { result } = setup({ addressStreet: "" });
    act(() => { result.current.onSave(); });
    act(() => result.current.clearFieldError("street"));
    expect(result.current.fieldErrors.street).toBeUndefined();
    const before = result.current.fieldErrors;
    act(() => result.current.clearFieldError("street")); // already clear → same object
    expect(result.current.fieldErrors).toBe(before);
  });
});

describe("useEditCustomerForm.onSave guards", () => {
  it("rejects an incomplete phone", async () => {
    const { result } = setup();
    act(() => result.current.setPhone("123"));
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/valid 10-digit/);
    expect(saveCustomerEdit).not.toHaveBeenCalled();
  });
  it("requires at least one segment", async () => {
    const { result } = setup({ segment: null });
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/at least one segment/);
  });
  it("saves, flags saved, and routes back after the delay", async () => {
    const { result } = setup();
    await act(async () => { await result.current.onSave(); });
    expect(saveCustomerEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", token: "tok" }));
    expect(result.current.saved).toBe(true);
    act(() => vi.advanceTimersByTime(700));
    expect(back).toHaveBeenCalled();
  });
  it("surfaces a save failure (Error + non-Error)", async () => {
    saveCustomerEdit.mockRejectedValueOnce(new Error("conflict"));
    const { result } = setup();
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toBe("conflict");
    saveCustomerEdit.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.onSave(); });
    expect(result.current.error).toMatch(/Could not save/);
  });
});

describe("useEditCustomerForm.onCaptureLocation", () => {
  it("errors when no GPS fix is available", async () => {
    getCheckInFix.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.error).toMatch(/Could not get a GPS fix/);
    expect(result.current.geoBusy).toBe(false);
  });
  it("captures the fix and backfills city/state/pincode from reverse geocode", async () => {
    getCheckInFix.mockResolvedValue({ latitude: 17.4, longitude: 78.5 });
    reverseGeocodeFix.mockResolvedValue({ city: "Hyderabad", state: "Telangana", pincode: "500081" });
    const { result } = setup();
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.geo).toEqual({ latitude: 17.4, longitude: 78.5 });
    expect(result.current.addressCity).toBe("Hyderabad");
    expect(result.current.addressState).toBe("Telangana");
    expect(result.current.addressPincode).toBe("500081");
  });
  it("keeps existing address fields when reverse geocode is empty/null", async () => {
    getCheckInFix.mockResolvedValue({ latitude: 1, longitude: 2 });
    reverseGeocodeFix.mockResolvedValueOnce(null);
    const { result } = setup();
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.addressCity).toBe("Hyd");
    reverseGeocodeFix.mockResolvedValueOnce({ city: null, state: null, pincode: null });
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.addressCity).toBe("Hyd");
  });
});
