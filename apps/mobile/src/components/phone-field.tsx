import { Text, TextInput, View } from "react-native";
import { usePlaceholderColor } from "../lib/theme";

/**
 * Indian phone input: fixed +91 prefix, digits only, capped at exactly 10.
 * `value` is the 10-digit local part (no prefix); `onChange` receives the
 * sanitized digits. Shared so every phone field in the app behaves identically.
 */
export function PhoneField({
  label,
  value,
  onChange,
  required,
  error,
  placeholder,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (digits: string) => void;
  readonly required?: boolean;
  readonly error?: string | null;
  /** Input placeholder; defaults to "10-digit phone number". Pass "" to hide it. */
  readonly placeholder?: string;
}) {
  const placeholderColor = usePlaceholderColor();
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View
        className={`flex-row items-center rounded-lg border bg-background ${
          error ? "border-destructive" : "border-border"
        }`}
      >
        <Text className="border-r border-border px-3.5 py-2.5 text-base text-muted-foreground">
          +91
        </Text>
        <TextInput
          className="flex-1 px-4 py-2.5 text-foreground"
          placeholder={placeholder ?? "10-digit phone number"}
          placeholderTextColor={placeholderColor}
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 10))}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}

/** Strip any leading +91 / 91 and non-digits, keeping the 10-digit local part. */
export function toLocalPhone(stored: string | null | undefined): string {
  return (stored ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").slice(-10);
}

/** Format a 10-digit local part for storage as +91XXXXXXXXXX (or null if empty). */
export function toStoredPhone(local: string): string | null {
  const digits = local.replace(/\D/g, "").slice(0, 10);
  return digits ? `+91${digits}` : null;
}
