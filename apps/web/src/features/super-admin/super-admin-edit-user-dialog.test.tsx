import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SuperAdminSetupUser } from "./super-admin-types";

vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Dialog: ({ onOpenChange, children }: any) => (
    <div>{children}<button onClick={() => onOpenChange(false)}>dlg-close</button></div>
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
  DialogBody: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: (p: any) => (
    <div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {p.items.map((o: any) => (
        <button key={p.getKey(o)} onClick={() => p.onSelect(p.getKey(o))}>{`pick-${p.getLabel(o)}`}</button>
      ))}
      <button onClick={() => p.onSelect("")}>pick-empty</button>
    </div>
  ),
}));
vi.mock("@/lib/api-client", () => ({
  errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb),
}));
const save = vi.fn();
vi.mock("./super-admin-save-user", () => ({ saveSuperAdminUser: (...a: unknown[]) => save(...a) }));

import { EditUserDialog } from "./super-admin-edit-user-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const user = (over: Partial<SuperAdminSetupUser> = {}): SuperAdminSetupUser => ({
  id: "u1", name: "Asha", email: "a@x.com", phone: "9", status: "active", appLoginId: null, roles: ["MANAGER"], ...over,
});

describe("EditUserDialog", () => {
  it("renders nothing without a user", () => {
    const { container } = render(<EditUserDialog user={null} onClose={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("prefills from the user, falling back to blank email/phone", () => {
    render(<EditUserDialog user={user({ email: null, phone: null })} onClose={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Asha");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Phone")).toHaveValue("");
  });
  it("saves the edited fields then calls onSaved + onClose", async () => {
    save.mockResolvedValueOnce({ id: "u1", name: "Asha B", email: null, phone: null, status: "inactive" });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<EditUserDialog user={user()} onClose={onClose} onSaved={onSaved} actionConfig={cfg} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Asha B" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "  " } }); // → phone.trim() || null
    fireEvent.click(screen.getByText("pick-Inactive"));
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      expect.objectContaining({ name: "Asha B", email: null, status: "inactive" }),
      cfg,
    );
    expect(onSaved).toHaveBeenCalled();
  });
  it("falls the status back to active when the select clears", async () => {
    save.mockResolvedValueOnce({ status: "active" });
    const { container } = render(<EditUserDialog user={user({ status: "inactive" })} onClose={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    fireEvent.click(screen.getByText("pick-empty"));
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "active" }), cfg));
  });
  it("shows an error when saving fails", async () => {
    save.mockRejectedValueOnce(new Error("clash"));
    const { container } = render(<EditUserDialog user={user()} onClose={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("clash")).toBeInTheDocument();
  });
  it("disables Save when the name is blank and closes via Cancel / onOpenChange", () => {
    const onClose = vi.fn();
    render(<EditUserDialog user={user()} onClose={onClose} onSaved={vi.fn()} actionConfig={cfg} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "dlg-close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
