import { Linking } from "react-native";
import type { ConfirmOptions, PromptOptions } from "../components/dialog";
import { dayEndedToday, startDayTracking } from "./gps";
import { promptOdometer } from "./odometer-prompt";
import { runStartDayPermissionSetup } from "./permissions";

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
type Prompt = (opts: PromptOptions) => Promise<string | null>;

const DAY_ENDED_DIALOG = {
  title: "Day already ended",
  message: "You've ended your day. Start again tomorrow morning.",
  confirmLabel: "OK",
} as const;

/**
 * The full "Start day" sequence — already-ended guard → guided permission setup →
 * start GPS tracking, with the matching error dialogs. Returns true once the day
 * is actively tracking. Shared by the Home Start-day tile and the customer-page
 * check-in gate so both behave identically.
 */
export async function runStartDayFlow(confirm: Confirm, prompt: Prompt): Promise<boolean> {
  if (await dayEndedToday()) {
    void confirm(DAY_ENDED_DIALOG);
    return false;
  }

  const perms = await runStartDayPermissionSetup(confirm);
  if (!perms.ok) return false;

  // Mandatory starting odometer reading — the day doesn't begin without it.
  // Cancelling the prompt leaves the day un-started.
  const startOdometer = await promptOdometer(
    { prompt, confirm },
    {
      title: "Starting odometer",
      message: "Enter your vehicle's current odometer reading (km) to start the day.",
    },
  );
  if (startOdometer == null) return false;

  const result = await startDayTracking({ startOdometer });
  if (!result.ok) {
    if (result.reason === "day_ended") {
      void confirm(DAY_ENDED_DIALOG);
      return false;
    }
    const openSettings = await confirm({
      title: "Location required",
      message: "Day tracking needs your GPS position. Enable location permission for this app.",
      confirmLabel: "Open settings",
    });
    if (openSettings) void Linking.openSettings();
    return false;
  }

  return true;
}
