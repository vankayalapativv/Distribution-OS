import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { usePlaceholderColor } from "../../lib/theme";

/** At least this many alphabetic letters are required, so junk like "-", "NA" or
 *  "-----" can't pass as a reason. */
export const MIN_LETTERS = 5;

/** Count alphabetic letters only (numbers/spaces/symbols don't count). */
export function letterCount(value: string): number {
  return (value.match(/\p{L}/gu) ?? []).length;
}

/** The centered reason card. Separated from the hook so each stays small. */
export function NoOutcomeDialog({
  visible,
  value,
  onChange,
  onCancel,
  onSubmit,
}: {
  readonly visible: boolean;
  readonly value: string;
  readonly onChange: (t: string) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}) {
  const placeholderColor = usePlaceholderColor();
  const letters = letterCount(value);
  const canSubmit = letters >= MIN_LETTERS;
  // Only nag once the SE has started typing but is still short of the minimum.
  const showLetterHint = value.trim().length > 0 && !canSubmit;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* The TextInput autofocuses, so the keyboard opens immediately; lift the
          centered card above it (same as the pack/collection sheets). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-8" onPress={onCancel}>
          <Pressable
            className="w-full max-w-[400px] gap-2 rounded-2xl bg-card p-5"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-bold text-card-foreground">No order or collection</Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              This visit has no order or collection. Add a short reason (at least {MIN_LETTERS}{" "}
              letters) to check out.
            </Text>
            <TextInput
              className="mt-2 rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground"
              placeholder="e.g. Shop closed, owner not available…"
              placeholderTextColor={placeholderColor}
              value={value}
              onChangeText={onChange}
              multiline
              maxLength={300}
              autoFocus
              style={{ minHeight: 88, textAlignVertical: "top" }}
            />
            {showLetterHint ? (
              <Text className="text-xs text-destructive">
                Please enter at least {MIN_LETTERS} letters.
              </Text>
            ) : null}
            <View className="mt-3 flex-row justify-end gap-2">
              <Pressable className="rounded-lg px-4 py-2.5 active:bg-secondary" onPress={onCancel}>
                <Text className="font-medium text-muted-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                className={`rounded-lg px-5 py-2.5 ${canSubmit ? "bg-amber-500" : "bg-muted"}`}
                disabled={!canSubmit}
                onPress={onSubmit}
              >
                <Text className={`font-semibold ${canSubmit ? "text-white" : "text-muted-foreground"}`}>
                  Check out
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
