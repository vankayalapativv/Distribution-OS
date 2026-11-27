import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const chip: Array<Record<string, unknown>> = [];
const field: Array<Record<string, unknown>> = [];
const phoneP: Array<Record<string, unknown>> = [];
const loc: Array<Record<string, unknown>> = [];

const useEditCustomerForm = vi.fn();
vi.mock("../../../lib/customer/use-edit-customer-form", () => ({
  useEditCustomerForm: (...a: unknown[]) => useEditCustomerForm(...a),
}));
vi.mock("../../../lib/use-bottom-inset", () => ({ useBottomInset: () => 12 }));
vi.mock("../../phone-field", () => ({ PhoneField: (p: Record<string, unknown>) => { phoneP.push(p); return null; } }));
vi.mock("../chip-select", () => ({ ChipSelect: (p: Record<string, unknown>) => { chip.push(p); return null; } }));
vi.mock("../field", () => ({ Field: (p: Record<string, unknown>) => { field.push(p); return null; } }));
vi.mock("../location-capture-field", () => ({ LocationCaptureField: (p: Record<string, unknown>) => { loc.push(p); return null; } }));
vi.mock("./customer-photos-editor", () => ({ CustomerPhotosEditor: () => null }));

import { EditForm } from "./edit-customer-form";

function makeF(over: Record<string, unknown> = {}) {
  return {
    phone: "", setPhone: vi.fn(), error: null, setError: vi.fn(),
    segments: ["Car"], setSegments: vi.fn(),
    geo: null, geoBusy: false, onCaptureLocation: vi.fn(),
    addressStreet: "", setAddressStreet: vi.fn(),
    addressLandmark: "", setAddressLandmark: vi.fn(),
    addressCity: "", setAddressCity: vi.fn(),
    addressState: "", setAddressState: vi.fn(),
    addressPincode: "", setAddressPincode: vi.fn(),
    clearFieldError: vi.fn(),
    fieldErrors: {},
    photos: {}, token: "t",
    saved: false, busy: false, onSave: vi.fn(),
    ...over,
  };
}

const render_ = (f: ReturnType<typeof makeF>) => {
  chip.length = 0; field.length = 0; phoneP.length = 0; loc.length = 0;
  useEditCustomerForm.mockReturnValue(f);
  return render(<EditForm id="c1" token="t" initial={{} as never} />);
};

describe("EditForm", () => {
  it("wires phone / segment / address callbacks and saves (no error)", () => {
    const f = makeF();
    render_(f);
    (phoneP[0].onChange as (d: string) => void)("9998887776");
    expect(f.setPhone).toHaveBeenCalledWith("9998887776");
    expect(f.setError).not.toHaveBeenCalled(); // no error → no clear

    expect((chip[0].isOn as (s: string) => boolean)("Car")).toBe(true);
    (chip[0].onToggle as (s: string) => void)("Car"); // included → remove
    (chip[0].onToggle as (s: string) => void)("2W"); // not included → add
    expect(f.setSegments).toHaveBeenCalledTimes(2);

    (loc[0].onPress as () => void)(); // re-capture location
    expect(f.onCaptureLocation).toHaveBeenCalled();

    (field[0].onChange as (t: string) => void)("New St"); // street
    (field[2].onChange as (t: string) => void)("Hyd"); // city
    (field[4].onChange as (t: string) => void)("500001"); // pincode
    expect(f.clearFieldError).toHaveBeenCalledWith("street");
    expect(f.clearFieldError).toHaveBeenCalledWith("city");
    expect(f.clearFieldError).toHaveBeenCalledWith("pincode");

    fireEvent.click(screen.getByText("Save changes"));
    expect(f.onSave).toHaveBeenCalled();
  });

  it("clears the error on phone/segment edits when one is present", () => {
    const f = makeF({ error: "Something went wrong" });
    render_(f);
    (phoneP[0].onChange as (d: string) => void)("1");
    (chip[0].onToggle as (s: string) => void)("3W");
    expect(f.setError).toHaveBeenCalledWith(null);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument(); // error banner
  });

  it("shows a spinner while busy and the saved banner, with editable address when geo set", () => {
    const f = makeF({ busy: true, saved: true, geo: { latitude: 1.2345, longitude: 6.789 } });
    render_(f);
    expect(screen.getByText("Customer updated.")).toBeInTheDocument();
    expect(screen.queryByText("Save changes")).not.toBeInTheDocument(); // busy → spinner
    expect(loc[0].capturedText).toContain("1.2345");
    expect(field[0].editable).toBe(true); // geo set → street editable
  });
});
