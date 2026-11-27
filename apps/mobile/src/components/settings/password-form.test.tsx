import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PasswordForm } from "./password-form";

const base = {
  current: "",
  onCurrent: () => {},
  next: "",
  onNext: () => {},
  confirm: "",
  onConfirm: () => {},
  tooShort: false,
  mismatch: false,
  error: null as string | null,
  saved: false,
  busy: false,
};

describe("PasswordForm", () => {
  it("edits each field", () => {
    const onCurrent = vi.fn();
    render(<PasswordForm {...base} onCurrent={onCurrent} />);
    fireEvent.change(screen.getByPlaceholderText("Current password"), { target: { value: "old" } });
    expect(onCurrent).toHaveBeenCalledWith("old");
  });

  it("shows the too-short and mismatch hints", () => {
    render(<PasswordForm {...base} tooShort mismatch />);
    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(screen.getByText(/Passwords don/)).toBeInTheDocument();
  });

  it("shows an error banner and the saved confirmation", () => {
    const { rerender } = render(<PasswordForm {...base} error="Wrong current password" />);
    expect(screen.getByText("Wrong current password")).toBeInTheDocument();
    rerender(<PasswordForm {...base} saved />);
    expect(screen.getByText(/Password changed/)).toBeInTheDocument();
  });
});
