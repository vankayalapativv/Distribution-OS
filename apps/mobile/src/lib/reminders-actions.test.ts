import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReminderActions } from "./reminders-actions";
import type { Reminder } from "./reminders";
import type { AssignedTask } from "./assigned-tasks";
import type { FollowupReminder } from "./customer/followups";

const getLocalDb = vi.fn<() => unknown>(() => ({}));
const markReminderDone = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const deleteReminder = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const markAssignedTaskDone = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const resolveFollowup = vi.fn();

vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./reminders", () => ({
  markReminderDone: (...a: unknown[]) => markReminderDone(...a),
  deleteReminder: (...a: unknown[]) => deleteReminder(...a),
}));
vi.mock("./assigned-tasks", () => ({ markAssignedTaskDone: (...a: unknown[]) => markAssignedTaskDone(...a) }));
vi.mock("./customer/followups", () => ({ resolveFollowup: (...a: unknown[]) => resolveFollowup(...a) }));

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const refresh = vi.fn();
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const alert = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const dialog = { confirm, alert } as unknown as Parameters<typeof buildReminderActions>[2];
const make = () => buildReminderActions(refresh, "tok", dialog);

const reminder = { id: 1, title: "r", notificationId: "n", status: "pending" } as Reminder;
const task = { id: "t1", title: "task" } as unknown as AssignedTask;
const followup = { customerId: "c1", customerName: "Balaji", reason: "pay", followUpAt: "x" } as FollowupReminder;

beforeEach(() => { getLocalDb.mockReturnValue({}); confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("onDone", () => {
  it("marks the reminder done then refreshes", async () => {
    await make().onDone(reminder);
    expect(markReminderDone).toHaveBeenCalledWith({}, reminder);
    expect(refresh).toHaveBeenCalled();
  });
  it("no-ops without a local db", async () => {
    getLocalDb.mockReturnValue(null);
    await make().onDone(reminder);
    expect(markReminderDone).not.toHaveBeenCalled();
  });
});

describe("confirmDoneAssigned", () => {
  it("marks the task done on confirm then refreshes", async () => {
    make().confirmDoneAssigned(task);
    await flush();
    expect(markAssignedTaskDone).toHaveBeenCalledWith({}, task, "tok");
    expect(refresh).toHaveBeenCalled();
  });
  it("does nothing when declined", async () => {
    confirm.mockResolvedValue(false);
    make().confirmDoneAssigned(task);
    await flush();
    expect(markAssignedTaskDone).not.toHaveBeenCalled();
  });
  it("bails when the db vanished after confirm", async () => {
    getLocalDb.mockReturnValue(null);
    make().confirmDoneAssigned(task);
    await flush();
    expect(markAssignedTaskDone).not.toHaveBeenCalled();
  });
  it("alerts when marking the task done fails", async () => {
    markAssignedTaskDone.mockRejectedValue(new Error("offline"));
    make().confirmDoneAssigned(task);
    await flush();
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't mark done" }));
  });
});

describe("confirmDelete", () => {
  it("deletes on confirm then refreshes", async () => {
    make().confirmDelete(reminder);
    await flush();
    expect(deleteReminder).toHaveBeenCalledWith({}, reminder);
    expect(refresh).toHaveBeenCalled();
  });
  it("does not delete when declined", async () => {
    confirm.mockResolvedValue(false);
    make().confirmDelete(reminder);
    await flush();
    expect(deleteReminder).not.toHaveBeenCalled();
  });
  it("no-ops the delete without a db", async () => {
    getLocalDb.mockReturnValue(null);
    make().confirmDelete(reminder);
    await flush();
    expect(deleteReminder).not.toHaveBeenCalled();
  });
});

describe("confirmDoneFollowup", () => {
  it("resolves the follow-up on confirm then refreshes", async () => {
    make().confirmDoneFollowup(followup);
    await flush();
    expect(resolveFollowup).toHaveBeenCalledWith({}, "c1", "tok");
    expect(refresh).toHaveBeenCalled();
  });
  it("does nothing when declined or db-less", async () => {
    confirm.mockResolvedValue(false);
    make().confirmDoneFollowup(followup);
    await flush();
    expect(resolveFollowup).not.toHaveBeenCalled();
    confirm.mockResolvedValue(true);
    getLocalDb.mockReturnValue(null);
    make().confirmDoneFollowup(followup);
    await flush();
    expect(resolveFollowup).not.toHaveBeenCalled();
  });
});
