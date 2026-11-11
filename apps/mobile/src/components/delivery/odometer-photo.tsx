import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type PickedPhoto } from "../../lib/photos";
import { PhotoShimmer } from "../photo-shimmer";
import { PhotoZoomViewer } from "../photo-zoom-viewer";

/**
 * Required meter-photo field. Mirrors the delivery proof grid: a captured photo
 * shows as an 84×84 tile with an ✕ remove button; while the photo is being
 * prepared (stamped/uploaded) a matching shimmer tile fills the slot; otherwise a
 * Take-photo button.
 */
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
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">
        Photo of meter <Text className="text-destructive">*</Text>
      </Text>
      {(() => {
        if (photo) {
          return (
            <View className="relative" style={{ width: 84 }}>
              <Pressable onPress={() => setViewerUri(photo.uri)} accessibilityLabel="View photo">
                <Image source={{ uri: photo.uri }} style={{ width: 84, height: 84, borderRadius: 11 }} contentFit="cover" />
              </Pressable>
              <Pressable
                className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-destructive"
                hitSlop={6}
                onPress={onClear}
              >
                <Text className="text-xs font-bold text-white">✕</Text>
              </Pressable>
            </View>
          );
        }
        if (busy) {
          return <PhotoShimmer width={84} height={84} radius={11} />;
        }
        return (
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3"
            onPress={onCamera}
          >
            <Text className="text-sm font-semibold text-secondary-foreground">Take photo</Text>
          </Pressable>
        );
      })()}
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
      {viewerUri ? <PhotoZoomViewer uri={viewerUri} onClose={() => setViewerUri(null)} /> : null}
    </View>
  );
}
