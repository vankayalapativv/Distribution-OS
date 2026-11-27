import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "../icon";
import { useBottomInset } from "../../lib/use-bottom-inset";

/**
 * WhatsApp-style bottom compose bar: a growing text input + a round send button.
 * Save is gated on connectivity (notes aren't queued offline), so when offline
 * the button is disabled and a short hint explains why. A save error shows above
 * the input (notes are append-only — there's no edit/delete to retry into).
 */
export function NotesComposeBar({
  draft,
  onChange,
  canSave,
  saving,
  onSave,
  offline = false,
  error = null,
}: {
  readonly draft: string;
  readonly onChange: (v: string) => void;
  readonly canSave: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly offline?: boolean;
  readonly error?: string | null;
}) {
  const bottomPad = useBottomInset(8);
  const hint = offline
    ? "You're offline — connect to add a note."
    : error
      ? error
      : null;
  return (
    <View className="border-t border-border bg-background px-3 pt-2" style={{ paddingBottom: bottomPad }}>
      {hint ? (
        <Text className={`pb-1.5 text-center text-[11px] ${offline ? "text-muted-foreground" : "text-destructive"}`}>
          {hint}
        </Text>
      ) : null}
      <View className="flex-row items-end gap-2">
        <TextInput
          value={draft}
          onChangeText={onChange}
          placeholder="Add a note…"
          placeholderTextColor="#9ca3af"
          multiline
          className="max-h-28 min-h-11 flex-1 rounded-3xl border border-border bg-secondary px-4 py-2.5 text-[15px] text-foreground"
          textAlignVertical="center"
        />
        <Pressable
          className={`h-11 w-11 items-center justify-center rounded-full ${canSave ? "bg-teal-600" : "bg-muted"}`}
          disabled={!canSave}
          onPress={onSave}
          accessibilityLabel="Send note"
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Icon name="send" size={18} color={canSave ? "#ffffff" : "#9ca3af"} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
