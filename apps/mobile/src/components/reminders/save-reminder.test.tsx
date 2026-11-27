import { beforeEach, describe, expect, it, vi } from "vitest";

const getLocalDb = vi.fn<() => unknown>(() => ({}));
const ensureReminderDelivery = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const ensureNotificationPermission = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const createReminder = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const updateReminder = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getReminderById = vi.fn<(...a: unknown[]) => unknown>(() => ({ id: 1 }));

vi.mock("../../lib/db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../../lib/permissions", () => ({ ensureReminderDelivery: (...a: unknown[]) => ensureReminderDelivery(...a) }));
vi.mock("../../lib/reminders", () => ({
  createReminder: (...a: unknown[]) => createReminder(...a),
  updateReminder: (...a: unknown[]) => updateReminder(...a),
  getReminderById: (...a: unknown[]) => getReminderById(...a),
  ensureNotificationPermission: () => ensureNotificationPermission(),
}));

import { router } from "expo-router";
import { saveReminder } from "./save-reminder";

const customer = { id: "c1", name: "Acme" } as never;
const future = () => new Date(Date.now() + 60 * 60 * 1000);

const args = (over: Record<string, unknown> = {}) => ({
  editId: null as number | null,
  title: "Call Acme",
  when: future(),
  customer,
  busy: false,
  confirm: vi.fn(() => Promise.resolve(true)),
  setError: vi.fn(),
  setBusy: vi.fn(),
  ...over,
});

beforeEach(() => {
  getLocalDb.mockReturnValue({});
  ensureReminderDelivery.mockResolvedValue(undefined as never);
  ensureNotificationPermission.mockResolvedValue(true as never);
  createReminder.mockReset().mockResolvedValue(undefined as never);
  updateReminder.mockReset().mockResolvedValue(undefined as never);
  getReminderById.mockReturnValue({ id: 1 });
  (router.back as ReturnType<typeof vi.fn>).mockClear?.();
});

describe("saveReminder validation", () => {
  it("no-ops while busy or without a db", async () => {
    const a = args({ busy: true });
    await saveReminder(a);
    expect(a.setError).not.toHaveBeenCalled();
    getLocalDb.mockReturnValue(null);
    const b = args();
    await saveReminder(b);
    expect(b.setError).not.toHaveBeenCalled();
  });

  it("rejects a blank title, a missing customer, and a past time", async () => {
    const blank = args({ title: "  " });
    await saveReminder(blank);
    expect(blank.setError).toHaveBeenCalledWith(expect.stringMatching(/remind you about/));
    const noCust = args({ customer: null });
    await saveReminder(noCust);
    expect(noCust.setError).toHaveBeenCalledWith(expect.stringMatching(/Pick the customer/));
    const past = args({ when: new Date(Date.now() - 1000) });
    await saveReminder(past);
    expect(past.setError).toHaveBeenCalledWith(expect.stringMatching(/future/));
  });

  it("blocks when notification permission is denied", async () => {
    ensureNotificationPermission.mockResolvedValue(false as never);
    const a = args();
    await saveReminder(a);
    expect(a.setError).toHaveBeenCalledWith(expect.stringMatching(/Allow notifications/));
    expect(createReminder).not.toHaveBeenCalled();
  });
});

describe("saveReminder persistence", () => {
  it("creates a new reminder then pops the screen", async () => {
    const a = args();
    await saveReminder(a);
    expect(createReminder).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it("updates an existing reminder in edit mode", async () => {
    const a = args({ editId: 5 });
    await saveReminder(a);
    expect(updateReminder).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it("skips the update when the reminder no longer exists", async () => {
    getReminderById.mockReturnValue(undefined);
    const a = args({ editId: 5 });
    await saveReminder(a);
    expect(updateReminder).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it("surfaces a save error and clears busy", async () => {
    createReminder.mockRejectedValue(new Error("db full"));
    const a = args();
    await saveReminder(a);
    expect(a.setError).toHaveBeenCalledWith("db full");
    expect(a.setBusy).toHaveBeenCalledWith(false);
  });

  it("uses a generic message for a non-Error failure", async () => {
    createReminder.mockRejectedValue("boom");
    const a = args();
    await saveReminder(a);
    expect(a.setError).toHaveBeenCalledWith("Could not save the reminder.");
  });
});
