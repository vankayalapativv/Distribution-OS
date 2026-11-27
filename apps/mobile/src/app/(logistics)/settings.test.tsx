import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useLogisticsSettings = vi.fn();
vi.mock("../../lib/use-logistics-settings", () => ({ useLogisticsSettings: () => useLogisticsSettings() }));
vi.mock("../../lib/app-version", () => ({ OTA_BUILD: "1.0.0" }));
vi.mock("../../components/logistics/settings-rows", () => ({
  SectionLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Row: ({ label, onPress }: { label: string; onPress: () => void }) => <button type="button" onClick={onPress}>{label}</button>,
}));

import LogisticsSettingsScreen from "./settings";

describe("LogisticsSettingsScreen", () => {
  it("shows the title-cased role, routes to account actions, and logs out when idle", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear();
    const onLogout = vi.fn();
    useLogisticsSettings.mockReturnValue({ user: { name: "Driver", email: "d@x.io", role: "LOGISTICS" }, hasActiveRun: false, onLogout });
    render(<LogisticsSettingsScreen />);
    expect(screen.getByText("Logistics")).toBeInTheDocument(); // role title-cased
    fireEvent.click(screen.getByText("Edit profile"));
    expect(router.push).toHaveBeenCalledWith("/settings/profile");
    fireEvent.click(screen.getByText("Change password"));
    expect(router.push).toHaveBeenCalledWith("/settings/password");
    fireEvent.click(screen.getByText("Log out"));
    expect(onLogout).toHaveBeenCalled();
    expect(screen.queryByText(/End your deliveries/)).not.toBeInTheDocument();
  });

  it("blocks logout while a run is active and falls back for a missing user", () => {
    useLogisticsSettings.mockReturnValue({ user: null, hasActiveRun: true, onLogout: vi.fn() });
    render(<LogisticsSettingsScreen />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/End your deliveries before logging out/)).toBeInTheDocument();
  });
});
