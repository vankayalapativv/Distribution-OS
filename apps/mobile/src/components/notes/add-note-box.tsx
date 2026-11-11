import { type ReactElement } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { FeedbackBanner } from "../feedback-banner";

/** Add box — the SE can add a note any number of times, but never edit or
 *  delete one once saved. */
export function AddNoteBox({
  draft,
  setDraft,
  error,
  canSave,
  saving,
  onSave,
  offline = false,
}: {
  readonly draft: string;
  readonly setDraft: (v: string) => void;
  readonly error: string | null;
  readonly canSave: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
  /** Notes aren't queued offline (unlike orders/collections), so when offline
   *  Save is disabled and we say so — the app-wide "saved & will sync" bar does
   *  not apply here. */
  readonly offline?: boolean;
}) {
  // Offline note (warning) takes precedence over a save error; neither when both clear.
  let banner: ReactElement | null = null;
  if (offline) {
    banner = (
      <FeedbackBanner
        variant="warning"
        message="You're offline. Connect to the internet to add a note."
      />
    );
  } else if (error) {
    banner = <FeedbackBanner variant="error" message={error} />;
  }

  return (
    <View className="gap-2 rounded-2xl border border-border bg-card p-4">
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Add a note about this customer…"
        placeholderTextColor="#9ca3af"
        multiline
        className="min-h-20 text-base text-card-foreground"
        textAlignVertical="top"
      />
      {banner}
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-xs text-muted-foreground">
          Once saved, a note can&apos;t be edited or deleted.
        </Text>
        <Pressable
          className={`rounded-xl px-5 py-2 ${canSave ? "bg-primary" : "bg-muted"}`}
          disabled={!canSave}
          onPress={onSave}
        >
          <Text
            className={`text-sm font-semibold ${
              canSave ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
