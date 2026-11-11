import { Text } from "react-native";

/** Field label with a red star for required fields. */
export function RequiredLabel({ children }: { readonly children: string }) {
  return (
    <Text className="text-sm font-medium text-foreground">
      {children} <Text className="text-destructive">*</Text>
    </Text>
  );
}
