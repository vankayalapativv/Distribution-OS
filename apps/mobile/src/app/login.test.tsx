import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const useLoginForm = vi.fn();
vi.mock("../lib/use-login-form", () => ({ useLoginForm: () => useLoginForm() }));
vi.mock("expo-image", () => ({ Image: () => <span>logo</span> }));
vi.mock("../components/auth/login-form", () => ({
  LoginForm: ({ email, onSubmit }: { email: string; onSubmit: () => void }) => <button type="button" onClick={onSubmit}>login-{email}</button>,
}));

import LoginScreen from "./login";

describe("LoginScreen", () => {
  it("renders the logo and login form from the hook", () => {
    useLoginForm.mockReturnValue({
      email: "a@x.io", onEmailChange: vi.fn(), password: "", onPasswordChange: vi.fn(),
      showPassword: false, toggleShow: vi.fn(), fieldErrors: {}, feedback: null, busy: false, onSubmit: vi.fn(),
    });
    render(<LoginScreen />);
    expect(screen.getByText("logo")).toBeInTheDocument();
    expect(screen.getByText("login-a@x.io")).toBeInTheDocument();
  });
});
