import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { useDialog } from "../../dialog";
import { Icon } from "../../icon";
import { PhotoShimmer } from "../../photo-shimmer";
import { Skeleton } from "../../skeleton";
import { API_BASE_URL } from "../../../lib/api";
import type { EditPhotos } from "../../../lib/customer/use-edit-photos";

/** Customer photos grid with add (camera/gallery) and confirm-to-delete. */
export function CustomerPhotosEditor({
  photos,
  token,
}: {
  readonly photos: EditPhotos;
  readonly token: string | null;
}) {
  const dialog = useDialog();
  const { query, photoBusy, onAddPhotos, onDeletePhoto } = photos;
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">Customer photos</Text>
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-secondary py-2.5"
          onPress={() => void onAddPhotos("camera")}
          disabled={photoBusy}
        >
          <Icon name="camera-outline" size={16} color="#334155" />
          <Text className="text-sm font-medium text-secondary-foreground">Take photo</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-secondary py-2.5"
          onPress={() => void onAddPhotos("gallery")}
          disabled={photoBusy}
        >
          <Icon name="image-outline" size={16} color="#334155" />
          <Text className="text-sm font-medium text-secondary-foreground">From gallery</Text>
        </Pressable>
      </View>
      {(() => { if ((query.data ?? []).length > 0 || photoBusy) return (
        <View className="mt-1 flex-row flex-wrap gap-2">
          {/* Shimmer tile for the photo being stamped + uploaded to the server now. */}
          {photoBusy ? <PhotoShimmer width={88} height={88} radius={10} /> : null}
          {(query.data ?? []).map((photo) => (
            <View key={photo.id} className="relative">
              <Image
                source={{
                  uri: `${API_BASE_URL}/photos/${photo.id}`,
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                contentFit="cover"
                transition={150}
                style={{ width: 88, height: 88, borderRadius: 10, backgroundColor: "#f3f4f6" }}
              />
              <Pressable
                className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-destructive"
                hitSlop={6}
                disabled={photoBusy}
                onPress={() =>
                  void dialog
                    .confirm({
                      title: "Delete photo?",
                      message: "This removes the photo permanently.",
                      confirmLabel: "Delete",
                      destructive: true,
                    })
                    .then((ok) => {
                      if (ok) void onDeletePhoto(photo.id);
                    })
                }
              >
                <Text className="text-xs font-bold text-white">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ); if (query.isPending) return (
        <View className="flex-row gap-2">
          <Skeleton width={104} height={104} radius={12} />
          <Skeleton width={104} height={104} radius={12} />
          <Skeleton width={104} height={104} radius={12} />
        </View>
      ); return (
        <Text className="text-xs text-muted-foreground">No customer photos yet.</Text>
      ); })()}
    </View>
  );
}
