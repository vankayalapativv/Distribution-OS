import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import type { SuperAdminSetupUser } from "./super-admin-types";

// Mock the kebab so we can fire each action and assert the callback + user.
vi.mock("./super-admin-user-actions-menu", () => ({
  UserActionsMenu: (p: {
    user: SuperAdminSetupUser;
    isSelf: boolean;
    onEdit: () => void;
    onSetPassword: () => void;
    onToggleStatus: () => void;
    onManageSessions: () => void;
  }) => (
    <div>
      <span>self:{String(p.isSelf)}</span>
      <button onClick={p.onEdit}>edit</button>
      <button onClick={p.onSetPassword}>pw</button>
      <button onClick={p.onToggleStatus}>status</button>
      <button onClick={p.onManageSessions}>sessions</button>
    </div>
  ),
}));

import { buildUserColumns, userColumns } from "./users-columns";

const user = (over: Partial<SuperAdminSetupUser> = {}): SuperAdminSetupUser => ({
  id: "u1", name: "Asha Rao", email: "asha@x.com", phone: "999",
  status: "active", appLoginId: null, roles: ["MANAGER"], ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cellOf = (cols: ColumnDef<SuperAdminSetupUser>[], id: string, u: SuperAdminSetupUser, getValue?: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render(<>{(cols.find((c) => (c as any).id === id || (c as any).accessorKey === id)!.cell as any)({ row: { original: u }, getValue })}</>);

describe("buildUserColumns", () => {
  it("renders the avatar initials (two words), falling back to ? for a blank name", () => {
    const cols = buildUserColumns();
    cellOf(cols, "name", user());
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    cellOf(cols, "name", user({ name: "   " }));
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders contact with em-dash fallbacks for missing email/phone", () => {
    cellOf(buildUserColumns(), "contact", user({ email: null, phone: null }));
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("renders a primary-tinted badge for SUPER_ADMIN, a muted one for others, and the raw code for an unknown role", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cellOf(buildUserColumns(), "role", user({ roles: ["SUPER_ADMIN", "LOGISTICS", "WEIRD" as any] }));
    const admin = screen.getByText("Super Admin");
    const logi = screen.getByText("Logistics");
    expect(admin.className).toContain("text-primary");
    expect(logi.className).toContain("text-muted-foreground");
    expect(screen.getByText("WEIRD")).toBeInTheDocument(); // unknown code → `?? role` fallback
  });

  it("renders the status badge", () => {
    cellOf(buildUserColumns(), "status", user({ status: "inactive" }), () => "inactive");
    expect(screen.getByText("inactive")).toBeInTheDocument();
  });

  it("wires each kebab action to its callback with the row; flags self", () => {
    const h = { onEdit: vi.fn(), onSetPassword: vi.fn(), onToggleStatus: vi.fn(), onManageSessions: vi.fn() };
    const u = user();
    cellOf(buildUserColumns({ currentUserId: "u1", ...h }), "actions", u);
    expect(screen.getByText("self:true")).toBeInTheDocument();
    fireEvent.click(screen.getByText("edit"));
    fireEvent.click(screen.getByText("pw"));
    fireEvent.click(screen.getByText("status"));
    fireEvent.click(screen.getByText("sessions"));
    expect(h.onEdit).toHaveBeenCalledWith(u);
    expect(h.onSetPassword).toHaveBeenCalledWith(u);
    expect(h.onToggleStatus).toHaveBeenCalledWith(u);
    expect(h.onManageSessions).toHaveBeenCalledWith(u);
  });

  it("default columns (no handlers) no-op on action clicks", () => {
    cellOf(userColumns, "actions", user());
    expect(() => {
      fireEvent.click(screen.getByText("edit"));
      fireEvent.click(screen.getByText("pw"));
      fireEvent.click(screen.getByText("status"));
      fireEvent.click(screen.getByText("sessions"));
    }).not.toThrow();
    expect(screen.getByText("self:false")).toBeInTheDocument();
  });
});
