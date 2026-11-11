import { describe, expect, it } from "vitest";
import { buildRemindAt, buildTaskPayload, seTimingMissing, type TaskCreateForm } from "./task-payload";

const form = (over: Partial<TaskCreateForm> = {}): TaskCreateForm =>
  ({ title: "Do it", description: "", priority: "medium", dueDate: "", time: "", assignee: "", customer: "", assigneeIsSe: false, ...over });

describe("buildRemindAt", () => {
  it("builds an IST instant only for an SE with date + time", () => {
    expect(buildRemindAt(true, "2026-09-20", "14:30")).toBe("2026-09-20T09:00:00.000Z"); // 2:30 PM IST → 09:00Z
    expect(buildRemindAt(false, "2026-09-20", "14:30")).toBeNull(); // office task
    expect(buildRemindAt(true, "2026-09-20", "")).toBeNull(); // time missing
    expect(buildRemindAt(true, "", "14:30")).toBeNull(); // date missing
  });
});

describe("buildTaskPayload", () => {
  it("trims title/description and nulls empty optionals", () => {
    expect(buildTaskPayload(form({ title: "  Call  ", description: "  " }))).toEqual({
      title: "Call", description: null, priority: "medium", dueDate: null, remindAt: null, assignedTo: null, customerId: null,
    });
  });

  it("includes the reminder, assignee, customer and due date when set", () => {
    const p = buildTaskPayload(form({ description: "note", dueDate: "2026-09-20", time: "14:30", assignee: "u1", customer: "c1", assigneeIsSe: true }));
    expect(p).toMatchObject({ description: "note", dueDate: "2026-09-20", assignedTo: "u1", customerId: "c1", remindAt: "2026-09-20T09:00:00.000Z" });
  });
});

describe("seTimingMissing", () => {
  it("is true only for an SE lacking a date or a time", () => {
    expect(seTimingMissing(true, "", "14:30")).toBe(true);
    expect(seTimingMissing(true, "2026-09-20", "")).toBe(true);
    expect(seTimingMissing(true, "2026-09-20", "14:30")).toBe(false);
    expect(seTimingMissing(false, "", "")).toBe(false);
  });
});
