import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const useSeAlerts = vi.fn();
vi.mock("../../lib/use-se-alerts", () => ({ useSeAlerts: () => useSeAlerts() }));
vi.mock("../../components/alerts/toggle-button", () => ({
  ToggleButton: ({ label, count, onPress }: { label: string; count: number; onPress: () => void }) => (
    <button type="button" onClick={onPress}>tab-{label}-{count}</button>
  ),
}));
vi.mock("../../components/alerts/alerts-sections", () => ({ AlertsSections: ({ tab }: { tab: string }) => <span>sections-{tab}</span> }));

import AlertsScreen from "./alerts";

const reload = vi.fn();
const base = { notifications: [], reload, clearAll: vi.fn(), refreshing: false, onRefresh: vi.fn(), onDues: vi.fn(), onOpen: vi.fn(), markRead: vi.fn(), deleteOne: vi.fn() };

describe("AlertsScreen (SE)", () => {
  it("renders the loading state (null feed) with no Clear all", () => {
    useSeAlerts.mockReturnValue({ ...base, notifications: null });
    render(<AlertsScreen />);
    expect(screen.getByText("sections-dues")).toBeInTheDocument();
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
    expect(reload).toHaveBeenCalled(); // useFocusEffect ran
  });

  it("counts unread, switches tabs, and clears all", () => {
    const clearAll = vi.fn();
    useSeAlerts.mockReturnValue({
      ...base,
      clearAll,
      notifications: [
        { id: "i1", type: "invoice", readAt: null },
        { id: "d1", type: "delivery", readAt: "2026-01-01" },
        { id: "u1", type: "dues_bucket", readAt: null },
      ],
    });
    render(<AlertsScreen />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(clearAll).toHaveBeenCalled();
    fireEvent.click(screen.getByText(/tab-New Invoices/));
    expect(screen.getByText("sections-invoice")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/tab-Deliveries/));
    expect(screen.getByText("sections-delivery")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/tab-Collections Due/));
    expect(screen.getByText("sections-dues")).toBeInTheDocument();
  });
});
