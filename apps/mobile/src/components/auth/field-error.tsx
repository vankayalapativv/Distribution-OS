import { Text } from "react-native";

/** The small red validation message under a form field (nothing when clear). */
export function FieldError({ message }: { readonly message?: string }) {
  if (!message) return null;
  return <Text className="text-xs text-destructive">{message}</Text>;
}
