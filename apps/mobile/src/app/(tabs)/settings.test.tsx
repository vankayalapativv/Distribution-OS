import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const useSettingsScreen = vi.fn();
vi.mock("../../lib/use-settings-screen", () => ({ useSettingsScreen: () => useSettingsScreen() }));
vi.mock("../../lib/app-version", () => ({ OTA_BUILD: "9.9.9" }));
vi.mock("../../components/settings/settings-sections", () => ({ SettingsSections: () => <span>settings-sections</span> }));
vi.mock("../../components/settings/sync-status", () => ({
  SyncCard: () => <span>sync-card</span>,
  FailedItemsCard: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>retry-failed</button>,
}));

import SettingsScreen from "./settings";

const base = { user: { name: "Ravi", email: "r@x.io" }, onLogout: vi.fn(), roleLabel: "Sales Executive", sync: {}, failedItems: [], retryFailed: vi.fn() };

describe("SettingsScreen", () => {
  it("renders the profile + sync card and logs out", () => {
    const onLogout = vi.fn();
    useSettingsScreen.mockReturnValue({ ...base, onLogout });
    render(<SettingsScreen />);
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("settings-sections")).toBeInTheDocument();
    expect(screen.getByText("sync-card")).toBeInTheDocument();
    expect(screen.queryByText("retry-failed")).not.toBeInTheDocument(); // no failed items
    fireEvent.click(screen.getByText("Log out"));
    expect(onLogout).toHaveBeenCalled();
  });

  it("shows the failed-items card when uploads failed, and falls back for a missing user", () => {
    const retryFailed = vi.fn();
    useSettingsScreen.mockReturnValue({ ...base, user: null, failedItems: [{ id: "x" }], retryFailed });
    render(<SettingsScreen />);
    expect(screen.getByText("—")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry-failed"));
    expect(retryFailed).toHaveBeenCalled();
  });
});
