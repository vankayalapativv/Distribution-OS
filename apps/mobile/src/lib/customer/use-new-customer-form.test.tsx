import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNewCustomerForm } from "./use-new-customer-form";

const replace = vi.fn();
const randomUUID = vi.fn(() => "uuid-1");
const getCheckInFix = vi.fn();
const reverseGeocodeFix = vi.fn();
const computeCustomerErrors = vi.fn<(...a: unknown[]) => Record<string, string>>(() => ({}));
const submitNewCustomer = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve(null));
let role: string | null = "SALES_EXECUTIVE";
let userName: string | null = "Ravi";

vi.mock("expo-router", () => ({ router: { replace: (...a: unknown[]) => replace(...a) } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => randomUUID() }));
vi.mock("../auth", () => ({
  useAuth: (sel: (s: { token: string | null; user: { name: string | null; role: string | null } | null }) => unknown) =>
    sel({ token: "tok", user: { name: userName, role } }),
}));
vi.mock("../gps", () => ({
  getCheckInFix: (...a: unknown[]) => getCheckInFix(...a),
  reverseGeocodeFix: (...a: unknown[]) => reverseGeocodeFix(...a),
}));
vi.mock("./new-customer-validation", () => ({ computeCustomerErrors: (...a: unknown[]) => computeCustomerErrors(...a) }));
vi.mock("./submit-new-customer", () => ({ submitNewCustomer: (...a: unknown[]) => submitNewCustomer(...a) }));
vi.mock("./use-new-customer-errors", () => ({ useAutoClearCustomerErrors: () => undefined }));
vi.mock("./use-photo-staging", () => ({
  usePhotoStaging: () => ({ photos: [], setPhotos: vi.fn(), setUploadingUri: vi.fn() }),
}));

beforeEach(() => { role = "SALES_EXECUTIVE"; userName = "Ravi"; computeCustomerErrors.mockReturnValue({}); submitNewCustomer.mockResolvedValue(null); });
afterEach(() => vi.clearAllMocks());

describe("useNewCustomerForm basics", () => {
  it("flags Super Admin and updates fields via set()", () => {
    role = "SUPER_ADMIN";
    const { result } = renderHook(() => useNewCustomerForm());
    expect(result.current.isSuperAdmin).toBe(true);
    act(() => result.current.set("legalName")("Balaji"));
    expect(result.current.v.legalName).toBe("Balaji");
  });
  it("records the picked sales executive", () => {
    const { result } = renderHook(() => useNewCustomerForm());
    expect(result.current.isSuperAdmin).toBe(false);
    act(() => result.current.onSelectSalesExec("se1", "Meena"));
    expect(result.current.v.salesExecutiveId).toBe("se1");
    expect(result.current.salesExecutiveName).toBe("Meena");
  });
  it("tolerates a signed-out user name", () => {
    userName = null;
    const { result } = renderHook(() => useNewCustomerForm());
    expect(result.current.v.legalName).toBe("");
  });
});

describe("useNewCustomerForm.onSubmit", () => {
  it("blocks submit and shows the red banner when validation fails", async () => {
    computeCustomerErrors.mockReturnValue({ legalName: "Required" });
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onSubmit(); });
    expect(result.current.fieldErrors).toEqual({ legalName: "Required" });
    expect(result.current.error).toMatch(/required fields marked in red/);
    expect(submitNewCustomer).not.toHaveBeenCalled();
  });

  it("generates one idempotency key and navigates on a created customer", async () => {
    submitNewCustomer.mockResolvedValue({ id: "c9", legalName: "Balaji" });
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onSubmit(); });
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(submitNewCustomer).toHaveBeenCalledWith(expect.objectContaining({ token: "tok", clientUuid: "uuid-1" }));
    expect(replace).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c9", name: "Balaji" } });
    // A retry reuses the SAME key (no second UUID).
    await act(async () => { await result.current.onSubmit(); });
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("stays on the form when submit returns null (photo upload still pending)", async () => {
    submitNewCustomer.mockResolvedValue(null);
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onSubmit(); });
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces a submit failure (Error + non-Error)", async () => {
    submitNewCustomer.mockRejectedValueOnce(new Error("phone taken"));
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onSubmit(); });
    expect(result.current.error).toBe("phone taken");
    submitNewCustomer.mockRejectedValueOnce("boom");
    await act(async () => { await result.current.onSubmit(); });
    expect(result.current.error).toMatch(/Could not create the customer/);
  });

  it("ignores a re-entrant submit while one is in flight", async () => {
    let release!: () => void;
    submitNewCustomer.mockReturnValue(new Promise<null>((r) => { release = () => r(null); }));
    const { result } = renderHook(() => useNewCustomerForm());
    let first!: Promise<void>;
    act(() => { first = result.current.onSubmit(); }); // sets busy = true, awaits
    await act(async () => { await result.current.onSubmit(); }); // guarded out
    expect(submitNewCustomer).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });
});

describe("useNewCustomerForm.onCaptureLocation", () => {
  it("errors without a GPS fix", async () => {
    getCheckInFix.mockResolvedValue(null);
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.error).toMatch(/Could not get a GPS fix/);
    expect(result.current.geoBusy).toBe(false);
  });

  it("fills empty address fields from reverse geocode", async () => {
    getCheckInFix.mockResolvedValue({ latitude: 17, longitude: 78 });
    reverseGeocodeFix.mockResolvedValue({ city: "Hyderabad", state: "Telangana", pincode: "500081" });
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.geo).toEqual({ latitude: 17, longitude: 78 });
    expect(result.current.v.addressCity).toBe("Hyderabad");
    expect(result.current.v.addressState).toBe("Telangana");
    expect(result.current.v.addressPincode).toBe("500081");
  });

  it("keeps address fields the SE already typed", async () => {
    getCheckInFix.mockResolvedValue({ latitude: 17, longitude: 78 });
    reverseGeocodeFix.mockResolvedValue({ city: "Hyderabad", state: "Telangana", pincode: "500081" });
    const { result } = renderHook(() => useNewCustomerForm());
    act(() => { result.current.set("addressCity")("Secunderabad"); });
    act(() => { result.current.set("addressState")("AP"); });
    act(() => { result.current.set("addressPincode")("500003"); });
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.v.addressCity).toBe("Secunderabad");
    expect(result.current.v.addressState).toBe("AP");
    expect(result.current.v.addressPincode).toBe("500003");
  });

  it("leaves fields untouched when reverse geocode yields nothing", async () => {
    getCheckInFix.mockResolvedValue({ latitude: 1, longitude: 2 });
    reverseGeocodeFix.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useNewCustomerForm());
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.v.addressCity).toBe("");
    reverseGeocodeFix.mockResolvedValueOnce({ city: null, state: null, pincode: null });
    await act(async () => { await result.current.onCaptureLocation(); });
    expect(result.current.v.addressCity).toBe("");
  });
});
