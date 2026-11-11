"use client";

import { useEffect } from "react";

/**
 * Local-draft persistence for in-progress forms (#5 "never silently drop a
 * write"). The web app is online-only, so an outage / reload / accidental close
 * mid-entry would otherwise lose everything the user typed. These helpers stash
 * the form's text values in localStorage as the user types and restore them
 * next time, so the highest-value flows (recording a collection, rejecting a
 * payment) survive a blip. File attachments can't be persisted — only the JSON
 * fields — so a receipt must always be re-attached.
 */

const PREFIX = "distribution-os:draft:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // localStorage can throw in private mode / when disabled
  }
}

/** Read a saved draft (used to seed a form's initial state). */
export function readDraft<T>(key: string): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Remove a saved draft — call on a successful submit or an explicit discard. */
export function clearDraft(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch {
    // ignore — nothing we can do, and it must never break the submit path
  }
}

function writeRaw(key: string, raw: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PREFIX + key, raw);
  } catch {
    // quota / disabled — best-effort only
  }
}

/**
 * Auto-save `value` to localStorage (debounced) while `enabled` and non-empty.
 *
 * - Closing the form (`enabled` false) leaves the draft in place, so it survives
 *   a cancel or a full reload.
 * - Clearing the form to empty removes the stale draft.
 * - Returns `clear()` to wipe the draft explicitly (call it after a successful
 *   submit and from a "Discard" control).
 */
export function useFormDraft<T>(opts: {
  key: string;
  value: T;
  enabled: boolean;
  isEmpty: (value: T) => boolean;
}): { clear: () => void } {
  const { key, value, enabled, isEmpty } = opts;
  const dirty = enabled && !isEmpty(value);
  // Serialize in render (pure) so the effect only re-runs on a real change.
  const serialized = dirty ? JSON.stringify(value) : null;

  useEffect(() => {
    if (!enabled) return; // closed → keep whatever is saved
    if (serialized === null) {
      clearDraft(key); // open but empty → drop any stale draft
      return;
    }
    const timer = setTimeout(() => writeRaw(key, serialized), 400);
    return () => clearTimeout(timer);
  }, [key, enabled, serialized]);

  return { clear: () => clearDraft(key) };
}
