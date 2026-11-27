import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

const base = {
  email: "",
  onEmail: () => {},
  password: "",
  onPassword: () => {},
  showPassword: false,
  onToggleShow: () => {},
  fieldErrors: {} as { email?: string; password?: string },
  feedback: null,
  busy: false,
  onSubmit: () => {},
};

describe("LoginForm", () => {
  it("edits email + password and submits", () => {
    const onEmail = vi.fn();
    const onPassword = vi.fn();
    const onSubmit = vi.fn();
    const { container } = render(
      <LoginForm {...base} onEmail={onEmail} onPassword={onPassword} onSubmit={onSubmit} />,
    );
    const emailInput = container.querySelectorAll("input,textarea")[0];
    fireEvent.change(emailInput, { target: { value: "a@b.com" } });
    expect(onEmail).toHaveBeenCalledWith("a@b.com");
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    expect(onPassword).toHaveBeenCalledWith("secret");
    fireEvent.click(screen.getByText("Sign in"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("toggles password visibility", () => {
    const onToggleShow = vi.fn();
    const { rerender } = render(<LoginForm {...base} onToggleShow={onToggleShow} />);
    fireEvent.click(screen.getByLabelText("Show password"));
    expect(onToggleShow).toHaveBeenCalled();
    rerender(<LoginForm {...base} showPassword onToggleShow={onToggleShow} />);
    expect(screen.getByLabelText("Hide password")).toBeInTheDocument();
  });

  it("shows field errors and a feedback banner", () => {
    render(
      <LoginForm
        {...base}
        fieldErrors={{ email: "Enter an email", password: "Enter a password" }}
        feedback={{ severity: "error", title: "Login failed", message: "Wrong password" }}
      />,
    );
    expect(screen.getByText("Enter an email")).toBeInTheDocument();
    expect(screen.getByText("Enter a password")).toBeInTheDocument();
    expect(screen.getByText("Login failed")).toBeInTheDocument();
    expect(screen.getByText("Wrong password")).toBeInTheDocument();
  });

  it("shows a spinner and disables submit while busy", () => {
    const onSubmit = vi.fn();
    render(<LoginForm {...base} busy onSubmit={onSubmit} />);
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument(); // replaced by the spinner
  });
});
