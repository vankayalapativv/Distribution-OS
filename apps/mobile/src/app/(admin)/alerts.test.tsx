import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const useAdminAlerts = vi.fn();
vi.mock("../../lib/use-admin-alerts", () => ({ useAdminAlerts: () => useAdminAlerts() }));
vi.mock("../../components/alerts/activity-row", () => ({
  ActivityRow: ({ n, onPress, onDelete }: { n: { id: string }; onPress: () => void; onDelete: () => void }) => (
    <div>
      <button type="button" onClick={onPress}>open-{n.id}</button>
      <button type="button" onClick={onDelete}>del-{n.id}</button>
    </div>
  ),
}));

import AdminAlertsScreen from "./alerts";

const base = { items: [], loading: false, refreshing: false, onRefresh: vi.fn(), onOpen: vi.fn(), onDelete: vi.fn(), onClearAll: vi.fn() };

describe("AdminAlertsScreen", () => {
  it("shows the loading skeleton", () => {
    useAdminAlerts.mockReturnValue({ ...base, loading: true });
    render(<AdminAlertsScreen />);
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.queryByText(/No activity yet/)).not.toBeInTheDocument();
  });

  it("shows the empty state", () => {
    useAdminAlerts.mockReturnValue({ ...base });
    render(<AdminAlertsScreen />);
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
  });

  it("lists activity rows, clears all, opens and deletes", () => {
    const onOpen = vi.fn(), onDelete = vi.fn(), onClearAll = vi.fn();
    useAdminAlerts.mockReturnValue({ ...base, items: [{ id: "a1" }], onOpen, onDelete, onClearAll });
    render(<AdminAlertsScreen />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(onClearAll).toHaveBeenCalled();
    fireEvent.click(screen.getByText("open-a1"));
    expect(onOpen).toHaveBeenCalledWith({ id: "a1" });
    fireEvent.click(screen.getByText("del-a1"));
    expect(onDelete).toHaveBeenCalledWith("a1");
  });
});
