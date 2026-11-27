import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * The on-screen keyboard height while `active` (a visible prompt), else 0.
 * RN's KeyboardAvoidingView is unreliable inside a transparent Modal on Android,
 * so the dialog measures the keyboard directly and pads its centring container.
 */
export function useDialogKeyboardHeight(active: boolean): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (!active) {
      setKeyboardHeight(0);
      return;
    }
    /* v8 ignore next -- platform-specific event name; the test runtime is one OS */
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    /* v8 ignore next -- platform-specific event name; the test runtime is one OS */
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active]);
  return keyboardHeight;
}
