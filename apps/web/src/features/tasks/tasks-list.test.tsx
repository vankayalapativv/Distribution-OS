import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "./tasks-api";

vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, subtitle, action }: { readonly title: string; readonly subtitle?: React.ReactNode; readonly action?: React.ReactNode }) => <div><h1>{title}</h1><div>{subtitle}</div>{action}</div>,
}));
vi.mock("./tasks-filters", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TasksFilters: ({ onToggleMine, onStatusTab, onPriorityFilter }: any) => (
    <div data-testid="filters">
      <button onClick={onToggleMine}>f-mine</button>
      <button onClick={() => onStatusTab("done")}>f-status</button>
      <button onClick={() => onPriorityFilter("high")}>f-priority</button>
    </div>
  ),
}));
vi.mock("./tasks-table", () => ({ TasksTable: ({ tasks }: { readonly tasks: Task[] }) => <div data-testid="table">{tasks.length} rows</div> }));
vi.mock("./task-create-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TaskCreateDialog: ({ onCreated, onError, onClose }: any) => (
    <div data-testid="create">
      <button onClick={() => onCreated({ id: "new" })}>c-created</button>
      <button onClick={() => onError("oops")}>c-error</button>
      <button onClick={onClose}>c-close</button>
    </div>
  ),
}));
vi.mock("./task-detail-drawer", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TaskDetailDrawer: ({ onTaskUpdated, onTaskDeleted, onClose, onError }: any) => (
    <div data-testid="drawer">
      <button onClick={() => onTaskUpdated({ id: "t1" })}>d-updated</button>
      <button onClick={() => onTaskDeleted("t1")}>d-deleted</button>
      <button onClick={() => onError("bad")}>d-error</button>
      <button onClick={onClose}>d-close</button>
    </div>
  ),
}));

const hook = {
  tasks: [] as Task[], statusTab: "open" as const, setStatusTab: vi.fn(), mineOnly: false, setMineOnly: vi.fn(),
  priorityFilter: "", setPriorityFilter: vi.fn(), error: null as string | null, setError: vi.fn(),
  showCreate: false, setShowCreate: vi.fn(), openTask: null as Task | null, setOpenTask: vi.fn(),
  filtered: [] as Task[], openCount: 0, addTask: vi.fn(), updateTask: vi.fn(), removeTask: vi.fn(),
};
vi.mock("./use-tasks-list", () => ({ useTasksList: () => hook }));

import { TasksList } from "./tasks-list";

const config = { apiBaseUrl: "", authToken: "", currentUserId: "me" };
const props = { tasks: [], assignees: [], customers: [], role: "MANAGER" as const, actionConfig: config };

describe("TasksList", () => {
  it("shows the active badge and opens the create dialog", () => {
    hook.openCount = 3;
    hook.filtered = [{ id: "t1" } as Task];
    render(<TasksList {...props} />);
    expect(screen.getByText("3 active")).toBeInTheDocument();
    expect(screen.getByTestId("table").textContent).toContain("1 rows");
    fireEvent.click(screen.getByText(/New task/));
    expect(hook.setShowCreate).toHaveBeenCalledWith(true);
  });

  it("shows and dismisses the error banner", () => {
    hook.error = "Something failed";
    render(<TasksList {...props} />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Something failed").querySelector("button")!);
    expect(hook.setError).toHaveBeenCalledWith(null);
    hook.error = null;
  });

  it("wires the create dialog + detail drawer callbacks to the hook", () => {
    hook.showCreate = true;
    hook.openTask = { id: "t1" } as Task;
    render(<TasksList {...props} />);
    fireEvent.click(screen.getByText("c-created"));
    fireEvent.click(screen.getByText("c-error"));
    fireEvent.click(screen.getByText("c-close"));
    fireEvent.click(screen.getByText("d-updated"));
    fireEvent.click(screen.getByText("d-deleted"));
    fireEvent.click(screen.getByText("d-error"));
    fireEvent.click(screen.getByText("d-close"));
    expect(hook.addTask).toHaveBeenCalledWith({ id: "new" });
    expect(hook.updateTask).toHaveBeenCalledWith({ id: "t1" });
    expect(hook.removeTask).toHaveBeenCalledWith("t1");
    expect(hook.setShowCreate).toHaveBeenCalledWith(false);
    expect(hook.setOpenTask).toHaveBeenCalledWith(null);
    expect(hook.setError).toHaveBeenCalledWith("oops");
    hook.showCreate = false;
    hook.openTask = null;
  });

  it("hides the active badge when nothing is active", () => {
    hook.openCount = 0;
    render(<TasksList {...props} />);
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
  });

  it("wires the filter callbacks (incl. the mine-only toggle) to the hook", () => {
    render(<TasksList {...props} />);
    fireEvent.click(screen.getByText("f-mine"));
    fireEvent.click(screen.getByText("f-status"));
    fireEvent.click(screen.getByText("f-priority"));
    expect(hook.setStatusTab).toHaveBeenCalledWith("done");
    expect(hook.setPriorityFilter).toHaveBeenCalledWith("high");
    // the mine toggle flips the current value (hook.mineOnly === false) → true
    expect(hook.setMineOnly).toHaveBeenCalledWith(true);
  });
});
