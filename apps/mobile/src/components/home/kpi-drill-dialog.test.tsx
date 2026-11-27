import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMetricAgents = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("../../lib/admin-drill", async () => {
  const actual = await vi.importActual<typeof import("../../lib/admin-drill")>("../../lib/admin-drill");
  return { ...actual, fetchMetricAgents: (...a: unknown[]) => fetchMetricAgents(...a) };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KpiDrillDialog } from "./kpi-drill-dialog";

const range = { from: "2026-11-01", to: "2026-11-27" };
const rows = [
  { agentId: "a1", agentName: "Asha", live: true, visits: 4 },
  { agentId: "a2", agentName: "Bina", live: false, visits: 2 },
];

beforeEach(() => fetchMetricAgents.mockReset());

describe("KpiDrillDialog", () => {
  it("renders nothing when no metric is selected", () => {
    const { container } = render(<KpiDrillDialog metric={null} range={range} onClose={() => {}} />);
    expect(container.textContent).toBe("");
  });

  it("shows the skeleton then the executive rows", async () => {
    fetchMetricAgents.mockResolvedValue(rows);
    render(<KpiDrillDialog metric="executives" range={range} onClose={() => {}} />);
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Bina")).toBeInTheDocument();
    expect(fetchMetricAgents).toHaveBeenCalledWith("executives", range.from, range.to);
  });

  it("shows the empty message when there is no activity", async () => {
    fetchMetricAgents.mockResolvedValue([]);
    render(<KpiDrillDialog metric="ordered" range={range} onClose={() => {}} />);
    expect(await screen.findByText(/No activity for this metric/)).toBeInTheDocument();
  });

  it("calls onClose from the close button, but not when tapping the content", async () => {
    fetchMetricAgents.mockResolvedValue(rows);
    const onClose = vi.fn();
    render(<KpiDrillDialog metric="executives" range={range} onClose={onClose} />);
    await screen.findByText("Asha");
    // Tapping inside the card is swallowed (stopPropagation) — no close.
    fireEvent.click(screen.getByText("By executive"));
    expect(onClose).not.toHaveBeenCalled();
    // The explicit close button closes.
    fireEvent.click(screen.getByLabelText("close"));
    expect(onClose).toHaveBeenCalled();
  });
});
