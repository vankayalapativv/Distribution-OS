import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PermissionSwitch } from "./permission-switch";

describe("PermissionSwitch", () => {
  it("reflects the checked state and fires onToggle on click", () => {
    const onToggle = vi.fn();
    render(<PermissionSwitch checked label="Customers for Manager" changed={false} onToggle={onToggle} />);
    const sw = screen.getByRole("switch", { name: "Customers for Manager" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the off + changed variant", () => {
    render(<PermissionSwitch checked={false} label="Invoices for Manager" changed onToggle={() => {}} />);
    const sw = screen.getByRole("switch", { name: "Invoices for Manager" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw.className).toContain("ring-primary/40"); // changed ring
  });
});
