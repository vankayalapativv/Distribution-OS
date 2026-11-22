/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SuperAdminSetupUser } from "./super-admin-types";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ onOpenChange, children }: any) => (
    <div>{children}<button onClick={() => onOpenChange(false)}>dlg-close</button></div>
  ),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogBody: ({ children }: any) => <div>{children}</div>,
}));
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
const sectionProps = vi.fn();
vi.mock("./super-admin-user-sessions", () => ({
  UserSessionsSection: (p: unknown) => {
    sectionProps(p);
    return <div>sessions-section</div>;
  },
}));
import { SessionsDialog } from "./super-admin-sessions-dialog";
const cfg = { apiBaseUrl: "x", authToken: "t" };
const user = (over: Partial<SuperAdminSetupUser> = {}): SuperAdminSetupUser => ({
  id: "u1", name: "Asha", email: null, phone: null, status: "active", appLoginId: "neon-1", roles: [], ...over,
});
afterEach(() => {
  apiRequest.mockReset();
  sectionProps.mockReset();
});
describe("SessionsDialog", () => {
  it("renders nothing without a user", () => {
    apiRequest.mockResolvedValue({ device: null });
    const { container } = render(<SessionsDialog user={null} actionConfig={cfg} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("fetches the device label and passes it to the sessions section for a managed login", async () => {
    apiRequest.mockResolvedValue({ device: { label: "Samsung SM-G991B" } });
    render(<SessionsDialog user={user()} actionConfig={cfg} onClose={vi.fn()} />);
    expect(screen.getByText("sessions-section")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(cfg, "GET", "/super-admin/users/u1/device");
    await waitFor(() =>
      expect(sectionProps).toHaveBeenLastCalledWith(expect.objectContaining({ appLoginId: "neon-1", deviceModel: "Samsung SM-G991B" })),
    );
  });
  it("passes a null deviceModel when the lookup returns no device", async () => {
    apiRequest.mockResolvedValue({ device: null });
    render(<SessionsDialog user={user()} actionConfig={cfg} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(sectionProps).toHaveBeenLastCalledWith(expect.objectContaining({ deviceModel: null })),
    );
  });
  it("passes null when the device has no label", async () => {
    apiRequest.mockResolvedValue({ device: {} });
    render(<SessionsDialog user={user()} actionConfig={cfg} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(sectionProps).toHaveBeenLastCalledWith(expect.objectContaining({ deviceModel: null })),
    );
  });
  it("ignores a device lookup that resolves after unmount (cancelled guard)", async () => {
    let resolve!: (v: { device: { label?: string } | null }) => void;
    apiRequest.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { unmount } = render(<SessionsDialog user={user()} actionConfig={cfg} onClose={vi.fn()} />);
    unmount(); // cancelled = true before the lookup settles
    resolve({ device: { label: "Samsung" } });
    await Promise.resolve();
    expect(sectionProps).not.toHaveBeenCalledWith(expect.objectContaining({ deviceModel: "Samsung" }));
  });
  it("tolerates a device-lookup failure (best-effort label)", async () => {
    apiRequest.mockRejectedValue(new Error("offline"));
    render(<SessionsDialog user={user()} actionConfig={cfg} onClose={vi.fn()} />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.getByText("sessions-section")).toBeInTheDocument();
  });
  it("shows the empty state for a local-password user (no appLoginId)", () => {
    apiRequest.mockResolvedValue({ device: null });
    render(<SessionsDialog user={user({ appLoginId: null })} actionConfig={cfg} onClose={vi.fn()} />);
    expect(screen.getByText(/signs in with a local password/)).toBeInTheDocument();
  });
  it("closes via the dialog's onOpenChange(false)", () => {
    apiRequest.mockResolvedValue({ device: null });
    const onClose = vi.fn();
    render(<SessionsDialog user={user()} actionConfig={cfg} onClose={onClose} />);
    fireEvent.click(screen.getByText("dlg-close"));
    expect(onClose).toHaveBeenCalled();
  });
  it("clears the device label and re-fetches when the user changes", async () => {
    apiRequest.mockResolvedValueOnce({ device: { label: "A" } }).mockResolvedValueOnce({ device: { label: "B" } });
    const { rerender } = render(<SessionsDialog user={user({ id: "u1" })} actionConfig={cfg} onClose={vi.fn()} />);
    await waitFor(() => expect(sectionProps).toHaveBeenLastCalledWith(expect.objectContaining({ deviceModel: "A" })));
    rerender(<SessionsDialog user={user({ id: "u2" })} actionConfig={cfg} onClose={vi.fn()} />); // userId change → clear + refetch
    await waitFor(() => expect(sectionProps).toHaveBeenLastCalledWith(expect.objectContaining({ deviceModel: "B" })));
  });
});
