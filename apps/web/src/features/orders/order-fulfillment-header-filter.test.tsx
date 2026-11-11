import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FulfillmentHeaderFilter } from "./order-fulfillment-header-filter";

afterEach(() => vi.restoreAllMocks());

describe("FulfillmentHeaderFilter", () => {
  it("renders the label and an inactive filter trigger when no value is set", () => {
    render(<FulfillmentHeaderFilter value="" onChange={() => {}} />);
    expect(screen.getByText("Fulfillment")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter fulfillment")).toHaveClass("text-muted-foreground/60");
  });

  it("marks the trigger active when a value is selected", () => {
    render(<FulfillmentHeaderFilter value="invoiced" onChange={() => {}} />);
    expect(screen.getByLabelText("Filter fulfillment")).toHaveClass("text-primary");
  });

  it("opens the menu and fires onChange with the picked value (stopping propagation)", () => {
    const onChange = vi.fn();
    render(<FulfillmentHeaderFilter value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Filter fulfillment"));
    fireEvent.click(screen.getByRole("button", { name: "Delivered" }));
    expect(onChange).toHaveBeenCalledWith("delivered");
  });

  it("shows a check against the currently-selected option", () => {
    render(<FulfillmentHeaderFilter value="ordered" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Filter fulfillment"));
    expect(screen.getByRole("button", { name: "Ordered" })).toHaveClass("text-primary");
  });

  it("clicking the menu surface (not an option) is swallowed and keeps it open", () => {
    const onChange = vi.fn();
    render(<FulfillmentHeaderFilter value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Filter fulfillment"));
    const content = screen.getByRole("button", { name: "All" }).parentElement!;
    fireEvent.click(content);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delivered" })).toBeInTheDocument();
  });
});
