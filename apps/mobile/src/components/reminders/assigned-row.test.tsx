import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssignedRow } from "./assigned-row";

const task = (over: Record<string, unknown> = {}) =>
  ({
    remindAt: 1_700_000_000_000,
    priority: "high",
    title: "Collect dues",
    description: "From Acme Traders",
    customerName: "Acme",
    createdByName: "Manager",
    ...over,
  }) as never;

describe("AssignedRow", () => {
  it("shows an overdue high-priority task with its details and marks it done", () => {
    const onDone = vi.fn();
    render(<AssignedRow t={task()} now={1_800_000_000_000} onDone={onDone} />);
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Collect dues")).toBeInTheDocument();
    expect(screen.getByText("From Acme Traders")).toBeInTheDocument();
    expect(screen.getByText(/Assigned by Manager/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mark done"));
    expect(onDone).toHaveBeenCalled();
  });

  it("uses the fallback tone for an unknown priority and hides optional fields when absent", () => {
    render(
      <AssignedRow
        t={task({ priority: "weird", description: null, createdByName: null, customerName: null })}
        now={0}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText("weird")).toBeInTheDocument();
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument(); // now=0 → not overdue
    expect(screen.queryByText(/Assigned by/)).not.toBeInTheDocument();
  });
});
