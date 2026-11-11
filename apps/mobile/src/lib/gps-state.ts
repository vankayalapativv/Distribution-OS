/**
 * The two pieces of mutable module state for day tracking, behind accessors so
 * the split lifecycle / recording / watchdog modules can share them (an exported
 * `let` is read-only to importers — writes must go through a setter).
 */
import type { LocationSubscription } from "expo-location";

let currentClientSessionId: string | null = null;
export const getClientSessionId = (): string | null => currentClientSessionId;
export const setClientSessionId = (v: string | null): void => {
  currentClientSessionId = v;
};

// Foreground watcher (Expo Go / no-background fallback); its presence also means
// "a day is on in foreground mode".
let foregroundWatch: LocationSubscription | null = null;
export const getForegroundWatch = (): LocationSubscription | null => foregroundWatch;
export const setForegroundWatch = (v: LocationSubscription | null): void => {
  foregroundWatch = v;
};
