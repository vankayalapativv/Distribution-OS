import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStartDayPermissionSetup } from "./permissions";

type Perm = { granted: boolean; canAskAgain: boolean };
const granted: Perm = { granted: true, canAskAgain: true };
const denied: Perm = { granted: false, canAskAgain: true };
const blocked: Perm = { granted: false, canAskAgain: false };

const H = vi.hoisted(() => ({
  loc: {
    getForegroundPermissionsAsync: vi.fn(),
    requestForegroundPermissionsAsync: vi.fn(),
    getBackgroundPermissionsAsync: vi.fn(),
    requestBackgroundPermissionsAsync: vi.fn(),
  },
  notifGet: vi.fn(),
  notifReq: vi.fn(),
  camGet: vi.fn(),
  camReq: vi.fn(),
  openSettings: vi.fn(),
  isIgnoringBatteryOptimizations: vi.fn(),
  requestIgnoreBatteryOptimizations: vi.fn(),
  runStartDayNudges: vi.fn(),
}));
const loc = H.loc;
const openSettings = H.openSettings;
const isIgnoringBatteryOptimizations = H.isIgnoringBatteryOptimizations as ReturnType<typeof vi.fn> & (() => Promise<boolean>);
const requestIgnoreBatteryOptimizations = H.requestIgnoreBatteryOptimizations;
const runStartDayNudges = H.runStartDayNudges;

vi.mock("expo-location", () => H.loc);
vi.mock("expo-notifications", () => ({ getPermissionsAsync: () => H.notifGet(), requestPermissionsAsync: () => H.notifReq() }));
vi.mock("expo-image-picker", () => ({ getCameraPermissionsAsync: () => H.camGet(), requestCameraPermissionsAsync: () => H.camReq() }));
vi.mock("react-native", () => ({ Linking: { openSettings: () => H.openSettings() } }));
vi.mock("./permissions-native", () => ({
  isIgnoringBatteryOptimizations: () => H.isIgnoringBatteryOptimizations(),
  requestIgnoreBatteryOptimizations: () => H.requestIgnoreBatteryOptimizations(),
  openAutostartSettings: vi.fn(),
}));
vi.mock("./permissions-nudges", () => ({ runStartDayNudges: (...a: unknown[]) => H.runStartDayNudges(...a) }));
vi.mock("./permissions-reminder-delivery", () => ({ ensureReminderDelivery: vi.fn() }));
vi.mock("./permissions-autostart", () => ({ maybePromptAutostart: vi.fn() }));

const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
beforeEach(() => {
  loc.getForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.requestForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.getBackgroundPermissionsAsync.mockResolvedValue(granted);
  loc.requestBackgroundPermissionsAsync.mockResolvedValue(granted);
  H.notifGet.mockResolvedValue(granted);
  H.notifReq.mockResolvedValue(granted);
  H.camGet.mockResolvedValue(denied);
  H.camReq.mockResolvedValue(granted);
  isIgnoringBatteryOptimizations.mockResolvedValue(true);
  confirm.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("runStartDayPermissionSetup", () => {
  it("passes through when every essential is granted", async () => {
    expect(await runStartDayPermissionSetup(confirm)).toEqual({ ok: true });
    expect(runStartDayNudges).toHaveBeenCalledWith(confirm);
  });

  it("blocks when the prominent disclosure is declined", async () => {
    confirm.mockResolvedValueOnce(false); // disclosure
    expect(await runStartDayPermissionSetup(confirm)).toEqual({ ok: false, missingEssential: "location" });
  });

  it("requests foreground when askable, then blocks + opens settings if still denied", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(denied);
    loc.requestForegroundPermissionsAsync.mockResolvedValue(denied);
    expect(await runStartDayPermissionSetup(confirm)).toEqual({ ok: false, missingEssential: "location" });
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalled();
  });

  it("blocks on background location, requesting it when askable", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue(denied);
    loc.requestBackgroundPermissionsAsync.mockResolvedValue(denied);
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ ok: false, missingEssential: "background", awaitingSystemScreen: true });
    expect(loc.requestBackgroundPermissionsAsync).toHaveBeenCalled();
  });

  it("opens settings for background when it can't be asked again", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue(blocked);
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "background" });
    expect(openSettings).toHaveBeenCalled();
    expect(loc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("tolerates a background read error and still blocks", async () => {
    loc.getBackgroundPermissionsAsync.mockRejectedValue(new Error("x"));
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "background" });
  });

  it("does not request background when the SE declines the prompt", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue(denied);
    confirm.mockImplementation(async (o: unknown) => (o as { title: string }).title !== "Allow location all the time");
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "background", awaitingSystemScreen: false });
    expect(loc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("blocks on foreground without opening settings when that prompt is declined", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(denied);
    loc.requestForegroundPermissionsAsync.mockResolvedValue(denied);
    confirm.mockImplementation(async (o: unknown) => (o as { title: string }).title !== "Location is required");
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "location" });
    expect(openSettings).not.toHaveBeenCalled();
  });

  it("proceeds when background becomes granted after the request", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValueOnce(denied).mockResolvedValue(granted);
    expect(await runStartDayPermissionSetup(confirm)).toEqual({ ok: true });
    expect(loc.requestBackgroundPermissionsAsync).toHaveBeenCalled();
  });

  it("does not re-request foreground when it can't be asked again", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(blocked);
    await runStartDayPermissionSetup(confirm);
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalled();
  });

  it("requests notifications + camera only when askable, swallowing their failures", async () => {
    H.notifGet.mockResolvedValue(denied); // ask for notifications
    H.notifReq.mockRejectedValue(new Error("x")); // and the request fails → swallowed
    H.camGet.mockResolvedValue(granted); // camera already granted → skip its request
    await runStartDayPermissionSetup(confirm);
    expect(H.notifReq).toHaveBeenCalled();
    expect(H.camReq).not.toHaveBeenCalled();
  });

  it("swallows a camera-request failure", async () => {
    H.camGet.mockResolvedValue(denied);
    H.camReq.mockRejectedValue(new Error("x"));
    expect(await runStartDayPermissionSetup(confirm)).toEqual({ ok: true });
  });

  it("tolerates a background re-read failure after the request", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValueOnce(denied).mockRejectedValue(new Error("x"));
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "background" });
  });

  it("swallows a background-request failure", async () => {
    loc.getBackgroundPermissionsAsync.mockResolvedValue(denied);
    loc.requestBackgroundPermissionsAsync.mockRejectedValue(new Error("x"));
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "background" });
  });

  it("blocks on the battery-optimization exemption", async () => {
    isIgnoringBatteryOptimizations.mockResolvedValue(false);
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ ok: false, missingEssential: "battery", awaitingSystemScreen: true });
    expect(requestIgnoreBatteryOptimizations).toHaveBeenCalled();
  });

  it("does not request battery exemption when the prompt is declined", async () => {
    isIgnoringBatteryOptimizations.mockResolvedValue(false);
    confirm.mockImplementation(async (o: unknown) => (o as { title: string }).title !== "Allow Distribution OS to run all day");
    expect(await runStartDayPermissionSetup(confirm)).toMatchObject({ missingEssential: "battery", awaitingSystemScreen: false });
    expect(requestIgnoreBatteryOptimizations).not.toHaveBeenCalled();
  });
});
