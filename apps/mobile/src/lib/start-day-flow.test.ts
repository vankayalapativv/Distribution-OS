import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStartDayFlow } from "./start-day-flow";

const openSettings = vi.fn();
const dayEndedToday = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const startDayTracking = vi.fn<(...a: unknown[]) => Promise<{ ok: boolean; reason?: string }>>(() => Promise.resolve({ ok: true }));
const promptOdometer = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve("48210"));
const runStartDayPermissionSetup = vi.fn<(...a: unknown[]) => Promise<{ ok: boolean }>>(() => Promise.resolve({ ok: true }));

vi.mock("react-native", () => ({ Linking: { openSettings: () => openSettings() } }));
vi.mock("./gps", () => ({ dayEndedToday: () => dayEndedToday(), startDayTracking: (...a: unknown[]) => startDayTracking(...a) }));
vi.mock("./odometer-prompt", () => ({ promptOdometer: (...a: unknown[]) => promptOdometer(...a) }));
vi.mock("./permissions", () => ({ runStartDayPermissionSetup: (...a: unknown[]) => runStartDayPermissionSetup(...a) }));

const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const prompt = vi.fn();
beforeEach(() => {
  dayEndedToday.mockResolvedValue(false);
  startDayTracking.mockResolvedValue({ ok: true });
  promptOdometer.mockResolvedValue("48210");
  runStartDayPermissionSetup.mockResolvedValue({ ok: true });
  confirm.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("runStartDayFlow", () => {
  it("starts the day end-to-end", async () => {
    expect(await runStartDayFlow(confirm, prompt)).toBe(true);
    expect(startDayTracking).toHaveBeenCalledWith({ startOdometer: "48210" });
  });

  it("blocks when the day has already ended", async () => {
    dayEndedToday.mockResolvedValue(true);
    expect(await runStartDayFlow(confirm, prompt)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Day already ended" }));
    expect(runStartDayPermissionSetup).not.toHaveBeenCalled();
  });

  it("stops when the permission setup isn't satisfied", async () => {
    runStartDayPermissionSetup.mockResolvedValue({ ok: false });
    expect(await runStartDayFlow(confirm, prompt)).toBe(false);
    expect(promptOdometer).not.toHaveBeenCalled();
  });

  it("stops when the odometer prompt is cancelled", async () => {
    promptOdometer.mockResolvedValue(null);
    expect(await runStartDayFlow(confirm, prompt)).toBe(false);
    expect(startDayTracking).not.toHaveBeenCalled();
  });

  it("shows the already-ended dialog if tracking reports day_ended", async () => {
    startDayTracking.mockResolvedValue({ ok: false, reason: "day_ended" });
    expect(await runStartDayFlow(confirm, prompt)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Day already ended" }));
  });

  it("offers settings when tracking fails for a location reason", async () => {
    startDayTracking.mockResolvedValue({ ok: false, reason: "no_permission" });
    expect(await runStartDayFlow(confirm, prompt)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Location required" }));
    expect(openSettings).toHaveBeenCalled();
  });

  it("does not open settings if that prompt is declined", async () => {
    startDayTracking.mockResolvedValue({ ok: false, reason: "no_permission" });
    confirm.mockResolvedValue(false);
    expect(await runStartDayFlow(confirm, prompt)).toBe(false);
    expect(openSettings).not.toHaveBeenCalled();
  });
});
