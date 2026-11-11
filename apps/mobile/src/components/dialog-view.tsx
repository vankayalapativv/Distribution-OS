import { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import type { DialogState } from "./dialog-types";

/**
 * Presentational card for {@link DialogProvider} — the themed replacement for
 * the OS `Alert.alert`. Matches the app's card/typography via tokens. In prompt
 * mode (`state.input`) it shows a text field and submits the entered string.
 */
/**
 * Prompt validity + primary-button styling. `required` blocks blank; `minLetters`
 * additionally needs at least N alphabetic letters (numbers/spaces/symbols still
 * allowed alongside), so junk like "-", "NA" or "-----" can't satisfy it.
 */
function deriveSubmitState(state: DialogState, value: string) {
  const needLetters = state.minLetters ?? 0;
  const letterCount = state.input ? (value.match(/\p{L}/gu) ?? []).length : 0;
  const tooFewLetters = state.input === true && needLetters > 0 && letterCount < needLetters;
  const blankRequired = state.input === true && state.required === true && value.trim() === "";
  const submitDisabled = blankRequired || tooFewLetters;

  let submitBg = "bg-primary";
  if (submitDisabled) submitBg = "bg-primary/40";
  else if (state.destructive) submitBg = "bg-destructive";

  return {
    submitDisabled,
    submitBg,
    needLetters,
    // Only nudge once they've started typing but haven't met the letter minimum.
    showLetterHint: tooFewLetters && value.trim() !== "",
  };
}

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

  // Keyboard-aware: lift the centered card above the keyboard in prompt mode.
  // RN's KeyboardAvoidingView is unreliable inside a transparent Modal on
  // Android, so we measure the keyboard directly and pad the centring container
  // (padding-bottom shifts the vertical centre up by half the keyboard height,
  // enough to clear a small dialog). Only prompts raise the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (!state.input || !state.visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [state.input, state.visible]);

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
