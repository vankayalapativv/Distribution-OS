import { Image } from "expo-image";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "../../icon";
import { PhotoShimmer } from "../../photo-shimmer";
import type { PhotoStaging } from "../../../lib/customer/use-photo-staging";

/** Photos (shopfront, shelves) — mandatory. Staged locally until Save. */
export function CustomerPhotosField({
  photo,
  busy,
  error,
}: {
  readonly photo: PhotoStaging;
  readonly busy: boolean;
  readonly error?: string;
}) {
  const { photos, preparing, uploadingUri, setPhotos, setViewerUri, onPickPhotos } = photo;
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">
        Photos <Text className="text-destructive">*</Text>
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-secondary py-2.5"
          onPress={() => void onPickPhotos("camera")}
          disabled={busy}
        >
          <Icon name="camera-outline" size={16} color="#334155" />
          <Text className="text-sm font-medium text-secondary-foreground">Take photo</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-secondary py-2.5"
          onPress={() => void onPickPhotos("gallery")}
          disabled={busy}
        >
          <Icon name="image-outline" size={16} color="#334155" />
          <Text className="text-sm font-medium text-secondary-foreground">From gallery</Text>
        </Pressable>
      </View>
      {photos.length > 0 || preparing > 0 ? (
        <View className="mt-1 flex-row flex-wrap gap-2">
          {photos.map((photoItem, index) => (
            <View key={`${photoItem.uri}-${index}`} className="relative">
              {/* Tap the photo to open the full-screen pinch-zoom viewer. */}
              <Pressable onPress={() => setViewerUri(photoItem.uri)}>
                <Image
                  source={{ uri: photoItem.uri }}
                  style={{ width: 72, height: 72, borderRadius: 10 }}
                  contentFit="cover"
                />
              </Pressable>
              {uploadingUri === photoItem.uri ? (
                <View className="absolute inset-0 items-center justify-center rounded-[10px] bg-black/40">
                  <ActivityIndicator color="#ffffff" size="small" />
                </View>
              ) : null}
              <Pressable
                className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-destructive"
                onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                hitSlop={6}
                disabled={busy}
              >
                <Text className="text-[10px] font-bold text-white">✕</Text>
              </Pressable>
            </View>
          ))}
          {/* Shimmer tiles while photos are being prepared/stamped. */}
          {Array.from({ length: preparing }, (_, i) => `prep-${i}`).map((k) => (
            <PhotoShimmer key={k} width={72} height={72} radius={10} />
          ))}
        </View>
      ) : null}
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
