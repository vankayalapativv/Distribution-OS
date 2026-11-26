import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSeCustomers } from "./customer-directory";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

afterEach(() => vi.clearAllMocks());

describe("fetchSeCustomers", () => {
  it("maps API rows to directory customers with name + address fallbacks", async () => {
    apiFetch.mockResolvedValue([
      { id: "1", customerCode: "C01", legalName: "Balaji Auto", customerName: "Balaji", phone: "900", addressStreet: "MG Rd", addressCity: "Khammam", latitude: null, longitude: null },
      { id: "2", customerCode: "C02", legalName: "", customerName: "City Garage", phone: null, addressStreet: null, addressCity: null, latitude: null, longitude: null },
      { id: "3", customerCode: "C03", legalName: "", customerName: null, phone: null, addressStreet: null, addressCity: "Guntur", latitude: null, longitude: null },
    ]);
    const out = await fetchSeCustomers("tok");
    expect(apiFetch).toHaveBeenCalledWith("/customers", { token: "tok" });
    expect(out[0]).toEqual({ id: "1", code: "C01", name: "Balaji Auto", phone: "900", address: "MG Rd, Khammam", city: "Khammam" });
    expect(out[1]).toMatchObject({ name: "City Garage", address: null, city: null }); // legalName empty → customerName
    expect(out[2]).toMatchObject({ name: "Customer", address: "Guntur" }); // both names empty → "Customer"
  });
});
