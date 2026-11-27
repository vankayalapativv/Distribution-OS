import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useAdminSettings = vi.fn();
vi.mock("../../lib/use-admin-settings", () => ({ useAdminSettings: () => useAdminSettings() }));
vi.mock("../../lib/app-version", () => ({ OTA_BUILD: "1.2.3" }));
vi.mock("../../components/admin/settings-rows", () => ({
  SectionLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Row: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>{label}</button>
  ),
}));

import AdminSettingsScreen from "./settings";

describe("AdminSettingsScreen", () => {
  it("renders the profile and routes to each account/app action, then logs out", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear();
    const onLogout = vi.fn();
    useAdminSettings.mockReturnValue({ user: { name: "Asha", email: "a@x.io" }, roleLabel: "Super Admin", onLogout });
    render(<AdminSettingsScreen />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.queryByText("Edit profile")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Change password"));
    expect(router.push).toHaveBeenCalledWith("/settings/password");
    fireEvent.click(screen.getByText("Help"));
    expect(router.push).toHaveBeenCalledWith("/settings/about");
    fireEvent.click(screen.getByText("Log out"));
    expect(onLogout).toHaveBeenCalled();
  });

  it("falls back for a missing user", () => {
    useAdminSettings.mockReturnValue({ user: null, roleLabel: "", onLogout: vi.fn() });
    render(<AdminSettingsScreen />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
