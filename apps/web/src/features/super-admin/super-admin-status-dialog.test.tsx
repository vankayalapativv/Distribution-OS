import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SuperAdminSetupUser } from "./super-admin-types";

vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Dialog: ({ onOpenChange, children }: any) => (
    <div>
      {children}
      <button onClick={() => onOpenChange(false)}>dlg-close</button>
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogContent: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

const save = vi.fn();
vi.mock("./super-admin-save-user", () => ({ saveSuperAdminUser: (...a: unknown[]) => save(...a) }));

import { StatusDialog } from "./super-admin-status-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const user = (over: Partial<SuperAdminSetupUser> = {}): SuperAdminSetupUser => ({
  id: "u1", name: "Asha", email: "a@x.com", phone: "9", status: "active", appLoginId: null, roles: ["MANAGER"], ...over,
});

describe("StatusDialog", () => {
  it("renders nothing without a user", () => {
    const { container } = render(<StatusDialog user={null} actionConfig={cfg} onClose={vi.fn()} onUpdated={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("deactivates an active user: saves the flipped status, then updates + closes", async () => {
    save.mockResolvedValueOnce({ status: "inactive" });
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    render(<StatusDialog user={user()} actionConfig={cfg} onClose={onClose} onUpdated={onUpdated} />);
    expect(screen.getByRole("heading", { name: /Deactivate Asha\?/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      expect.objectContaining({ status: "inactive" }),
      cfg,
    );
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }));
  });

  it("activates an inactive user", async () => {
    save.mockResolvedValueOnce({ status: "active" });
    render(<StatusDialog user={user({ status: "inactive" })} actionConfig={cfg} onClose={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Activate Asha\?/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "active" }), cfg));
  });

  it("shows an error when the save fails", async () => {
    save.mockRejectedValueOnce(new Error("nope"));
    render(<StatusDialog user={user()} actionConfig={cfg} onClose={vi.fn()} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("nope")).toBeInTheDocument();
  });

  it("closes on Cancel and on the dialog's onOpenChange(false)", () => {
    const onClose = vi.fn();
    render(<StatusDialog user={user()} actionConfig={cfg} onClose={onClose} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "dlg-close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
