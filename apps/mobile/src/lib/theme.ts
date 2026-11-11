import { useColorScheme } from "react-native";

/**
 * Single source of truth for TextInput placeholder color. Tracks the
 * `--muted-foreground` token (global.css) so placeholders match the rest of
 * the muted text and adapt to light/dark — instead of the two different
 * hardcoded greys (#a1a1aa / #6b7280) that had drifted across the forms.
 */
export function usePlaceholderColor(): string {
  return useColorScheme() === "dark" ? "#a3a3a3" : "#6b7280";
}
