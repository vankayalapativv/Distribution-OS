"use client";

import { setSoundAlertsOn, useSoundOn } from "@/features/shell/sound-notifier";
import { SettingRow } from "./settings-shared";

/** iOS-style on/off switch (no shared Switch primitive in this project yet). */
function Switch({ on, onChange, label }: Readonly<{ on: boolean; onChange: (next: boolean) => void; label: string }>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
        on ? "justify-end bg-primary" : "justify-start bg-muted-foreground/30"
      }`}
    >
      <span className="inline-block size-5 rounded-full bg-white shadow" />
    </button>
  );
}

/**
 * Sound-alerts toggle for the Settings → Account panel. Moved here from the top
 * bar — it flips the same per-browser flag the background notifier island reads.
 * Turning it on plays a confirmation chime (which also unlocks browser audio)
 * and registers desktop/push notifications.
 */
export function SoundAlertsSetting() {
  const on = useSoundOn();
  return (
    <SettingRow
      label="Sound alerts"
      description="Play a chime and show a desktop notification when a new order, collection or visit arrives. Saved for this browser."
    >
      <Switch on={on} onChange={setSoundAlertsOn} label={on ? "Turn off sound alerts" : "Turn on sound alerts"} />
    </SettingRow>
  );
}
