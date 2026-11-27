/** A single customer note, as returned by GET /customers/:id/notes. */
export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  edited: boolean;
  editedAt: string | null;
  editorName: string | null;
}

/** One rendered row in the chat: a day separator or a note bubble. */
export type ChatItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "note"; key: string; note: CustomerNote; mine: boolean };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Local calendar key for grouping notes into day sections. */
export function dayKey(iso: string): string {
  return ymd(new Date(iso));
}

/** "Today" / "Yesterday" / "9 Aug 2026" for a day separator. */
export function dayLabel(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (ymd(d) === ymd(today)) return "Today";
  if (ymd(d) === ymd(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "10:32 am" — the timestamp shown in a bubble's corner. */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/**
 * Turn the API's newest-first notes into a chat transcript: oldest → newest,
 * with a day separator before the first note of each day. `myName` aligns the
 * current user's own notes to the right (compared by author name, the only
 * identity the notes API exposes).
 */
export function buildChatItems(
  notes: readonly CustomerNote[],
  myName: string | null,
  now: number = Date.now(),
): ChatItem[] {
  const sorted = [...notes].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const items: ChatItem[] = [];
  let lastDay: string | null = null;
  for (const note of sorted) {
    const k = dayKey(note.createdAt);
    if (k !== lastDay) {
      items.push({ kind: "day", key: `day-${k}`, label: dayLabel(note.createdAt, now) });
      lastDay = k;
    }
    items.push({
      kind: "note",
      key: note.id,
      note,
      mine: myName != null && note.authorName === myName,
    });
  }
  return items;
}
