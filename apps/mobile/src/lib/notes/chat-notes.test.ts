import { describe, expect, it } from "vitest";
import { buildChatItems, dayKey, dayLabel, timeLabel, type CustomerNote } from "./chat-notes";

const NOW = new Date(2026, 10, 27, 12, 0, 0).getTime(); // local Nov 27 2026, noon
const iso = (y: number, mo: number, d: number, h = 9) => new Date(y, mo, d, h, 0, 0).toISOString();

function note(over: Partial<CustomerNote> & Pick<CustomerNote, "id" | "createdAt" | "authorName">): CustomerNote {
  return { body: "x", edited: false, editedAt: null, editorName: null, ...over };
}

describe("dayLabel", () => {
  it("labels today / yesterday / an older date", () => {
    expect(dayLabel(iso(2026, 10, 27), NOW)).toBe("Today");
    expect(dayLabel(iso(2026, 10, 26), NOW)).toBe("Yesterday");
    expect(dayLabel(iso(2026, 7, 9), NOW)).toMatch(/Aug/); // "9 Aug 2026"
  });
});

describe("dayKey / timeLabel", () => {
  it("dayKey is stable within a day, differs across days", () => {
    expect(dayKey(iso(2026, 10, 27, 1))).toBe(dayKey(iso(2026, 10, 27, 23)));
    expect(dayKey(iso(2026, 10, 27))).not.toBe(dayKey(iso(2026, 10, 26)));
  });
  it("timeLabel renders a time", () => {
    expect(timeLabel(iso(2026, 10, 27, 10))).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("buildChatItems", () => {
  it("returns nothing for no notes", () => {
    expect(buildChatItems([], "Asha", NOW)).toEqual([]);
  });

  it("sorts oldest→newest, inserts a day separator per day, and flags my notes", () => {
    const notes = [
      note({ id: "t", createdAt: iso(2026, 10, 27), authorName: "Asha" }), // today, mine
      note({ id: "y", createdAt: iso(2026, 10, 26), authorName: "Priya" }), // yesterday, not mine
      note({ id: "o", createdAt: iso(2026, 7, 9), authorName: "Asha" }), // old, mine
    ]; // API order is newest-first
    const items = buildChatItems(notes, "Asha", NOW);
    expect(items.map((i) => i.kind)).toEqual(["day", "note", "day", "note", "day", "note"]);
    // chronological: old → yesterday → today
    expect(items.filter((i) => i.kind === "note").map((i) => (i as { note: CustomerNote }).note.id)).toEqual(["o", "y", "t"]);
    const mine = items.filter((i) => i.kind === "note").map((i) => (i as { mine: boolean }).mine);
    expect(mine).toEqual([true, false, true]);
  });

  it("groups two notes on the same day under one separator", () => {
    const notes = [
      note({ id: "a", createdAt: iso(2026, 10, 27, 9), authorName: "Asha" }),
      note({ id: "b", createdAt: iso(2026, 10, 27, 11), authorName: "Asha" }),
    ];
    const items = buildChatItems(notes, "Asha", NOW);
    expect(items.filter((i) => i.kind === "day")).toHaveLength(1);
  });

  it("keeps a stable order for two notes with the same timestamp", () => {
    const t = iso(2026, 10, 27, 9);
    const notes = [
      note({ id: "a", createdAt: t, authorName: "Asha" }),
      note({ id: "b", createdAt: t, authorName: "Asha" }),
    ];
    const noteItems = buildChatItems(notes, "Asha", NOW).filter((i) => i.kind === "note");
    expect(noteItems).toHaveLength(2);
  });

  it("flags nothing as mine when the viewer name is unknown", () => {
    const notes = [note({ id: "a", createdAt: iso(2026, 10, 27), authorName: "Asha" })];
    const items = buildChatItems(notes, null, NOW);
    expect((items[1] as { mine: boolean }).mine).toBe(false);
  });
});
