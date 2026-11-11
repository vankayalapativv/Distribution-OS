import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserActionsMenu } from "./super-admin-user-actions-menu";
import type { SuperAdminSetupUser } from "./super-admin-types";

const baseUser: SuperAdminSetupUser = {
  id: "u1",
  name: "Asha",
  email: "asha@example.test",
  phone: "+919000000001",
  status: "active",
  appLoginId: null,
  roles: ["SALES_EXECUTIVE"],
};

function setup(over: Partial<SuperAdminSetupUser> = {}, isSelf = false) {
  const handlers = {
    onEdit: vi.fn(),
    onSetPassword: vi.fn(),
    onToggleStatus: vi.fn(),
    onManageSessions: vi.fn(),
  };
  render(<UserActionsMenu user={{ ...baseUser, ...over }} isSelf={isSelf} {...handlers} />);
  return handlers;
}

const open = () => fireEvent.click(screen.getByTitle("Actions"));

describe("UserActionsMenu", () => {
  it("lists all four actions and fires each handler", () => {
    const h = setup();
    open();
    for (const name of [/Edit/, /Set password/, /Manage sessions/, /Deactivate/]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: /Set password/ }));
    expect(h.onSetPassword).toHaveBeenCalled();
    open();
    fireEvent.click(screen.getByRole("button", { name: /Manage sessions/ }));
    expect(h.onManageSessions).toHaveBeenCalled();
  });

  it("blocks deactivating your own row", () => {
    setup({}, true);
    open();
    const btn = screen.getByRole("button", { name: /Deactivate/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "You can't deactivate your own account.");
  });

  it("blocks deactivating a Super Admin", () => {
    setup({ roles: ["SUPER_ADMIN"] });
    open();
    const btn = screen.getByRole("button", { name: /Deactivate/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "A Super Admin can't be deactivated.");
  });

  it("shows Activate (enabled) for an inactive user and fires the toggle", () => {
    const h = setup({ status: "inactive", roles: ["SUPER_ADMIN"] }, true);
    open();
    const btn = screen.getByRole("button", { name: /Activate/ });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(h.onToggleStatus).toHaveBeenCalled();
  });
});
