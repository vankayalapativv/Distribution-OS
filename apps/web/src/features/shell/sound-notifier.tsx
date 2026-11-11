"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { alertHidden, clearTabAlert, requestNotifyPermission } from "./tab-alert";
import { fetchBadgeCounts } from "./badge-fetch";
import { disableWebPush, enableWebPush } from "./web-push-register";

/** Ask for notification permission and, on a grant, register browser Web Push. */
function requestNotifyAndPush(): void {
  void requestNotifyPermission().then((perm) => {
    if (perm === "granted") void enableWebPush();
  });
}

type LatestOrder = { value: number; customer: string; executive: string | null };
type LatestCollection = { amount: number; customer: string; executive: string | null };
type LatestVisit = { customer: string; executive: string | null };

/** Lead with the executive's first name for context when present. */
function sePrefix(name: string | null | undefined): string {
  return name ? `${name} · ` : "";
}

/** Notification body for a just-arrived order (priced or not). */
function orderBody(lo: LatestOrder | null | undefined): string {
  if (!lo) return "New order received";
  const tail = lo.value ? `${lo.customer} · ${inr(lo.value)}` : lo.customer;
  return `${sePrefix(lo.executive)}${tail}`;
}

/** Notification body for a just-arrived collection. */
function collectionBody(lc: LatestCollection | null | undefined): string {
  if (!lc) return "New collection received";
  return `${sePrefix(lc.executive)}${inr(lc.amount)} from ${lc.customer}`;
}

/** Notification body for a just-arrived visit check-in. */
function visitBody(lv: LatestVisit | null | undefined): string {
  if (!lv) return "Customer visit check-in";
  if (lv.executive) return `${lv.executive} · ${lv.customer}`;
  return `${lv.customer} checked in`;
}

/**
 * App-wide audio alert for new orders / collections. Mounted once in the top bar
 * so it runs on every dashboard page. Polls the same-origin `/api/badge-counts`
 * (which returns `ordersNew` / `collectionsNew` — new since the user last opened
 * those pages) every POLL_MS; when either count RISES between polls it plays the
 * matching chime once. Silent on the first poll (baseline) so it never blares at
 * items that already existed.
 *
 * Sound is ON by default (remembered per browser; the Settings → Account toggle
 * turns it off). Browsers block audio until the user interacts with the page, so
 * the first pointer/key gesture on each load silently unlocks playback (and asks
 * for notification permission); turning it on from Settings unlocks it too.
 */

const KEY = "distribution-os:sound-on";
const CHANGE_EVENT = "distribution-os:sound-changed";
const POLL_MS = 20000;
const ORDER_SRC = "/sounds/order.wav";
const COLLECTION_SRC = "/sounds/collection.mp3";
const VISIT_SRC = "/sounds/visit.wav";

/** ₹ with Indian grouping, whole rupees — for the notification body. */
function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// Module-level so ONE unlock survives the notifier remounting on client-side
// navigation. The browser's audio activation is per-document and persists across
// client (non-reload) navigation, so once the user has clicked once, sounds keep
// working on every page without re-clicking. (A full page reload resets both.)
let audioUnlocked = false;

/** Flip the module-level unlock flag. */
function markUnlocked(): void {
  audioUnlocked = true;
}

