import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));
const refreshBadges = vi.fn();
vi.mock("@/features/shell/badge-refresh", () => ({ refreshBadges: () => refreshBadges() }));

import { useTaskDetail } from "./use-task-detail";
import type { Task } from "./tasks-api";

const task = (over: Partial<Task> = {}): Task => ({ id: "t1", title: "T", status: "open", createdBy: "me", ...over } as Task);
const config = { apiBaseUrl: "", authToken: "", currentUserId: "me" };
const detail = { task: task({ title: "Loaded" }), comments: [{ id: "c1" }], attachments: [{ id: "a1" }] };

function setup(initial = task()) {
  const onClose = vi.fn(), onTaskUpdated = vi.fn(), onTaskDeleted = vi.fn(), onError = vi.fn();
  const hook = renderHook(() => useTaskDetail({ initialTask: initial, actionConfig: config, onClose, onTaskUpdated, onTaskDeleted, onError }));
  return { ...hook, onClose, onTaskUpdated, onTaskDeleted, onError };
}

beforeEach(() => {
  apiRequest.mockImplementation((_c, method) => {
    if (method === "GET") return Promise.resolve(detail);
    if (method === "PATCH") return Promise.resolve(task({ status: "done", createdBy: "me" }));
    return Promise.resolve({});
  });
});
afterEach(() => { apiRequest.mockReset(); refreshBadges.mockReset(); });

describe("useTaskDetail", () => {
  it("loads the task detail on mount", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    expect(result.current.task.title).toBe("Loaded");
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.attachments).toHaveLength(1);
  });

  it("changes status: updates, notifies, refreshes badges", async () => {
    const { result, onTaskUpdated } = setup();
    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    await act(async () => result.current.changeStatus("done"));
    await waitFor(() => expect(result.current.task.status).toBe("done"));
    expect(onTaskUpdated).toHaveBeenCalled();
    expect(refreshBadges).toHaveBeenCalled();
  });

  it("only lets the creator delete a finished task", () => {
    expect(setup(task({ createdBy: "me", status: "open" })).result.current.canDelete).toBe(false);
    expect(setup(task({ createdBy: "me", status: "done" })).result.current.canDelete).toBe(true);
    expect(setup(task({ createdBy: "other", status: "done" })).result.current.canDelete).toBe(false);
  });

  it("deletes the task and closes", async () => {
    const { result, onTaskDeleted, onClose } = setup(task({ status: "done" }));
    await act(async () => result.current.handleDelete());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onTaskDeleted).toHaveBeenCalledWith("t1");
  });

  it("surfaces status-change and delete failures", async () => {
    const { result, onError } = setup(task({ status: "done" }));
    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    apiRequest.mockRejectedValueOnce(new Error("x")); // next call (the PATCH) fails
    await act(async () => result.current.changeStatus("open"));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not update the task."));
    apiRequest.mockRejectedValueOnce(new Error("y")); // next call (the DELETE) fails
    await act(async () => result.current.handleDelete());
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not delete the task."));
    expect(result.current.deleting).toBe(false);
    expect(result.current.confirmingDelete).toBe(false);
  });

  it("ignores the load result if unmounted before it resolves", async () => {
    const onError = vi.fn();
    const { unmount } = renderHook(() =>
      useTaskDetail({ initialTask: task(), actionConfig: config, onClose: vi.fn(), onTaskUpdated: vi.fn(), onTaskDeleted: vi.fn(), onError }));
    unmount(); // cancels the in-flight load
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // flush the then/catch/finally chain
    expect(onError).not.toHaveBeenCalled(); // the cancelled guard prevents any post-unmount work
  });

  it("surfaces a load error and appends comments/attachments", async () => {
    apiRequest.mockImplementationOnce(() => Promise.reject(new Error("x")));
    const { result, onError } = setup();
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not load the task."));
    act(() => { result.current.addComment({ id: "c2" } as never); result.current.addAttachment({ id: "a2" } as never); });
    expect(result.current.comments.some((c) => c.id === "c2")).toBe(true);
    expect(result.current.attachments.some((a) => a.id === "a2")).toBe(true);
  });
});
