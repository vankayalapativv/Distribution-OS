export type MissingEssential = "location" | "background" | "battery";

export interface StartDayPermissionResult {
  /** All essentials granted → the day can start. */
  ok: boolean;
  /** Which essential blocked the start (when ok is false). */
  missingEssential?: MissingEssential;
  /**
   * True when we just launched a system screen for the essential — the user
   * grants it there and taps "Start day" again (we can't observe the result
   * synchronously). Distinguishes "please act, then retry" from a hard denial.
   */
  awaitingSystemScreen?: boolean;
}
