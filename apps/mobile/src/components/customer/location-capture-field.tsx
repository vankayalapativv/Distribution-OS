import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "../icon";

/**
 * Shop-location capture control. The caller supplies the idle/captured labels
 * and the hint text, since create and edit word them differently.
 */
export function LocationCaptureField({
  geo,
  busy,
  onPress,
  idleLabel,
  capturedText,
  hint,
  required,
  error,
}: {
  readonly geo: { latitude: number; longitude: number } | null;
  readonly busy: boolean;
  readonly onPress: () => void;
  readonly idleLabel: string;
  readonly capturedText: string;
  readonly hint: string | null;
  readonly required?: boolean;
  readonly error?: string | null;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">
        Shop location
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <Pressable
        className={`items-center rounded-lg py-2.5 ${geo ? "bg-accent" : "bg-secondary"} ${
          error ? "border border-destructive" : ""
        }`}
        onPress={onPress}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#3b82f6" />
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Icon name="location-outline" size={16} color="#334155" />
            <Text
              className={`text-sm font-medium ${geo ? "text-accent-foreground" : "text-secondary-foreground"}`}
            >
              {geo ? capturedText : idleLabel}
            </Text>
          </View>
        )}
      </Pressable>
      {(() => { if (error) return (
        <Text className="text-xs text-destructive">{error}</Text>
      ); if (hint) return (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ); return null; })()}
    </View>
  );
}
