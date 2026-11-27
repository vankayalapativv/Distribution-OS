import { Modal, Pressable, Text, TextInput, View } from "react-native";
import type { DialogState } from "./dialog-types";
import { deriveSubmitState } from "./dialog-submit";
import { useDialogKeyboardHeight } from "./dialog-keyboard";

/**
 * Presentational card for {@link DialogProvider} — the themed replacement for
 * the OS `Alert.alert`. Matches the app's card/typography via tokens. In prompt
 * mode (`state.input`) it shows a text field and submits the entered string.
 */
export function DialogCard({
  state,
  value,
  onChangeValue,
  onSubmit,
  onCancel,
}: Readonly<{
  state: DialogState;
  value: string;
  onChangeValue: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}>) {
  const { submitDisabled, submitBg, needLetters, showLetterHint } = deriveSubmitState(state, value);
  const primaryLabel = state.confirmLabel ?? (state.input ? "Save" : "OK");

  // Lift the centered card above the keyboard in prompt mode (only prompts raise it).
  const keyboardHeight = useDialogKeyboardHeight(Boolean(state.input && state.visible));

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50 px-8"
        /* v8 ignore next -- keyboard-raise padding; the hook is tested separately */
        style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
        onPress={onCancel}
      >
        {/* Card — taps here don't reach the backdrop (RN responder captures them). */}
        <Pressable className="w-full max-w-[400px] gap-2 rounded-2xl bg-card p-5">
          <Text className="text-lg font-bold text-card-foreground">{state.title}</Text>
          {state.message ? (
            <Text
              className={`text-sm leading-5 ${state.destructive ? "text-destructive" : "text-muted-foreground"}`}
            >
              {state.message}
            </Text>
          ) : null}
          {state.input ? (
            <TextInput
              className="mt-2 rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground"
              value={value}
              onChangeText={onChangeValue}
              placeholder={state.placeholder}
              placeholderTextColor="#9ca3af"
              autoFocus
              keyboardType={state.keyboardType ?? "default"}
              multiline={state.multiline}
              style={state.multiline ? { minHeight: 88, textAlignVertical: "top" } : undefined}
            />
          ) : null}
          {showLetterHint ? (
            <Text className="text-xs text-destructive">
              Please enter at least {needLetters} letters.
            </Text>
          ) : null}
          <View className="mt-3 flex-row justify-end gap-2">
            {state.cancelLabel !== null ? (
              <Pressable className="rounded-lg px-4 py-2.5 active:bg-secondary" onPress={onCancel}>
                <Text className="font-medium text-muted-foreground">
                  {state.cancelLabel ?? "Cancel"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              className={`rounded-lg px-5 py-2.5 ${submitBg}`}
              disabled={submitDisabled}
              onPress={onSubmit}
            >
              <Text
                className={`font-semibold ${
                  state.destructive ? "text-white" : "text-primary-foreground"
                }`}
              >
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
