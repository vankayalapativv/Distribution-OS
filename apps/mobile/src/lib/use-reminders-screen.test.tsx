import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useRemindersScreen } from "./use-reminders-screen";

const getLocalDb = vi.fn<() => unknown>(() => ({}));
const listReminders = vi.fn(() => [{ id: 1, title: "r" }]);
const listAssignedTasks = vi.fn(() => [{ id: "t1", title: "task" }]);
const listFollowupReminders = vi.fn(() => [{ customerId: "c1" }]);
const refreshAssignedTasksNow = vi.fn<() => Promise<void>>(() => Promise.resolve());
const kickSync = vi.fn<() => Promise<void>>(() => Promise.resolve());
const actions = { onDone: vi.fn(), confirmDoneAssigned: vi.fn(), confirmDelete: vi.fn(), confirmDoneFollowup: vi.fn() };
let pullFn: () => Promise<void>;

vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: vi.fn(), alert: vi.fn() }) }));
vi.mock("./auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./reminders", () => ({ listReminders: (...a: unknown[]) => listReminders(...(a as [])) }));
vi.mock("./assigned-tasks", () => ({ listAssignedTasks: (...a: unknown[]) => listAssignedTasks(...(a as [])) }));
vi.mock("./customer/followups", () => ({ listFollowupReminders: (...a: unknown[]) => listFollowupReminders(...(a as [])) }));
vi.mock("./sync", () => ({ refreshAssignedTasksNow: () => refreshAssignedTasksNow(), kickSync: () => kickSync() }));
vi.mock("./reminders-actions", () => ({ buildReminderActions: () => actions }));
vi.mock("./use-pull-refresh", () => ({ usePullRefresh: (fn: () => Promise<void>) => { pullFn = fn; return { refreshing: false, onRefresh: fn }; } }));

beforeEach(() => { getLocalDb.mockReturnValue({}); });
afterEach(() => vi.clearAllMocks());

describe("useRemindersScreen", () => {
  it("loads reminders, assigned tasks and follow-ups on focus", async () => {
    const { result } = renderHook(() => useRemindersScreen());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.reminders).toEqual([{ id: 1, title: "r" }]);
    expect(result.current.assigned).toEqual([{ id: "t1", title: "task" }]);
    expect(result.current.followups).toEqual([{ customerId: "c1" }]);
    expect(typeof result.current.now).toBe("number");
    expect(result.current.loading).toBe(false); // DB ready at mount → no shimmer
    expect(refreshAssignedTasksNow).toHaveBeenCalled(); // background refetch on focus
  });

  it("exposes the row actions from buildReminderActions", () => {
    const { result } = renderHook(() => useRemindersScreen());
    expect(result.current.onDone).toBe(actions.onDone);
    expect(result.current.confirmDelete).toBe(actions.confirmDelete);
  });

  it("pull-to-refresh re-syncs assigned tasks and the queue, then refreshes", async () => {
    renderHook(() => useRemindersScreen());
    listReminders.mockClear();
    await act(async () => { await pullFn(); });
    expect(refreshAssignedTasksNow).toHaveBeenCalled();
    expect(kickSync).toHaveBeenCalled();
    expect(listReminders).toHaveBeenCalled();
  });

  it("stays in the loading state (shimmer) until the local db is ready", async () => {
    getLocalDb.mockReturnValue(null);
    const { result } = renderHook(() => useRemindersScreen());
    await act(async () => { await Promise.resolve(); });
    expect(listReminders).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("stops refreshing once the screen has unmounted", async () => {
    const { unmount } = renderHook(() => useRemindersScreen());
    unmount();
    listReminders.mockClear();
    await act(async () => { await pullFn(); });
    expect(listReminders).not.toHaveBeenCalled(); // mounted guard short-circuits
  });
});
