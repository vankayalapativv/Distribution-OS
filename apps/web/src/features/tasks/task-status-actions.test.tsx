import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskStatusActions } from "./task-status-actions";

describe("TaskStatusActions", () => {
  it("shows Start / Mark done / Cancel for an open task", () => {
    const onChange = vi.fn();
    render(<TaskStatusActions status="open" onChange={onChange} />);
    expect(screen.queryByText("Reopen")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Mark done"));
    fireEvent.click(screen.getByText("Cancel task"));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["in_progress", "done", "cancelled"]);
  });

  it("hides Start for an in-progress task", () => {
    render(<TaskStatusActions status="in_progress" onChange={vi.fn()} />);
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
    expect(screen.getByText("Mark done")).toBeInTheDocument();
  });

  it("offers Reopen for a done task and nothing else", () => {
    const onChange = vi.fn();
    render(<TaskStatusActions status="done" onChange={onChange} />);
    expect(screen.queryByText("Mark done")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel task")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Reopen"));
    expect(onChange).toHaveBeenCalledWith("open");
  });

  it("hides Cancel task for a cancelled task", () => {
    render(<TaskStatusActions status="cancelled" onChange={vi.fn()} />);
    expect(screen.queryByText("Cancel task")).not.toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});
