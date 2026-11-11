/**
 * One app-wide connectivity signal, so the UI and the non-React telemetry buffer
 * read the SAME "am I online" truth instead of each inferring it from failed
 * requests. Backed by a single expo-network listener; exposes a React hook
 * (useIsOnline) and plain getter/subscriber for modules outside React.
 *
 * "Online" means a network is connected AND the internet is reachable — a phone
 * on Wi-Fi with no upstream reads as offline (isInternetReachable === false),
 * matching how the sync engine gates uploads.
 */
import * as Network from "expo-network";
import { useSyncExternalStore } from "react";

// Optimistic until the first probe resolves — a brief false "online" is safer
// than flashing "offline" on a cold start that is actually connected.
let online = true;
let started = false;
const listeners = new Set<() => void>();

function toOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

function set(next: boolean): void {
  if (next === online) return;
  online = next;
  for (const l of listeners) l();
}

/** Lazily start the single network listener on first read/subscribe. */
function ensureStarted(): void {
  if (started) return;
  started = true;
  Network.getNetworkStateAsync().then((s) => set(toOnline(s))).catch(() => undefined);
  Network.addNetworkStateListener((s) => set(toOnline(s)));
}

/** Current online state for non-React callers (telemetry buffer, guards). */
export function getIsOnline(): boolean {
  ensureStarted();
  return online;
}

function subscribe(cb: () => void): () => void {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Subscribe to online/offline transitions from outside React. Returns unsubscribe. */
export function subscribeOnline(cb: (online: boolean) => void): () => void {
  return subscribe(() => cb(online));
}

/** React hook: re-renders when connectivity flips. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, () => online, () => online);
}
