import { Image } from "expo-image";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { type PickedPhoto } from "../../lib/photos";

/** Required meter-photo field: shows the captured photo or a Take-photo button. */
export function OdometerPhoto({
  photo,
  error,
  busy,
  onCamera,
  onClear,
}: {
  readonly photo: PickedPhoto | null;
  readonly error?: string;
  readonly busy?: boolean;
  readonly onCamera: () => void;
  readonly onClear: () => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">
        Photo of meter <Text className="text-destructive">*</Text>
      </Text>
      {photo ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-green-300 bg-green-50 p-2.5">
          <Image source={{ uri: photo.uri }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
          <Text className="flex-1 text-sm font-medium text-green-700">Meter photo added</Text>
          <Pressable onPress={onClear} hitSlop={8} className="pr-1">
            <Text className="text-sm font-medium text-destructive">Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          className={`flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 ${busy ? "opacity-50" : ""}`}
          disabled={busy}
          onPress={onCamera}
        >
          {busy ? (
            <>
              <ActivityIndicator size="small" />
              <Text className="text-sm font-semibold text-secondary-foreground">Adding photo…</Text>
            </>
          ) : (
            <Text className="text-sm font-semibold text-secondary-foreground">Take photo</Text>
          )}
        </Pressable>
      )}
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
