import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileForm } from "./profile-form";

const base = {
  name: "Asha",
  onName: () => {},
  phone: "9876543210",
  onPhone: () => {},
  email: "asha@example.com",
  error: null as string | null,
  saved: false,
  phoneConflict: false,
  busy: false,
};

describe("ProfileForm", () => {
  it("edits the name and shows the read-only email", () => {
    const onName = vi.fn();
    render(<ProfileForm {...base} onName={onName} />);
    fireEvent.change(screen.getByDisplayValue("Asha"), { target: { value: "Asha K" } });
    expect(onName).toHaveBeenCalledWith("Asha K");
    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
  });

  it("shows a dash for a missing email and the saved confirmation", () => {
    render(<ProfileForm {...base} email={null} saved />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Profile updated")).toBeInTheDocument();
  });

  it("shows the phone-conflict message (and suppresses the generic error then)", () => {
    render(<ProfileForm {...base} phoneConflict error="Something failed" />);
    expect(screen.getByText(/already used by another account/)).toBeInTheDocument();
    expect(screen.queryByText("Something failed")).not.toBeInTheDocument();
  });

  it("shows a generic error banner when not a phone conflict", () => {
    render(<ProfileForm {...base} error="Something failed" />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });
});
