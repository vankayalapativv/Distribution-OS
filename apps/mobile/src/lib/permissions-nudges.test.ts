import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStartDayNudges } from "./permissions-nudges";

const canScheduleExactAlarms = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const openExactAlarmSettings = vi.fn<() => Promise<void>>(() => Promise.resolve());
const maybePromptAutostart = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("./permissions-native", () => ({
  canScheduleExactAlarms: () => canScheduleExactAlarms(),
  openExactAlarmSettings: () => openExactAlarmSettings(),
}));
vi.mock("./permissions-autostart", () => ({ maybePromptAutostart: (...a: unknown[]) => maybePromptAutostart(...a) }));

beforeEach(() => { canScheduleExactAlarms.mockResolvedValue(true); confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("runStartDayNudges", () => {
  it("skips the exact-alarm prompt when already allowed, still runs autostart", async () => {
    await runStartDayNudges(confirm);
    expect(confirm).not.toHaveBeenCalled();
    expect(maybePromptAutostart).toHaveBeenCalledWith(confirm);
  });
  it("prompts for exact alarm and opens settings on accept", async () => {
    canScheduleExactAlarms.mockResolvedValue(false);
    await runStartDayNudges(confirm);
    expect(confirm).toHaveBeenCalled();
    expect(openExactAlarmSettings).toHaveBeenCalled();
    expect(maybePromptAutostart).toHaveBeenCalled();
  });
  it("skips opening settings when the exact-alarm prompt is declined", async () => {
    canScheduleExactAlarms.mockResolvedValue(false);
    confirm.mockResolvedValue(false);
    await runStartDayNudges(confirm);
    expect(openExactAlarmSettings).not.toHaveBeenCalled();
    expect(maybePromptAutostart).toHaveBeenCalled();
  });
});
