import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FulfillmentBadge,
  FULFILLMENT_TONES,
  FULFILLMENT_LABELS,
  STATUS_CLASSES,
} from "./order-fulfillment-badge";

describe("fulfillment palettes", () => {
  it("keeps tone + label keys in step (same ladder stages)", () => {
    expect(Object.keys(FULFILLMENT_TONES).sort()).toEqual(Object.keys(FULFILLMENT_LABELS).sort());
  });
  it("STATUS_CLASSES covers the order-status pill states", () => {
    expect(Object.keys(STATUS_CLASSES)).toContain("approved");
    expect(Object.keys(STATUS_CLASSES)).toContain("cancelled");
  });
});

describe("FulfillmentBadge", () => {
  it("renders the label + tone for a known stage", () => {
    render(<FulfillmentBadge status="partially_invoiced" />);
    const el = screen.getByText("Partially invoiced");
    expect(el.className).toContain("text-indigo-700");
  });

  it("defaults a null status to Ordered", () => {
    render(<FulfillmentBadge status={null} />);
    expect(screen.getByText("Ordered")).toBeInTheDocument();
  });

  it("shows the raw key + a muted tone for an unknown stage", () => {
    render(<FulfillmentBadge status="weird" />);
    const el = screen.getByText("weird");
    expect(el.className).toContain("bg-muted");
  });
});
