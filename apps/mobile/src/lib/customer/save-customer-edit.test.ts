import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCustomerEdit } from "./save-customer-edit";

const apiFetch = vi.fn();
vi.mock("../../components/phone-field", () => ({ toStoredPhone: (p: string) => `stored:${p}` }));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

afterEach(() => vi.clearAllMocks());

const base = {
  id: "c1", token: "tok", phone: "9000000001", segments: ["Car", "2W"],
  addressStreet: " MG Road ", addressCity: "Khammam", addressState: "Telangana",
  addressPincode: "507002", addressLandmark: "Near temple",
  geo: { latitude: 17.25, longitude: 80.15 },
};

describe("saveCustomerEdit", () => {
  it("PATCHes the SE-editable fields, trimming and joining", async () => {
    await saveCustomerEdit(base);
    expect(apiFetch).toHaveBeenCalledWith("/customers/c1", {
      method: "PATCH",
      token: "tok",
      body: {
        phone: "stored:9000000001",
        segment: "Car,2W",
        addressStreet: "MG Road",
        addressCity: "Khammam",
        addressState: "Telangana",
        addressPincode: "507002",
        addressLandmark: "Near temple",
        latitude: 17.25,
        longitude: 80.15,
      },
    });
  });

  it("maps blank fields and a missing geo to null", async () => {
    await saveCustomerEdit({ ...base, addressStreet: "   ", addressCity: "", addressState: " ", addressPincode: "", addressLandmark: "  ", geo: null });
    const body = (apiFetch.mock.calls.at(-1)![1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ addressStreet: null, addressCity: null, addressState: null, addressPincode: null, addressLandmark: null, latitude: null, longitude: null });
  });
});
