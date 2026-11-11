import { Text, View } from "react-native";

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  edited: boolean;
  editedAt: string | null;
  editorName: string | null;
}

/** "9 Aug 2026 · 2:45 pm" from an ISO timestamp. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

/** One note in the thread — author + date/time, body, and an "edited" marker
 *  when a Super Admin has changed it. */
export function NoteCard({ note: n }: { readonly note: CustomerNote }) {
  return (
    <View className="gap-1.5 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-card-foreground">{n.authorName}</Text>
        <Text className="text-xs text-muted-foreground">{whenLabel(n.createdAt)}</Text>
        {n.edited ? (
          <Text className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            edited
          </Text>
        ) : null}
      </View>
      <Text className="text-[15px] leading-5 text-card-foreground">{n.body}</Text>
      {n.edited && n.editorName ? (
        <Text className="text-[11px] text-muted-foreground">
          edited by {n.editorName}
          {n.editedAt ? ` · ${whenLabel(n.editedAt)}` : ""}
        </Text>
      ) : null}
    </View>
  );
}
