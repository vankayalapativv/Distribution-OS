import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDetailMeta } from "./task-detail-meta";
import type { Task } from "./tasks-api";

const task = (over: Partial<Task> = {}): Task =>
  ({ id: "t1", priority: "high", status: "open", dueDate: null, assignedToName: null, customerId: null,
     customerName: null, remindAt: null, completedAt: null, ...over } as Task);

beforeEach(() => vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("TaskDetailMeta", () => {
  it("shows priority, status, overdue due date and an unassigned marker", () => {
    render(<TaskDetailMeta task={task({ dueDate: "2026-09-14" })} />);
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText(/Due/).className).toMatch(/text-red-600/); // overdue
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
  });

  it("links to the customer when set", () => {
    render(<TaskDetailMeta task={task({ customerId: "c1", customerName: "Sri Laxmi" })} />);
    expect(screen.getByText(/Sri Laxmi/).getAttribute("href")).toBe("/customers/c1");
  });

  it("shows the phone-reminder banner and a done note", () => {
    render(<TaskDetailMeta task={task({ remindAt: "2026-09-14T04:00:00.000Z", assignedToName: "Sandeep", status: "done", completedAt: "2026-09-14T05:00:00.000Z" })} />);
    expect(screen.getByText(/Phone reminder for Sandeep/)).toBeInTheDocument();
    expect(screen.getByText(/Marked done/)).toBeInTheDocument();
  });

  it("omits the reminder banner when there is no remindAt", () => {
    render(<TaskDetailMeta task={task()} />);
    expect(screen.queryByText(/Phone reminder/)).not.toBeInTheDocument();
  });

  it("tolerates unknown priority/status and an unnamed, not-done reminder", () => {
    render(<TaskDetailMeta task={task({ priority: "urgent", status: "archived", remindAt: "2026-09-14T04:00:00.000Z", assignedToName: null })} />);
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("archived")).toBeInTheDocument();
    expect(screen.getByText(/for the sales executive/)).toBeInTheDocument();
    expect(screen.queryByText(/Marked done/)).not.toBeInTheDocument();
  });
});
