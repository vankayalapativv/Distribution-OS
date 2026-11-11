import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FulfillmentTile } from "./order-fulfillment-tile";
import type { StageDef } from "./order-fulfillment-summary-groups";

const ordered: StageDef = { token: "ordered", label: "Ordered", key: "ordered" };
const delivered: StageDef = { token: "delivered", label: "Delivered", key: "delivered", emphasized: true };

afterEach(() => vi.restoreAllMocks());

describe("FulfillmentTile", () => {
  it("shows the label + value with the stage tint", () => {
    render(<FulfillmentTile stage={ordered} value={7} active="" onSelect={() => {}} />);
    expect(screen.getByText("Ordered")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("button").className).toContain("bg-slate-50");
  });

  it("selecting an inactive tile filters to its token", () => {
    const onSelect = vi.fn();
    render(<FulfillmentTile stage={ordered} value={7} active="" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("ordered");
  });

  it("clicking the active tile clears the filter and marks it pressed", () => {
    const onSelect = vi.fn();
    render(<FulfillmentTile stage={ordered} value={7} active="ordered" onSelect={onSelect} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toContain("ring-2");
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("emphasizes the Delivered value", () => {
    render(<FulfillmentTile stage={delivered} value={3} active="" onSelect={() => {}} />);
    expect(screen.getByText("3").className).toContain("text-2xl");
  });
});
