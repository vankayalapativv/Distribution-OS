import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/lib/api-client", () => ({
  errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb),
}));

import { SetPasswordDialog } from "./super-admin-password-dialog";

const user = (over: Partial<SuperAdminSetupUser> = {}): SuperAdminSetupUser => ({
  id: "u1", name: "Asha", email: null, phone: null, status: "active", appLoginId: "neon-1", roles: [], ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("SetPasswordDialog", () => {
  it("renders nothing without a user", () => {
    const { container } = render(<SetPasswordDialog user={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rejects a local-password account that isn't linked to Neon Auth", async () => {
    render(<SetPasswordDialog user={user({ appLoginId: null })} onClose={vi.fn()} />);
    fireEvent.submit(screen.getByRole("button", { name: "Set password" }).closest("form")!);
    expect(await screen.findByText(/isn't linked to Neon Auth/)).toBeInTheDocument();
  });

  it("generates a password into the field", () => {
    render(<SetPasswordDialog user={user()} onClose={vi.fn()} />);
    const input = screen.getByLabelText("New password") as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(input.value.length).toBeGreaterThanOrEqual(8);
  });

  it("sets a password via the BFF, shows it, copies it, and closes via Done", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ password: "Secret123" }), { status: 200 }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onClose = vi.fn();
    render(<SetPasswordDialog user={user()} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText("Secret123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("Secret123");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("handles a success body with no password field (saved falls back to '')", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    render(<SetPasswordDialog user={user()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    // saved === "" is falsy, so the success panel doesn't render and no error appears.
    await waitFor(() => expect(screen.queryByText(/Could not set/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
  });

  it("surfaces a BFF error (with the generic fallback)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    render(<SetPasswordDialog user={user()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText("Could not set the password.")).toBeInTheDocument();
  });

  it("closes on Cancel, Done (after save) and onOpenChange(false)", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<SetPasswordDialog user={user()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "dlg-close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    // The reset effect fires when the user prop changes.
    rerender(<SetPasswordDialog user={user({ id: "u2" })} onClose={onClose} />);
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });
});
