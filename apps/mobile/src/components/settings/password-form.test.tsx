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
  rules: { longEnough: false, hasLetter: false, hasNumber: false },
  strength: 0,
  mismatch: false,
  wrongCurrent: false,
  error: null as string | null,
  saved: false,
  busy: false,
};

describe("PasswordForm", () => {
  it("edits a field", () => {
    const onCurrent = vi.fn();
    render(<PasswordForm {...base} onCurrent={onCurrent} />);
    fireEvent.change(screen.getByPlaceholderText("Your current password"), { target: { value: "old" } });
    expect(onCurrent).toHaveBeenCalledWith("old");
  });

  it("toggles show/hide on a field", () => {
    render(<PasswordForm {...base} />);
    fireEvent.click(screen.getByLabelText("Show Current password"));
    expect(screen.getByLabelText("Hide Current password")).toBeInTheDocument();
  });

  it("shows the strength meter + rules checklist once a new password is typed", () => {
    render(
      <PasswordForm
        {...base}
        next="abcd1234"
        rules={{ longEnough: true, hasLetter: true, hasNumber: true }}
        strength={3}
      />,
    );
    expect(screen.getByText("Good")).toBeInTheDocument(); // STRENGTH[3]
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("Contains a letter")).toBeInTheDocument();
    expect(screen.getByText("Contains a number")).toBeInTheDocument();
  });

  it("shows the weak label for an unsatisfied new password", () => {
    render(<PasswordForm {...base} next="a" strength={0} />);
    expect(screen.getByText("Too weak")).toBeInTheDocument(); // STRENGTH[0]
  });

  it("shows the wrong-current inline error and hides the generic banner", () => {
    render(<PasswordForm {...base} wrongCurrent error="Server unavailable" />);
    expect(screen.getByText("Your current password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Server unavailable")).not.toBeInTheDocument();
  });

  it("shows the mismatch hint, the generic error banner, and the saved confirmation", () => {
    const { rerender } = render(<PasswordForm {...base} mismatch error="Server unavailable" />);
    expect(screen.getByText(/Passwords don/)).toBeInTheDocument();
    expect(screen.getByText("Server unavailable")).toBeInTheDocument();
    rerender(<PasswordForm {...base} saved />);
    expect(screen.getByText("Password changed")).toBeInTheDocument();
  });
});
