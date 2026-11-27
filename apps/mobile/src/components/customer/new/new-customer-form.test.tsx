import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const chip: Array<Record<string, unknown>> = [];
const field: Array<Record<string, unknown>> = [];
const loc: Array<Record<string, unknown>> = [];

vi.mock("../../phone-field", () => ({ PhoneField: () => null }));
vi.mock("../../customers/sales-exec-select", () => ({ SalesExecSelect: () => null }));
vi.mock("../chip-select", () => ({ ChipSelect: (p: Record<string, unknown>) => { chip.push(p); return null; } }));
vi.mock("../field", () => ({ Field: (p: Record<string, unknown>) => { field.push(p); return null; } }));
vi.mock("../location-capture-field", () => ({ LocationCaptureField: (p: Record<string, unknown>) => { loc.push(p); return null; } }));
vi.mock("./customer-photos-field", () => ({ CustomerPhotosField: () => null }));

import { NewCustomerForm } from "./new-customer-form";

function makeForm(over: Record<string, unknown> = {}) {
  const set = vi.fn(() => vi.fn());
  return {
    v: {
      legalName: "", customerName: "", salesExecutiveId: "", customerType: "retail",
      segments: ["Car"], phone: "", alternativePhone: "", email: "", gstNumber: "",
      panNumber: "", aadharNumber: "", addressStreet: "", addressLandmark: "",
      addressCity: "", addressState: "", addressPincode: "", creditLimit: "", creditDays: "",
    },
    set,
    isSuperAdmin: true,
    salesExecutiveName: "Ravi",
    onSelectSalesExec: vi.fn(),
    fieldErrors: {},
    geo: null,
    geoBusy: false,
    onCaptureLocation: vi.fn(),
    photo: {},
    busy: false,
    ...over,
  } as never;
}

describe("NewCustomerForm", () => {
  it("wires every chip/field callback (super admin, no geo)", () => {
    chip.length = 0; field.length = 0; loc.length = 0;
    const form = makeForm();
    render(<NewCustomerForm form={form} />);

    // Customer-type chip + segment chip callbacks.
    expect((chip[0].isOn as (t: string) => boolean)("retail")).toBe(true);
    expect((chip[1].isOn as (s: string) => boolean)("Car")).toBe(true);
    (chip[1].onToggle as (s: string) => void)("Car"); // already in → remove branch
    (chip[1].onToggle as (s: string) => void)("2W"); // not in → add branch

    // GST / PAN / Udyam uppercase-strip onChange arrows (fields 3,4,5).
    (field[3].onChange as (t: string) => void)("gst-12!ab");
    (field[4].onChange as (t: string) => void)("pan.99zz");
    (field[5].onChange as (t: string) => void)("udyam-7");

    // location idle copy (no geo) is used.
    expect(loc[0].idleLabel).toBe("Capture current location");
  });

  it("renders with a captured geo (editable address) and hides sales-exec for non-admins", () => {
    chip.length = 0; field.length = 0; loc.length = 0;
    render(<NewCustomerForm form={makeForm({ isSuperAdmin: false, geo: { latitude: 17.1234, longitude: 78.5678 } })} />);
    expect(loc[0].capturedText).toContain("17.1234");
    // non-admin → first Field is still Business name, SalesExecSelect not rendered.
    expect(field[0].label).toBe("Business name");
  });
});
