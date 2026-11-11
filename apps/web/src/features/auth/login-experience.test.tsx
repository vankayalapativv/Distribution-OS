import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LoginExperience } from "./login-experience";

describe("LoginExperience", () => {
  test("renders email and password form", () => {
    render(<LoginExperience />);

    expect(screen.getByRole("heading", { name: "Distribution OS" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Email or phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  test("shows error message when error prop is provided", () => {
    render(<LoginExperience error="no_web_access" />);

    expect(screen.getByText(/does not have web access/i)).toBeInTheDocument();
  });
});

describe("LoginExperience — submit flow", () => {
  const assign = vi.fn();
  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  function fill() {
    fireEvent.change(screen.getByLabelText("Email or phone number"), { target: { value: "m@x.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  test("on success, keeps the loading state and navigates (no flip back to 'Sign in')", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, role: "MANAGER" }) }));
    render(<LoginExperience />);
    fill();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/auth/redirect"));
    // Loading must persist through navigation — the button never returns to "Sign in".
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  test("on error, re-enables the form and shows the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Invalid email or password." }) }));
    render(<LoginExperience />);
    fill();

    await waitFor(() => expect(screen.getByText("Invalid email or password.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });
});
