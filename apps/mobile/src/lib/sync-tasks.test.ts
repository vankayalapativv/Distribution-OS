import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullAssignedTasks, refreshAssignedTasksNow } from "./sync-tasks";

const apiFetch = vi.fn();
const reconcileAssignedTasks = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getLocalDb = vi.fn<() => unknown>();
let token: string | null = "tok";
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./assigned-tasks", () => ({ reconcileAssignedTasks: (...a: unknown[]) => reconcileAssignedTasks(...a) }));

const db = { id: "db" };
beforeEach(() => { token = "tok"; getLocalDb.mockReturnValue(db); });
afterEach(() => vi.clearAllMocks());

describe("pullAssignedTasks", () => {
  it("reconciles the pulled tasks into the cache", async () => {
    apiFetch.mockResolvedValue({ tasks: [{ id: "t1" }] });
    await pullAssignedTasks(db as never, "tok", 100);
    expect(apiFetch).toHaveBeenCalledWith("/me/tasks", { token: "tok" });
    expect(reconcileAssignedTasks).toHaveBeenCalledWith(db, [{ id: "t1" }], 100);
  });
  it("ignores a non-array payload", async () => {
    apiFetch.mockResolvedValue({ tasks: "nope" });
    await pullAssignedTasks(db as never, "tok", 100);
    expect(reconcileAssignedTasks).not.toHaveBeenCalled();
  });
  it("keeps the cache on a fetch failure (offline)", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    await expect(pullAssignedTasks(db as never, "tok", 100)).resolves.toBeUndefined();
    expect(reconcileAssignedTasks).not.toHaveBeenCalled();
  });
});

describe("refreshAssignedTasksNow", () => {
  it("pulls when a db + token are available", async () => {
    apiFetch.mockResolvedValue({ tasks: [] });
    await refreshAssignedTasksNow();
    expect(apiFetch).toHaveBeenCalledWith("/me/tasks", { token: "tok" });
  });
  it("does nothing without a db", async () => {
    getLocalDb.mockReturnValue(null);
    await refreshAssignedTasksNow();
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("does nothing without a token", async () => {
    token = null;
    await refreshAssignedTasksNow();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
