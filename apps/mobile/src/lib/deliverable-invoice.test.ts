import { afterEach, describe, expect, it, vi } from "vitest";
import { addressLine, openInMaps, type DeliverableInvoice } from "./deliverable-invoice";

const openURL = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("react-native", () => ({ Linking: { openURL: (...a: unknown[]) => openURL(...a) } }));

function inv(over: Partial<DeliverableInvoice> = {}): DeliverableInvoice {
  return {
    id: "i1",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-08-05",
    grandTotal: 1000,
    customerId: "c1",
    customerName: "Balaji Auto",
    customerCode: "C01",
    addressStreet: "12 MG Road",
    addressCity: "Khammam",
    latitude: null,
    longitude: null,
    ...over,
  };
}

afterEach(() => vi.clearAllMocks());

describe("addressLine", () => {
  it("joins street and city", () => {
    expect(addressLine(inv())).toBe("12 MG Road, Khammam");
  });
  it("drops missing parts", () => {
    expect(addressLine(inv({ addressCity: null }))).toBe("12 MG Road");
    expect(addressLine(inv({ addressStreet: null }))).toBe("Khammam");
    expect(addressLine(inv({ addressStreet: null, addressCity: null }))).toBe("");
  });
});

describe("openInMaps", () => {
  it("drops a pin at the saved coordinates when present", () => {
    openInMaps(inv({ latitude: 17.25, longitude: 80.15 }));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining("query=17.25,80.15"));
  });
  it("falls back to an address search without coordinates", () => {
    openInMaps(inv());
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("12 MG Road, Khammam")));
  });
  it("falls back to the customer name when there is no address", () => {
    openInMaps(inv({ addressStreet: null, addressCity: null }));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Balaji Auto")));
  });
  it("does nothing when there is nothing to search", () => {
    openInMaps(inv({ addressStreet: null, addressCity: null, customerName: null }));
    expect(openURL).not.toHaveBeenCalled();
  });
  it("swallows a failure to open the maps URL", () => {
    openURL.mockReturnValueOnce(Promise.reject(new Error("no maps")));
    expect(() => openInMaps(inv({ latitude: 1, longitude: 2 }))).not.toThrow();
  });
});
