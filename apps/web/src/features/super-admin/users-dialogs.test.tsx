import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SuperAdminSetupUser } from "./super-admin-types";

// Each dialog mock surfaces its callbacks as buttons so we can assert wiring.
vi.mock("./super-admin-add-user-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AddUserDialog: (p: any) => (p.open ? <button onClick={p.onUserCreated}>add-created</button> : null),
}));
vi.mock("./super-admin-edit-user-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EditUserDialog: (p: any) => (p.user ? <div><button onClick={p.onSaved}>edit-saved</button><button onClick={p.onClose}>edit-close</button></div> : null),
}));
vi.mock("./super-admin-password-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SetPasswordDialog: (p: any) => (p.user ? <button onClick={p.onClose}>pw-close</button> : null),
}));
vi.mock("./super-admin-status-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StatusDialog: (p: any) => (p.user ? <div><button onClick={p.onUpdated}>status-updated</button><button onClick={p.onClose}>status-close</button></div> : null),
}));
vi.mock("./super-admin-sessions-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SessionsDialog: (p: any) => (p.user ? <button onClick={p.onClose}>sessions-close</button> : null),
}));

import { UsersDialogs } from "./users-dialogs";

const u = (id: string): SuperAdminSetupUser => ({
  id, name: id, email: null, phone: null, status: "active", appLoginId: null, roles: [],
});
const cfg = { apiBaseUrl: "x", authToken: "t" };

function renderDialogs(over: Partial<React.ComponentProps<typeof UsersDialogs>["state"]> = {}) {
  const fns = {
    setAddOpen: vi.fn(), setEditingUser: vi.fn(), setPasswordUser: vi.fn(),
    setStatusUser: vi.fn(), setSessionsUser: vi.fn(), onChanged: vi.fn(),
  };
  render(
    <UsersDialogs
      state={{ addOpen: false, addKey: 0, editingUser: null, passwordUser: null, statusUser: null, sessionsUser: null, ...over }}
      actionConfig={cfg}
      {...fns}
    />,
  );
  return fns;
}

describe("UsersDialogs", () => {
  it("wires Add → onChanged", () => {
    const fns = renderDialogs({ addOpen: true });
    fireEvent.click(screen.getByText("add-created"));
    expect(fns.onChanged).toHaveBeenCalled();
  });

  it("wires Edit save → onChanged and close → clears the editing user", () => {
    const fns = renderDialogs({ editingUser: u("e") });
    fireEvent.click(screen.getByText("edit-saved"));
    expect(fns.onChanged).toHaveBeenCalled();
    fireEvent.click(screen.getByText("edit-close"));
    expect(fns.setEditingUser).toHaveBeenCalledWith(null);
  });

  it("wires password close, status update + close, and sessions close", () => {
    const fns = renderDialogs({ passwordUser: u("p"), statusUser: u("s"), sessionsUser: u("x") });
    fireEvent.click(screen.getByText("pw-close"));
    expect(fns.setPasswordUser).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("status-updated"));
    expect(fns.onChanged).toHaveBeenCalled();
    fireEvent.click(screen.getByText("status-close"));
    expect(fns.setStatusUser).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("sessions-close"));
    expect(fns.setSessionsUser).toHaveBeenCalledWith(null);
  });
});
