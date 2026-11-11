import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { usePlaceholderColor } from "../../lib/theme";

/** At least this many alphabetic letters are required, so junk like "-", "NA" or
 *  "-----" can't pass as a reason. */
const MIN_LETTERS = 5;

/** Count alphabetic letters only (numbers/spaces/symbols don't count). */
function letterCount(value: string): number {
  return (value.match(/\p{L}/gu) ?? []).length;
}

/**
 * Mandatory reason prompt shown when an SE checks out of a visit that produced
 * no order and no collection. Free-text (no preset list), and it requires at
 * least 5 letters — the server demands a real reason before it will close such a
 * visit. Matches the Beyond "No order or collection" dialog.
 *
 * Promise-based like the confirm dialog: `promptReason()` resolves with the
 * trimmed reason, or null if the SE backs out (then the check-out is abandoned).
 */
export function useNoOutcomeReason() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const promptReason = useCallback(() => {
    setText("");
    setVisible(true);
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = useCallback((value: string | null) => {
    setVisible(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const sheet = (
    <NoOutcomeDialog
      visible={visible}
      value={text}
      onChange={setText}
      onCancel={() => finish(null)}
      onSubmit={() => {
        const trimmed = text.trim();
        if (letterCount(trimmed) >= MIN_LETTERS) finish(trimmed);
      }}
    />
  );

  return { promptReason, sheet };
}

function NoOutcomeDialog({
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
