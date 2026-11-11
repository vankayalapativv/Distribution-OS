import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { usePlaceholderColor } from "../../lib/theme";
import { ErrorBanner } from "../error-banner";
import { PhoneField } from "../phone-field";

/** Editable name/phone + read-only email, for the loaded profile screen. */
export function ProfileForm({
  name,
  onName,
  phone,
  onPhone,
  email,
  error,
  saved,
  phoneConflict,
  busy,
}: {
  readonly name: string;
  readonly onName: (t: string) => void;
  readonly phone: string;
  readonly onPhone: (d: string) => void;
  readonly email: string | null;
  readonly error: string | null;
  readonly saved: boolean;
  readonly phoneConflict: boolean;
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
        <Text className="text-sm font-medium text-foreground">
          Name<Text className="text-destructive"> *</Text>
        </Text>
        <TextInput
          className="rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground"
          value={name}
          onChangeText={onName}
          placeholder="Your name"
          placeholderTextColor={placeholder}
          editable={!busy}
        />
      </View>

      <PhoneField
        label="Phone"
        value={phone}
        onChange={onPhone}
        error={phoneConflict ? "This number is already used by another account." : undefined}
      />

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-muted-foreground">Email</Text>
        <View className="rounded-lg border border-border bg-secondary px-4 py-3">
          <Text className="text-base text-muted-foreground">{email ?? "—"}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          Email is your login and can’t be changed here.
        </Text>
      </View>

      {error && !phoneConflict ? <ErrorBanner message={error} /> : null}
      {saved ? (
        <View className="flex-row items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <Text className="text-base">✓</Text>
          <Text className="text-sm font-medium text-green-700">Profile updated</Text>
        </View>
      ) : null}
    </KeyboardAwareScrollView>
  );
}
