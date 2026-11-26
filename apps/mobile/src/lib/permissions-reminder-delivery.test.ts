import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureReminderDelivery } from "./permissions-reminder-delivery";

const canScheduleExactAlarms = vi.fn();
const isIgnoringBatteryOptimizations = vi.fn();
const openExactAlarmSettings = vi.fn(() => Promise.resolve());
const requestIgnoreBatteryOptimizations = vi.fn(() => Promise.resolve());
vi.mock("./permissions-native", () => ({
  canScheduleExactAlarms: () => canScheduleExactAlarms(),
  isIgnoringBatteryOptimizations: () => isIgnoringBatteryOptimizations(),
  openExactAlarmSettings: () => openExactAlarmSettings(),
  requestIgnoreBatteryOptimizations: () => requestIgnoreBatteryOptimizations(),
}));

beforeEach(() => {
  canScheduleExactAlarms.mockResolvedValue(true);
  isIgnoringBatteryOptimizations.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("ensureReminderDelivery", () => {
  it("prompts for nothing when both settings are already granted", async () => {
    const confirm = vi.fn();
    await ensureReminderDelivery(confirm);
    expect(confirm).not.toHaveBeenCalled();
    expect(openExactAlarmSettings).not.toHaveBeenCalled();
  });

  it("opens exact-alarm settings when the SE agrees", async () => {
    canScheduleExactAlarms.mockResolvedValue(false);
    const confirm = vi.fn().mockResolvedValue(true);
    await ensureReminderDelivery(confirm);
    expect(openExactAlarmSettings).toHaveBeenCalledOnce();
  });

  it("skips exact-alarm settings when the SE declines", async () => {
    canScheduleExactAlarms.mockResolvedValue(false);
    const confirm = vi.fn().mockResolvedValue(false);
    await ensureReminderDelivery(confirm);
    expect(openExactAlarmSettings).not.toHaveBeenCalled();
  });

  it("requests the battery-optimization exemption when the SE agrees", async () => {
    isIgnoringBatteryOptimizations.mockResolvedValue(false);
    const confirm = vi.fn().mockResolvedValue(true);
    await ensureReminderDelivery(confirm);
    expect(requestIgnoreBatteryOptimizations).toHaveBeenCalledOnce();
  });

  it("skips the battery exemption when the SE declines", async () => {
    isIgnoringBatteryOptimizations.mockResolvedValue(false);
    const confirm = vi.fn().mockResolvedValue(false);
    await ensureReminderDelivery(confirm);
    expect(requestIgnoreBatteryOptimizations).not.toHaveBeenCalled();
  });
});
