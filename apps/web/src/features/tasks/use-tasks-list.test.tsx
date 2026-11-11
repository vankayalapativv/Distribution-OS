import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sp = new URLSearchParams();
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push, replace }),
  usePathname: () => "/tasks",
}));

import { useTasksList } from "./use-tasks-list";
import type { Task } from "./tasks-api";

const task = (over: Partial<Task> = {}): Task =>
  ({ id: "t1", title: "T", status: "open", priority: "medium", assignedTo: null, dueDate: null, ...over } as Task);
const seed = [
  task({ id: "a", status: "open", priority: "high", assignedTo: "me" }),
  task({ id: "b", status: "done", priority: "low", assignedTo: "other" }),
  task({ id: "c", status: "in_progress", priority: "high", assignedTo: "other" }),
];
const config = { apiBaseUrl: "", authToken: "", currentUserId: "me" };

beforeEach(() => { sp = new URLSearchParams(); replace.mockClear(); push.mockClear(); });

describe("useTasksList (URL-driven)", () => {
  it("defaults to the open tab and counts active tasks", () => {
    const { result } = renderHook(() => useTasksList(seed, config));
    expect(result.current.filtered.map((t) => t.id)).toEqual(["a"]);
    expect(result.current.openCount).toBe(2); // open + in_progress
  });

  it("derives the filtered rows from the URL (status / priority / mine)", () => {
    sp = new URLSearchParams("status=all");
    expect(renderHook(() => useTasksList(seed, config)).result.current.filtered).toHaveLength(3);
    sp = new URLSearchParams("status=all&priority=high");
    expect(renderHook(() => useTasksList(seed, config)).result.current.filtered.map((t) => t.id)).toEqual(["a", "c"]);
    sp = new URLSearchParams("status=all&priority=high&mine=1");
    expect(renderHook(() => useTasksList(seed, config)).result.current.filtered.map((t) => t.id)).toEqual(["a"]);
  });

  it("writes filters with replace and opens the task drawer with push", () => {
    const { result } = renderHook(() => useTasksList(seed, config));
    act(() => result.current.setStatusTab("done"));
    expect(replace).toHaveBeenCalledWith("/tasks?status=done", { scroll: false });
    act(() => result.current.setOpenTask(seed[0]));
    expect(push).toHaveBeenCalledWith("/tasks?task=a", { scroll: false });
    act(() => result.current.setOpenTask(null));
    expect(replace).toHaveBeenLastCalledWith("/tasks", { scroll: false });
  });

  it("derives the open task drawer from ?task=<id>", () => {
    sp = new URLSearchParams("task=c");
    const { result } = renderHook(() => useTasksList(seed, config));
    expect(result.current.openTask?.id).toBe("c");
  });

  it("adds, updates and removes tasks", () => {
    const { result } = renderHook(() => useTasksList(seed, config));
    act(() => result.current.addTask(task({ id: "z", status: "open" })));
    expect(result.current.tasks[0].id).toBe("z");
    act(() => result.current.updateTask(task({ id: "a", status: "done", assignedTo: "me" })));
    expect(result.current.tasks.find((t) => t.id === "a")?.status).toBe("done");
    act(() => result.current.removeTask("b"));
    expect(result.current.tasks.some((t) => t.id === "b")).toBe(false);
  });
});
