import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CredentialsPanel, SuperAdminConfirmPanel } from "./super-admin-add-user-panels";

const creds = { name: "Asha", email: "a@x.com", password: "P@ss123" };

describe("CredentialsPanel", () => {
  it("shows the credentials and toggles the Copy label; fires onCopy/onDone", () => {
    const onCopy = vi.fn();
    const onDone = vi.fn();
    const { rerender } = render(<CredentialsPanel credentials={creds} copied={false} onCopy={onCopy} onDone={onDone} />);
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("P@ss123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Credentials" }));
    expect(onCopy).toHaveBeenCalledWith(creds);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalled();
    rerender(<CredentialsPanel credentials={creds} copied onCopy={onCopy} onDone={onDone} />);
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });
});

describe("SuperAdminConfirmPanel", () => {
  const payload = { name: "Boss", email: "boss@x.com", phone: null, role: "SUPER_ADMIN" };

  it("confirms / goes back and shows an error and the creating state", () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    const { rerender } = render(
      <SuperAdminConfirmPanel payload={payload} isCreating={false} error="boom" onConfirm={onConfirm} onBack={onBack} />,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, create Super Admin" }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
    // Creating state disables the buttons and relabels the primary one.
    rerender(<SuperAdminConfirmPanel payload={{ ...payload, email: null }} isCreating error={null} onConfirm={onConfirm} onBack={onBack} />);
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.getByText("—")).toBeInTheDocument(); // null email
  });
});
