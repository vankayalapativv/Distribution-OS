import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentLevel } from "./metrics-drilldown-agents";
import type { AgentRow } from "./metrics-helpers";

const agents: AgentRow[] = [
  { agentId: "a1", agentName: "Ravi Kumar", visits: 8, productiveVisits: 6, customers: 3, live: true },
  { agentId: "a2", agentName: "", visits: 2, productiveVisits: 0, customers: 1 },
];

describe("AgentLevel", () => {
  it("shows the skeleton while agents are null", () => {
    const { container } = render(<AgentLevel metric="visits" agents={null} onOpen={vi.fn()} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("shows an empty state for no agents", () => {
    render(<AgentLevel metric="visits" agents={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("Nothing recorded in this period.")).toBeInTheDocument();
  });

  it("renders a row per agent with initials avatar, and calls onOpen", () => {
    const onOpen = vi.fn();
    render(<AgentLevel metric="visits" agents={agents} onOpen={onOpen} />);
    expect(screen.getByText("RK")).toBeInTheDocument(); // initials from "Ravi Kumar"
    fireEvent.click(screen.getByText("Ravi Kumar").closest("button")!);
    expect(onOpen).toHaveBeenCalledWith(agents[0]);
  });

  it("greens a live executive and mutes an offline one", () => {
    render(
      <AgentLevel
        metric="executives"
        agents={[
          { agentId: "a1", agentName: "Ravi", live: true, sessionStartedAt: "2026-09-15T09:00:00Z", visits: 3 },
          { agentId: "a2", agentName: "Sita", live: false }, // not live → dash + muted
        ]}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("Live").className).toContain("text-green-600");
    expect(screen.getByText("—").className).toContain("text-muted-foreground");
  });
});
