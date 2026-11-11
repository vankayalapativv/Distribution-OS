import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SoundNotifier } from "./sound-notifier";

type BadgeSnapshot = {
  ordersNew: number;
  collectionsNew: number;
  visitsNew?: number;
  latestOrder?: { value: number; customer: string; executive: string | null } | null;
  latestCollection?: { amount: number; customer: string; executive: string | null } | null;
  latestVisit?: { customer: string; executive: string | null } | null;
};

/** A fetch mock that returns each badge-count snapshot in turn (last one sticks). */
function badgeSequence(seq: BadgeSnapshot[]) {
  let i = 0;
  return vi.fn(async () => {
    const body = seq[Math.min(i, seq.length - 1)];
    i += 1;
    return { ok: true, json: async () => body } as unknown as Response;
  });
}

describe("SoundNotifier", () => {
  let played: string[];

  beforeEach(() => {
    played = [];
    localStorage.clear();
    vi.useFakeTimers();
    // jsdom doesn't implement media playback — mock it and record real (audible)
    // plays only. The silent "unlock" play sets volume 0, so it's ignored here.
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      if (this.volume !== 0) {
        if (this.src.includes("order.wav")) played.push("order");
        else if (this.src.includes("collection.mp3")) played.push("collection");
        else if (this.src.includes("visit.wav")) played.push("visit");
      }
      return Promise.resolve();
    });
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Enable sound, mount, and unlock via a user gesture. */
  async function mountEnabled(fetchMock: ReturnType<typeof badgeSequence>) {
    localStorage.setItem("distribution-os:sound-on", "1");
    vi.stubGlobal("fetch", fetchMock);
    render(<SoundNotifier />);
    window.dispatchEvent(new Event("pointerdown")); // browser unlock gesture
    await vi.advanceTimersByTimeAsync(0); // flush unlock + the immediate baseline poll
  }

  test("chimes on a rise, silent on the first poll, right sound per section", async () => {
    await mountEnabled(
      badgeSequence([
        { ordersNew: 2, collectionsNew: 5 }, // baseline (first poll) — must stay silent
        { ordersNew: 3, collectionsNew: 5 }, // +1 order
        { ordersNew: 3, collectionsNew: 6 }, // +1 collection
        { ordersNew: 3, collectionsNew: 6 }, // no change
      ]),
    );

    expect(played).toEqual([]); // first poll established the baseline — no chime

    await vi.advanceTimersByTimeAsync(20000); // ordersNew 2 -> 3
    expect(played).toEqual(["order"]);

    await vi.advanceTimersByTimeAsync(20000); // collectionsNew 5 -> 6
    expect(played).toEqual(["order", "collection"]);

    await vi.advanceTimersByTimeAsync(20000); // no change -> no new chime
    expect(played).toEqual(["order", "collection"]);
  });

  test("plays the visit chime when visitsNew rises (new check-in)", async () => {
    await mountEnabled(
      badgeSequence([
        { ordersNew: 0, collectionsNew: 0, visitsNew: 16 }, // baseline — silent
        { ordersNew: 0, collectionsNew: 0, visitsNew: 17 }, // a fresh check-in
      ]),
    );
    expect(played).toEqual([]);
    await vi.advanceTimersByTimeAsync(20000);
    expect(played).toEqual(["visit"]);
  });

  test("plays all three when order, collection and visit all rise in one poll", async () => {
    await mountEnabled(
      badgeSequence([
        { ordersNew: 0, collectionsNew: 0, visitsNew: 0 },
        { ordersNew: 1, collectionsNew: 1, visitsNew: 1 },
      ]),
    );
    expect(played).toEqual([]);
    await vi.advanceTimersByTimeAsync(20000);
    expect(played.sort()).toEqual(["collection", "order", "visit"]);
  });

  test("desktop notification bodies lead with the executive's name (context-aware)", async () => {
    // Hidden tab → alertHidden fires a desktop Notification. Capture its body.
    const notes: { title: string; body: string }[] = [];
    class MockNotification {
      static permission = "granted";
      constructor(title: string, opts: { body: string }) {
        notes.push({ title, body: opts.body });
      }
    }
    vi.stubGlobal("Notification", MockNotification);
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });

    await mountEnabled(
      badgeSequence([
        { ordersNew: 0, collectionsNew: 0, visitsNew: 0 }, // baseline — silent
        {
          ordersNew: 1,
          collectionsNew: 1,
          visitsNew: 1,
          latestOrder: { value: 12000, customer: "Ravi Motors", executive: "Sandeep" },
          latestCollection: { amount: 5000, customer: "Ravi Motors", executive: "Sandeep" },
          latestVisit: { customer: "Ravi Motors", executive: "Sandeep" },
        },
      ]),
    );
    await vi.advanceTimersByTimeAsync(20000);

    const bodies = notes.map((n) => n.body);
    expect(bodies).toContain("Sandeep · Ravi Motors · ₹12,000"); // order
    expect(bodies).toContain("Sandeep · ₹5,000 from Ravi Motors"); // collection
    expect(bodies).toContain("Sandeep · Ravi Motors"); // check-in

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  test("stays silent when the toggle is off (muted)", async () => {
    // Explicitly turned off — "0". (Unset defaults to ON now.)
    localStorage.setItem("distribution-os:sound-on", "0");
    vi.stubGlobal("fetch", badgeSequence([
      { ordersNew: 0, collectionsNew: 0 },
      { ordersNew: 5, collectionsNew: 5 },
    ]));
    render(<SoundNotifier />);
    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20000);
    expect(played).toEqual([]);
  });
});
