import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CodeEditField,
  PhoneEditField,
  SegmentPicker,
  last10,
  splitSegments,
} from "./customer-edit-fields";
import { CUSTOMER_SEGMENTS } from "./customer-segment-picker";

describe("splitSegments", () => {
  it("splits, trims and drops blanks", () => {
    expect(splitSegments("Car, 2W ,, 3W")).toEqual(["Car", "2W", "3W"]);
  });
  it("returns [] for null", () => {
    expect(splitSegments(null)).toEqual([]);
  });
});

describe("last10", () => {
  it("strips non-digits and keeps the last 10", () => {
    expect(last10("+91 98765-43210")).toBe("9876543210");
  });
  it("returns '' for null", () => {
    expect(last10(null)).toBe("");
  });
});

describe("PhoneEditField", () => {
  it("prefills and sanitizes to 10 digits on input", () => {
    render(<PhoneEditField label="Phone" name="phone" defaultValue="9876543210" />);
    const input = screen.getByLabelText("Phone") as HTMLInputElement;
    expect(input.value).toBe("9876543210");
    fireEvent.input(input, { target: { value: "12ab34567890123" } });
    expect(input.value).toBe("1234567890");
  });
});

describe("CodeEditField", () => {
  it("uppercases and strips non-alphanumerics (no dash)", () => {
    render(<CodeEditField label="PAN" name="pan" length={10} defaultValue="" />);
    const input = screen.getByLabelText("PAN") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "aa-cr5055k99" } });
    expect(input.value).toBe("AACR5055K9");
  });
  it("keeps dashes when allowDash is set", () => {
    render(<CodeEditField label="Udyam" name="udyam" length={19} defaultValue="" allowDash />);
    const input = screen.getByLabelText("Udyam") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "udyam-ts-00#0000000" } });
    expect(input.value).toBe("UDYAM-TS-000000000");
  });
});

describe("SegmentPicker", () => {
  it("renders the label and every segment, toggling on click", () => {
    const setSegments = vi.fn();
    render(<SegmentPicker segments={["Car"]} setSegments={setSegments} />);
    expect(screen.getByText(/Segment/)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(CUSTOMER_SEGMENTS.length);
    fireEvent.click(screen.getByRole("button", { name: "2W" }));
    expect(setSegments.mock.calls[0][0](["Car"])).toEqual(["Car", "2W"]);
  });
});
