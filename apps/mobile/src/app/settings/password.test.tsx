import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const useChangePassword = vi.fn();
vi.mock("../../lib/use-change-password", () => ({ useChangePassword: () => useChangePassword() }));
vi.mock("../../components/settings/password-form", () => ({ PasswordForm: () => <span>password-form</span> }));
vi.mock("../../components/settings/settings-header", () => ({ SettingsHeader: ({ title }: { title: string }) => <span>{title}</span> }));
vi.mock("../../components/settings/save-bar", () => ({ SaveBar: ({ label, onPress }: { label: string; onPress: () => void }) => <button type="button" onClick={onPress}>{label}</button> }));

import ChangePasswordScreen from "./password";

describe("ChangePasswordScreen", () => {
  it("renders the form and triggers save", () => {
    const onSave = vi.fn();
    useChangePassword.mockReturnValue({ current: "", setCurrent: vi.fn(), next: "", setNext: vi.fn(), confirm: "", setConfirm: vi.fn(), tooShort: false, mismatch: false, error: null, saved: false, busy: false, canSave: true, onSave });
    render(<ChangePasswordScreen />);
    expect(screen.getByText("password-form")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Update password"));
    expect(onSave).toHaveBeenCalled();
  });
});
