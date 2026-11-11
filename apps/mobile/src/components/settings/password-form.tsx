import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { usePlaceholderColor } from "../../lib/theme";
import { ErrorBanner } from "../error-banner";

/** Current + new + confirm password fields for the change-password screen. */
export function PasswordForm({
  current,
  onCurrent,
  next,
  onNext,
  confirm,
  onConfirm,
  tooShort,
  mismatch,
  error,
  saved,
  busy,
}: {
  readonly current: string;
  readonly onCurrent: (t: string) => void;
  readonly next: string;
  readonly onNext: (t: string) => void;
  readonly confirm: string;
  readonly onConfirm: (t: string) => void;
  readonly tooShort: boolean;
  readonly mismatch: boolean;
  readonly error: string | null;
  readonly saved: boolean;
  readonly busy: boolean;
}) {
  const placeholder = usePlaceholderColor();
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Current password</Text>
        <TextInput
          className="rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground"
          value={current}
          onChangeText={onCurrent}
          secureTextEntry
          placeholder="Current password"
          placeholderTextColor={placeholder}
          editable={!busy}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">New password</Text>
        <TextInput
          className={`rounded-lg border bg-background px-4 py-3 text-base text-foreground ${
            tooShort ? "border-destructive" : "border-border"
          }`}
          value={next}
          onChangeText={onNext}
          secureTextEntry
          placeholder="At least 8 characters"
          placeholderTextColor={placeholder}
          editable={!busy}
        />
        {tooShort ? (
          <Text className="text-xs text-destructive">Must be at least 8 characters.</Text>
        ) : null}
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Confirm new password</Text>
        <TextInput
          className={`rounded-lg border bg-background px-4 py-3 text-base text-foreground ${
            mismatch ? "border-destructive" : "border-border"
          }`}
          value={confirm}
          onChangeText={onConfirm}
          secureTextEntry
          placeholder="Re-enter new password"
          placeholderTextColor={placeholder}
          editable={!busy}
        />
        {mismatch ? (
          <Text className="text-xs text-destructive">Passwords don’t match.</Text>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {saved ? (
        <Text className="text-sm font-medium text-green-600">Password changed ✓</Text>
      ) : null}
    </KeyboardAwareScrollView>
  );
}
