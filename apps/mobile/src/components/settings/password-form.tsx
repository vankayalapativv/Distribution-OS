import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Icon } from "../icon";
import { usePlaceholderColor } from "../../lib/theme";
import { ErrorBanner } from "../error-banner";

interface Rules {
  longEnough: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

/** A labelled password input with a show/hide eye toggle. */
function PwField({
  label,
  value,
  onChange,
  placeholder,
  invalid,
  busy,
  autoFocus,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (t: string) => void;
  readonly placeholder: string;
  readonly invalid: boolean;
  readonly busy: boolean;
  readonly autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const placeholderColor = usePlaceholderColor();
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View
        className={`flex-row items-center rounded-xl border bg-card px-4 ${
          invalid ? "border-destructive" : "border-border"
        }`}
      >
        <TextInput
          className="flex-1 py-3 text-base text-foreground"
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        <Pressable
          onPress={() => setShow((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={show ? `Hide ${label}` : `Show ${label}`}
        >
          <Icon name={show ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
        </Pressable>
      </View>
    </View>
  );
}

const STRENGTH = [
  { label: "Too weak", color: "#dc2626" },
  { label: "Weak", color: "#dc2626" },
  { label: "Fair", color: "#d97706" },
  { label: "Good", color: "#2563eb" },
  { label: "Strong", color: "#16a34a" },
] as const;

/** One rule in the checklist — turns green with a check once satisfied. */
function RuleItem({ ok, text }: { readonly ok: boolean; readonly text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon
        name={ok ? "checkmark-circle" : "ellipse-outline"}
        size={15}
        color={ok ? "#16a34a" : "#9ca3af"}
      />
      <Text className={`text-xs ${ok ? "text-foreground" : "text-muted-foreground"}`}>{text}</Text>
    </View>
  );
}

/** Current + new + confirm password fields with show/hide, a strength meter, and a
 *  live rules checklist for the change-password screen. */
export function PasswordForm({
  current,
  onCurrent,
  next,
  onNext,
  confirm,
  onConfirm,
  rules,
  strength,
  mismatch,
  wrongCurrent,
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
  readonly rules: Rules;
  readonly strength: number;
  readonly mismatch: boolean;
  readonly wrongCurrent: boolean;
  readonly error: string | null;
  readonly saved: boolean;
  readonly busy: boolean;
}) {
  const meter = STRENGTH[Math.min(strength, 4)];
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingVertical: 16 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-1.5">
        <PwField
          label="Current password"
          value={current}
          onChange={onCurrent}
          placeholder="Your current password"
          invalid={wrongCurrent}
          busy={busy}
          autoFocus
        />
        {wrongCurrent ? (
          <Text className="text-xs text-destructive">Your current password is incorrect.</Text>
        ) : null}
      </View>

      <View className="gap-2.5">
        <PwField
          label="New password"
          value={next}
          onChange={onNext}
          placeholder="At least 8 characters"
          invalid={false}
          busy={busy}
        />
        {next.length > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 flex-1 flex-row gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ backgroundColor: i < strength ? meter.color : "#e5e7eb" }}
                  />
                ))}
              </View>
              <Text className="text-[11px] font-semibold" style={{ color: meter.color }}>
                {meter.label}
              </Text>
            </View>
            <View className="gap-1">
              <RuleItem ok={rules.longEnough} text="At least 8 characters" />
              <RuleItem ok={rules.hasLetter} text="Contains a letter" />
              <RuleItem ok={rules.hasNumber} text="Contains a number" />
            </View>
          </View>
        ) : null}
      </View>

      <View className="gap-1.5">
        <PwField
          label="Confirm new password"
          value={confirm}
          onChange={onConfirm}
          placeholder="Re-enter new password"
          invalid={mismatch}
          busy={busy}
        />
        {mismatch ? <Text className="text-xs text-destructive">Passwords don’t match.</Text> : null}
      </View>

      {error && !wrongCurrent ? <ErrorBanner message={error} /> : null}
      {saved ? (
        <View className="flex-row items-center gap-1.5">
          <Icon name="checkmark-circle" size={18} color="#16a34a" />
          <Text className="text-sm font-medium text-green-600">Password changed</Text>
        </View>
      ) : null}
    </KeyboardAwareScrollView>
  );
}
