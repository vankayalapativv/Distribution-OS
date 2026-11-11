import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRIORITY_CLASSES, STATUS_CLASSES, STATUS_LABELS, STATUS_TABS,
  formatDate, formatReminder, isOverdue,
} from "./tasks-shared";
import type { Task } from "./tasks-api";

const task = (over: Partial<Task> = {}): Task => ({ id: "t1", status: "open", dueDate: null, ...over } as Task);

describe("formatDate / formatReminder", () => {
  it("dash for null, formatted for a valid date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("2026-09-14")).toMatch(/Sep/);
    expect(formatReminder(null)).toBe("—");
    expect(formatReminder("2026-09-14T04:00:00.000Z")).toMatch(/Sep/);
  });

  it("returns the raw string if formatting throws", () => {
    const d = vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => { throw new Error("x"); });
    expect(formatDate("2026-09-14")).toBe("2026-09-14");
    d.mockRestore();
    const s = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => { throw new Error("x"); });
    expect(formatReminder("2026-09-14T00:00:00Z")).toBe("2026-09-14T00:00:00Z");
    s.mockRestore();
  });
});

describe("isOverdue", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z")));
  afterEach(() => vi.useRealTimers());

  it("is false without a due date or once done/cancelled", () => {
    expect(isOverdue(task({ dueDate: null }))).toBe(false);
    expect(isOverdue(task({ dueDate: "2026-09-01", status: "done" }))).toBe(false);
    expect(isOverdue(task({ dueDate: "2026-09-01", status: "cancelled" }))).toBe(false);
  });

  it("is true for a past due open task, false for a future one", () => {
    expect(isOverdue(task({ dueDate: "2026-09-14", status: "open" }))).toBe(true);
    expect(isOverdue(task({ dueDate: "2026-09-20", status: "in_progress" }))).toBe(false);
  });
});

describe("constants", () => {
  it("expose the status tabs, labels and tone classes", () => {
    expect(STATUS_TABS.map((t) => t.key)).toEqual(["open", "in_progress", "done", "cancelled", "all"]);
    expect(STATUS_LABELS.in_progress).toBe("In progress");
    expect(PRIORITY_CLASSES.high).toMatch(/red/);
    expect(STATUS_CLASSES.done).toMatch(/green/);
  });
});
