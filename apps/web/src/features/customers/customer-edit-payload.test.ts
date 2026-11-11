import { describe, expect, it } from "vitest";
import { buildEditPayload } from "./customer-edit-payload";

describe("buildEditPayload", () => {
  it("maps form fields and joins segments", () => {
    const fd = new FormData();
    fd.set("legalName", "Raj Motors");
    fd.set("phone", "9876543210");
    fd.set("creditDays", "30");
    fd.set("addressLandmark", "Near temple");

    const body = buildEditPayload(fd, { customerType: "retail", segments: ["Car", "2W"] });
    expect(body.legalName).toBe("Raj Motors");
    expect(body.customerType).toBe("retail");
    expect(body.segment).toBe("Car,2W");
    expect(body.phone).toBe("+919876543210");
    expect(body.creditDays).toBe(30);
    expect(body.addressLandmark).toBe("Near temple");
  });

  it("sends a null segment when none are selected", () => {
    const body = buildEditPayload(new FormData(), { customerType: "retail", segments: [] });
    expect(body.segment).toBeNull();
    expect(body.legalName).toBeNull();
  });
});
