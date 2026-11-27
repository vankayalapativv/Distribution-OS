import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const useEditProfile = vi.fn();
vi.mock("../../lib/use-edit-profile", () => ({ useEditProfile: () => useEditProfile() }));
vi.mock("../../components/settings/profile-form", () => ({ ProfileForm: ({ email }: { email: string | null }) => <span>profile-{email ?? "none"}</span> }));
vi.mock("../../components/settings/settings-header", () => ({ SettingsHeader: ({ title }: { title: string }) => <span>{title}</span> }));
vi.mock("../../components/settings/save-bar", () => ({ SaveBar: ({ label, onPress }: { label: string; onPress: () => void }) => <button type="button" onClick={onPress}>{label}</button> }));
vi.mock("../../components/error-state", () => ({ ErrorState: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>retry</button> }));

import EditProfileScreen from "./profile";

const base = { name: "Ravi", onNameChange: vi.fn(), phone: "9", onPhoneChange: vi.fn(), error: null, saved: false, phoneConflict: false, busy: false, canSave: true, onSave: vi.fn() };

describe("EditProfileScreen", () => {
  it("shows the skeleton while loading", () => {
    useEditProfile.mockReturnValue({ ...base, profileQuery: { isPending: true, isError: false, data: undefined, refetch: vi.fn() } });
    render(<EditProfileScreen />);
    expect(screen.queryByText(/profile-/)).not.toBeInTheDocument();
  });

  it("shows a retryable error", () => {
    const refetch = vi.fn();
    useEditProfile.mockReturnValue({ ...base, profileQuery: { isPending: false, isError: true, error: new Error("x"), refetch } });
    render(<EditProfileScreen />);
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders the profile form and saves (email fallback to null)", () => {
    const onSave = vi.fn();
    useEditProfile.mockReturnValue({ ...base, onSave, profileQuery: { isPending: false, isError: false, data: { email: null }, refetch: vi.fn() } });
    render(<EditProfileScreen />);
    expect(screen.getByText("profile-none")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save changes"));
    expect(onSave).toHaveBeenCalled();
  });
});
