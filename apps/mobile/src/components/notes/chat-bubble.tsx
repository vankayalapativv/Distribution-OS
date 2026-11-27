import { Text, View } from "react-native";
import { type CustomerNote, timeLabel } from "../../lib/notes/chat-notes";

/**
 * One note as a chat bubble (minimal / professional style). The current user's
 * own notes (`mine`) sit right in a soft teal bubble; everyone else's sit left
 * in a grey bubble with the author's name above. Notes are append-only, so an
 * "edited" marker shows when a Super Admin has changed one.
 */
export function ChatBubble({ note, mine }: { readonly note: CustomerNote; readonly mine: boolean }) {
  return (
    <View className={`max-w-[82%] ${mine ? "self-end" : "self-start"}`}>
      {mine ? null : (
        <Text className="mb-1 ml-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {note.authorName}
        </Text>
      )}
      <View
        className={`px-3 py-2 ${
          mine ? "rounded-2xl rounded-br-sm bg-teal-50" : "rounded-2xl rounded-tl-sm bg-secondary"
        }`}
      >
        <Text className={`text-[15px] leading-5 ${mine ? "text-teal-900" : "text-foreground"}`}>
          {note.body}
        </Text>
        <View className="mt-1 flex-row items-center justify-end gap-1.5">
          {note.edited ? (
            <Text className="text-[10px] italic text-muted-foreground">edited</Text>
          ) : null}
          <Text className="text-[10px] text-muted-foreground">{timeLabel(note.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}
