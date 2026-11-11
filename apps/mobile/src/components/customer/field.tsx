import { Text, TextInput, View } from "react-native";
import { usePlaceholderColor } from "../../lib/theme";

/** Shared labelled text field for the customer create/edit forms. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  required,
  error,
  maxLength,
  editable,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (t: string) => void;
  readonly placeholder?: string;
  readonly keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  readonly multiline?: boolean;
  readonly required?: boolean;
  readonly error?: string | null;
  readonly maxLength?: number;
  /** When false, the field is read-only and visually muted. Defaults to true. */
  readonly editable?: boolean;
}) {
  const placeholderColor = usePlaceholderColor();
  const isEditable = editable !== false;
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <TextInput
        className={`rounded-lg border px-4 py-2.5 ${
          error ? "border-destructive" : "border-border"
        } ${isEditable ? "bg-background text-foreground" : "bg-muted text-muted-foreground"}`}
        editable={isEditable}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        maxLength={maxLength}
        style={multiline ? { minHeight: 84, textAlignVertical: "top" } : undefined}
      />
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
