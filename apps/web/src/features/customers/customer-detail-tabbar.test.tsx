import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerDetailTabBar } from "./customer-detail-tabbar";

const tabs = [
  { key: "details", label: "Details", count: undefined },
  { key: "orders", label: "Orders", count: 3 },
];

describe("CustomerDetailTabBar", () => {
  it("marks the active tab, shows counts, and fires onSelect", () => {
    const onSelect = vi.fn();
    render(<CustomerDetailTabBar tabs={tabs} activeTab="details" onSelect={onSelect} />);

    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Orders/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("3")).toBeInTheDocument(); // count badge

    fireEvent.click(screen.getByRole("tab", { name: /Orders/ }));
    expect(onSelect).toHaveBeenCalledWith("orders");
  });
});
