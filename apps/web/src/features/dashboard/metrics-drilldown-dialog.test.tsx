import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentRow } from "./metrics-helpers";

vi.mock("./metrics-drilldown-agents", () => ({ AgentLevel: () => <div>agent-level</div> }));
vi.mock("./metrics-drilldown-customers", () => ({ CustomerLevel: () => <div>customer-level</div> }));

import { MetricsDrilldownDialog } from "./metrics-drilldown-dialog";

const range = { from: "2026-09-01", to: "2026-09-15" };
const agent: AgentRow = { agentId: "a1", agentName: "Ravi Kumar" };
const props = { range, agents: null, agent: null, customerRows: null, error: null, onOpenChange: vi.fn(), onBack: vi.fn(), onOpenAgent: vi.fn() };

describe("MetricsDrilldownDialog", () => {
  it("renders nothing when no metric is open", () => {
    render(<MetricsDrilldownDialog {...props} metric={null} />);
    expect(screen.queryByText("agent-level")).not.toBeInTheDocument();
  });

  it("shows the agent level for a metric with no drilled agent", () => {
    render(<MetricsDrilldownDialog {...props} metric="visits" />);
    expect(screen.getByText("agent-level")).toBeInTheDocument();
    expect(screen.getByText(/Visits ·/)).toBeInTheDocument();
  });

  it("shows the customer level + a working back button once an agent is picked", () => {
    const onBack = vi.fn();
    render(<MetricsDrilldownDialog {...props} metric="visits" agent={agent} onBack={onBack} />);
    expect(screen.getByText("customer-level")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows an error message", () => {
    render(<MetricsDrilldownDialog {...props} metric="visits" error="Boom" />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("handles the loaded (data) swap states for both levels", () => {
    const { unmount } = render(<MetricsDrilldownDialog {...props} metric="visits" agents={[]} />);
    expect(screen.getByText("agent-level")).toBeInTheDocument(); // agents !== null → "data"
    unmount();
    render(<MetricsDrilldownDialog {...props} metric="visits" agent={agent} customerRows={[]} />);
    expect(screen.getByText("customer-level")).toBeInTheDocument(); // customerRows !== null → "data"
  });
});
