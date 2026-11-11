import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { reportMobileError } from "./report-error";

/**
 * Native (non-JS) crash detection.
 *
 * `ErrorUtils`/promise-rejection handlers can only catch JS-thread errors — a
 * true native crash (or a hard OS kill / out-of-memory) tears the process down
 * without any JS running, so it never reaches the monitor. We detect it after
 * the fact: a flag marks the app "active" while it's in the FOREGROUND and clears
 * it when it goes to the background. If the flag is still set on the NEXT launch,
 * the previous session died while in the foreground — a probable native crash.
 * (Background kills / normal force-quits clear the flag first, so they don't
 * count.) It's a heuristic, so the report says so.
 */
const KEY = "sri_aparajita_fg_active";

async function setActive(v: "0" | "1"): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, v);
  } catch {
    // best-effort — never let the crash detector itself throw
  }
}

/** Run ONCE at startup, before marking active: a leftover flag = prior crash. */
export async function detectPreviousNativeCrash(): Promise<void> {
  try {
    const wasActive = await SecureStore.getItemAsync(KEY).catch(() => null);
    if (wasActive === "1") {
      const e = new Error(
        "App terminated while in the foreground with no JS error captured — a probable native crash or hard OS kill (e.g. out-of-memory).",
      );
      e.name = "NativeCrash";
      reportMobileError(e, { boundary: "abnormal-termination", level: "fatal" });
    }
  } catch {
    // ignore
  }
  await setActive("1");
}

/** Track foreground/background so the flag is only "active" in the foreground. */
export function installSessionActivityTracking(): void {
  AppState.addEventListener("change", (state) => {
    void setActive(state === "active" ? "1" : "0");
  });
}
