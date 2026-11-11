import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TasksTable } from "./tasks-table";
import type { Task } from "./tasks-api";

const task = (over: Partial<Task> = {}): Task =>
  ({ id: "t1", title: "Call customer", description: null, priority: "high", status: "open",
     dueDate: null, assignedToName: null, customerId: null, customerName: null, ...over } as Task);

beforeEach(() => vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("TasksTable", () => {
  it("shows an empty state with no tasks", () => {
    render(<TasksTable tasks={[]} onOpen={() => {}} />);
    expect(screen.getByText(/No tasks here/)).toBeInTheDocument();
  });

  it("renders a row with title, priority, status, assignee and customer link", () => {
    render(
      <TasksTable
        tasks={[task({ description: "ring twice", assignedToName: "Ravi", customerId: "c1", customerName: "Sri Laxmi", status: "in_progress" })]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("Call customer")).toBeInTheDocument();
    expect(screen.getByText("ring twice")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("Sri Laxmi").getAttribute("href")).toBe("/customers/c1");
  });

  it("marks an overdue task and dashes an unassigned / customerless one", () => {
    render(<TasksTable tasks={[task({ dueDate: "2026-09-14" })]} onOpen={() => {}} />);
    expect(screen.getByText(/overdue/)).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("falls back for an unknown priority/status", () => {
    render(<TasksTable tasks={[task({ priority: "urgent", status: "archived" })]} onOpen={() => {}} />);
    expect(screen.getByText("urgent")).toBeInTheDocument(); // no tone class, still shown
    expect(screen.getByText("archived")).toBeInTheDocument(); // label falls back to raw status
  });

  it("opens a task on row click but not when the customer link is clicked", () => {
    const onOpen = vi.fn();
    render(<TasksTable tasks={[task({ customerId: "c1", customerName: "Sri Laxmi" })]} onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Sri Laxmi")); // link stops propagation
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Call customer"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
