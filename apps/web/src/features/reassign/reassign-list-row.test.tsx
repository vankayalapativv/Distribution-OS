import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReassignListRow } from "./reassign-list-row";
import type { ReassignCustomerRow } from "./reassign-api";

const cust = (over: Partial<ReassignCustomerRow> = {}): ReassignCustomerRow => ({
  id: "c1", legalName: "Balaji Auto", customerCode: "VD-C08", city: "Khammam",
  owner: { id: "o1", name: "Priya Field" }, recordCount: 112, ...over,
});

describe("ReassignListRow", () => {
  it("shows name, code·city, owner and count; fires onSelect; marks selected", () => {
    const onSelect = vi.fn();
    render(<ReassignListRow customer={cust()} selected onSelect={onSelect} />);
    expect(screen.getByText("Balaji Auto")).toBeInTheDocument();
    expect(screen.getByText("VD-C08 · Khammam")).toBeInTheDocument();
    expect(screen.getByText("Priya Field")).toBeInTheDocument();
    expect(screen.getByText("112")).toBeInTheDocument();
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalled();
  });

  it("handles no owner and missing code/city", () => {
    render(<ReassignListRow customer={cust({ owner: null, customerCode: null, city: null })} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText("— no owner —")).toBeInTheDocument();
    expect(screen.queryByText(/VD-C08/)).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