function isOn(): boolean {
  try {
    // On by default — only an explicit "0" (the user turned it off) mutes it.
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

function setOnStored(next: boolean): void {
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // storage blocked — the in-tab event below still updates the UI for this session
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** localStorage-backed toggle read via useSyncExternalStore (hydration-safe).
 *  Exported so the Settings control can reflect + flip the same state. */
export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(CHANGE_EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(CHANGE_EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    isOn,
    () => false,
  );
}

// A dedicated audio element for the "turning on" confirmation chime (the click
// that enables sound also serves as the browser's audio-unlock gesture).
let confirmAudio: HTMLAudioElement | null = null;

function confirmSoundUnlock(): void {
  if (!confirmAudio) {
    confirmAudio = new Audio(ORDER_SRC);
    confirmAudio.preload = "auto";
  }
  confirmAudio.currentTime = 0;
  void confirmAudio.play().then(() => markUnlocked()).catch(() => {});
  // This user gesture is also the moment to ask for OS-notification permission
  // and register browser Web Push, so alerts arrive even with the tab closed.
  requestNotifyAndPush();
}

/**
 * Turn sound alerts on/off (persisted per browser). The notifier island reads
 * the same flag, so flipping it here controls the app-wide chimes. Turning on
 * confirms + unlocks audio; turning off drops the browser push subscription.
 */
export function setSoundAlertsOn(next: boolean): void {
  setOnStored(next);
  if (next) confirmSoundUnlock();
  else void disableWebPush();
}

/**
 * Background island only — renders nothing. Mounted once in the dashboard shell
 * so the poll/chime/push logic runs on every page. The on/off control lives in
 * Settings → Account (see `features/settings/sound-setting.tsx`), which flips the
 * same persisted flag via `setSoundAlertsOn`.
 */
export function SoundNotifier() {
  const audioRef = useRef<{
    order: HTMLAudioElement;
    coll: HTMLAudioElement;
    visit: HTMLAudioElement;
  } | null>(null);
  const prev = useRef<{ o: number; c: number; v: number } | null>(null);

  /** Create the audio elements once, on first use (never during render). */
  function audio() {
    if (!audioRef.current) {
      const order = new Audio(ORDER_SRC);
      const coll = new Audio(COLLECTION_SRC);
      const visit = new Audio(VISIT_SRC);
      order.preload = "auto";
      coll.preload = "auto";
      visit.preload = "auto";
      audioRef.current = { order, coll, visit };
    }
    return audioRef.current;
  }

  // After a reload with sound on, the browser needs one gesture before audio can
  // play — silently unlock on the first pointer interaction.
  useEffect(() => {
    function unlock() {
      if (!isOn() || audioUnlocked) return;
      // This gesture is also the moment to ask for OS-notification permission +
      // register Web Push — an already-sound-on user unlocks HERE (not via the
      // toggle), so without this the browser never prompts / never subscribes.
      requestNotifyAndPush();
      const a = audio().order;
      const vol = a.volume;
      a.volume = 0;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = vol;
          markUnlocked();
        })
        .catch(() => {
          a.volume = vol;
        });
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Returning to the tab clears the flashing title + badged favicon.
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) clearTabAlert();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Returning user with sound on + permission already granted: make sure the
  // Web Push subscription still exists server-side (idempotent).
  useEffect(() => {
    if (isOn() && typeof Notification !== "undefined" && Notification.permission === "granted") {
      void enableWebPush();
    }
  }, []);

  // Poll for new orders/collections and chime on an increase.
  useEffect(() => {
    let alive = true;
    function play(a: HTMLAudioElement) {
      a.currentTime = 0;
      void a.play().catch(() => {});
    }
    async function tick() {
      try {
        const d = await fetchBadgeCounts();
        const o = d.ordersNew ?? 0;
        const c = d.collectionsNew ?? 0;
        const v = d.visitsNew ?? 0;
        const p = prev.current;
        prev.current = { o, c, v };
        if (!p || !isOn() || !audioUnlocked) return; // baseline / muted / not unlocked
        // Play the chime AND — when the tab is hidden (another tab / minimized) —
        // pop a desktop notification + flash the tab title/favicon so it reaches
        // the user while they're doing other work. alertHidden no-ops when visible.
        // Bodies are enriched with the just-arrived item's amount + customer, and
        // lead with the executive's first name when present (see `*Body` helpers).
        if (o > p.o) {
          play(audio().order);
          alertHidden({ title: "New order", body: orderBody(d.latestOrder), tag: "distribution-os-order" });
        }
        if (c > p.c) {
          play(audio().coll);
          alertHidden({ title: "New collection", body: collectionBody(d.latestCollection), tag: "distribution-os-collection" });
        }
        if (v > p.v) {
          play(audio().visit);
          alertHidden({ title: "New check-in", body: visitBody(d.latestVisit), tag: "distribution-os-visit" });
        }
      } catch {
        // network hiccup — ignore, next tick retries
      }
    }
    void tick();
    const id = setInterval(() => {
      if (alive) void tick();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return null;
}
