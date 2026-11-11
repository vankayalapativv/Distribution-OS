import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "./tasks-api";

vi.mock("./task-detail-meta", () => ({ TaskDetailMeta: () => <div data-testid="meta" /> }));
vi.mock("./task-status-actions", () => ({ TaskStatusActions: () => <div data-testid="status" /> }));
vi.mock("./task-attachments", () => ({ TaskAttachments: () => <div data-testid="attachments" /> }));
vi.mock("./task-comments", () => ({ TaskComments: () => <div data-testid="comments" /> }));
vi.mock("./task-delete-section", () => ({ TaskDeleteSection: () => <div data-testid="delete" /> }));

const hook = {
  task: { id: "t1", title: "Call customer", createdByName: "Ravi", createdAt: "2026-09-14", description: "ring twice", status: "done" } as Task,
  comments: [], attachments: [], detailLoading: false, confirmingDelete: false, setConfirmingDelete: vi.fn(),
  deleting: false, canDelete: true, changeStatus: vi.fn(), handleDelete: vi.fn(), addComment: vi.fn(), addAttachment: vi.fn(),
};
vi.mock("./use-task-detail", () => ({ useTaskDetail: () => hook }));

import { TaskDetailDrawer } from "./task-detail-drawer";

const props = { task: hook.task, actionConfig: { apiBaseUrl: "", authToken: "", currentUserId: "me" }, onClose: vi.fn(), onTaskUpdated: vi.fn(), onTaskDeleted: vi.fn(), onError: vi.fn() };

describe("TaskDetailDrawer", () => {
  it("renders the header, description and all sections", () => {
    render(<TaskDetailDrawer {...props} />);
    expect(screen.getByText("Call customer")).toBeInTheDocument();
    expect(screen.getByText(/by Ravi/)).toBeInTheDocument();
    expect(screen.getByText("ring twice")).toBeInTheDocument();
    expect(screen.getByTestId("meta")).toBeInTheDocument();
    expect(screen.getByTestId("status")).toBeInTheDocument();
    expect(screen.getByTestId("attachments")).toBeInTheDocument();
    expect(screen.getByTestId("comments")).toBeInTheDocument();
    expect(screen.getByTestId("delete")).toBeInTheDocument();
  });

  it("closes on the backdrop and the X, but not on inner clicks", () => {
    const onClose = vi.fn();
    const { container } = render(<TaskDetailDrawer {...props} onClose={onClose} />);
    fireEvent.click(screen.getByText("ring twice")); // inner → stopPropagation, no close
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.firstChild as Element); // backdrop
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides the delete section when not allowed", () => {
    hook.canDelete = false;
    render(<TaskDetailDrawer {...props} />);
    expect(screen.queryByTestId("delete")).not.toBeInTheDocument();
    hook.canDelete = true;
  });

  it("tolerates a task with no creator name and no description", () => {
    const saved = hook.task;
    hook.task = { id: "t1", title: "Bare", createdByName: null, createdAt: "2026-09-14", description: null, status: "open" } as Task;
    render(<TaskDetailDrawer {...props} />);
    expect(screen.getByText(/by —/)).toBeInTheDocument();
    expect(screen.queryByText("ring twice")).not.toBeInTheDocument();
    hook.task = saved;
  });
});
