import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));
const refreshBadges = vi.fn();
vi.mock("@/features/shell/badge-refresh", () => ({ refreshBadges: () => refreshBadges() }));

import { useTaskCreate } from "./use-task-create";
import type { CustomerLite, TaskAssignee } from "./tasks-api";

const assignees: TaskAssignee[] = [
  { id: "u1", name: "Ravi", role: "MANAGER" },
  { id: "s1", name: "Sandeep", role: "SALES_EXECUTIVE" },
];
const customers: CustomerLite[] = [{ id: "c1", legalName: "Sri Laxmi", customerCode: "CUST-1", city: null, salesExecutiveName: null }];
const config = { apiBaseUrl: "", authToken: "", currentUserId: "me" };

function setup(handlers: Partial<{ onCreated: () => void; onError: () => void; onClose: () => void }> = {}) {
  const onCreated = vi.fn(), onError = vi.fn(), onClose = vi.fn();
  const hook = renderHook(() => useTaskCreate({ assignees, customers, actionConfig: config, onCreated, onError, onClose, ...handlers }));
  return { ...hook, onCreated, onError, onClose };
}

afterEach(() => { apiRequest.mockReset(); refreshBadges.mockReset(); });

describe("useTaskCreate", () => {
  it("splits office / SE assignees and detects an SE selection", () => {
    const { result } = setup();
    expect(result.current.officeAssignees.map((a) => a.id)).toEqual(["u1"]);
    expect(result.current.seAssignees.map((a) => a.id)).toEqual(["s1"]);
    act(() => result.current.setAssignee("s1"));
    expect(result.current.assigneeIsSe).toBe(true);
  });

  it("gates submit on the title and SE timing, and previews the reminder", () => {
    const { result } = setup();
    expect(result.current.canSubmit).toBe(false); // no title
    act(() => result.current.setTitle("Call"));
    expect(result.current.canSubmit).toBe(true); // office task with a title
    act(() => { result.current.setAssignee("s1"); });
    expect(result.current.canSubmit).toBe(false); // SE needs a date + time
    act(() => { result.current.setDueDate("2026-09-20"); result.current.setTime("14:30"); });
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.remindPreview).toMatch(/Sep/);
  });

  it("creates the task, notifies, refreshes badges and closes", async () => {
    apiRequest.mockResolvedValueOnce({ id: "new" });
    const { result, onCreated, onClose } = setup();
    act(() => result.current.setTitle("Call"));
    await act(async () => result.current.handleCreate());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/tasks", expect.objectContaining({ title: "Call" }));
    expect(onCreated).toHaveBeenCalledWith({ id: "new" });
    expect(refreshBadges).toHaveBeenCalled();
  });

  it("blocks an SE task without timing and surfaces failures", async () => {
    const { result, onError } = setup();
    act(() => { result.current.setTitle("Call"); result.current.setAssignee("s1"); });
    await act(async () => result.current.handleCreate());
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("date and time"));
    expect(apiRequest).not.toHaveBeenCalled();

    apiRequest.mockRejectedValueOnce(new Error("x"));
    act(() => { result.current.setDueDate("2026-09-20"); result.current.setTime("14:30"); });
    await act(async () => result.current.handleCreate());
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not create the task."));
  });

  it("does nothing without a title", async () => {
    const { result } = setup();
    await act(async () => result.current.handleCreate());
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
