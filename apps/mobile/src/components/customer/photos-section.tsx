import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useDialog } from "../dialog";
import { Icon } from "../icon";
import { PhotoShimmer } from "../photo-shimmer";
import { PhotoZoomViewer } from "../photo-zoom-viewer";
import { Skeleton } from "../skeleton";
import { API_BASE_URL } from "../../lib/api";
import type { PhotosState } from "../../lib/customer/use-photos";
import { ErrorState } from "../error-state";
import { SectionTitle } from "./section-bits";

/** Market-intelligence photo grid (field-only). Online upload/delete via state. */
export function PhotosSection({
  state,
  token,
}: {
  readonly state: PhotosState;
  readonly token: string | null;
}) {
  const dialog = useDialog();
  const { query, uploading, uploadError, onDelete } = state;
  const photos = query.data ?? [];
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <SectionTitle>Market intelligence</SectionTitle>
        {uploading ? <ActivityIndicator size="small" color="#3b82f6" /> : null}
      </View>
      {uploadError ? <Text className="text-sm text-destructive">{uploadError}</Text> : null}

      {(() => { if (query.isPending) return (
        <View className="flex-row gap-2">
          <Skeleton width={104} height={104} radius={12} />
          <Skeleton width={104} height={104} radius={12} />
          <Skeleton width={104} height={104} radius={12} />
        </View>
      ); if (query.isError) return (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ); if (photos.length === 0 && !uploading) return (
        <View className="items-center rounded-3xl border border-dashed border-border bg-card px-4 py-8">
          <Icon name="camera-outline" size={30} color="#9ca3af" />
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            No photos yet. Capture shelves, competitor stock or the storefront.
          </Text>
        </View>
      ); return (
        <View className="flex-row flex-wrap gap-2">
          {/* Shimmer tile for the photo being stamped + uploaded to the server now. */}
          {uploading ? <PhotoShimmer width={104} height={104} radius={12} /> : null}
          {photos.map((photo) => (
            <View key={photo.id} className="relative">
              <Pressable
                onPress={() => setViewerUri(`${API_BASE_URL}/photos/${photo.id}`)}
                accessibilityLabel="View photo"
              >
                <Image
                  source={{ uri: `${API_BASE_URL}/photos/${photo.id}`, headers: authHeaders }}
                  contentFit="cover"
                  transition={150}
                  style={{ width: 104, height: 104, borderRadius: 12, backgroundColor: "#f3f4f6" }}
                />
              </Pressable>
              <Pressable
                className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-destructive"
                hitSlop={6}
                disabled={uploading}
                onPress={() =>
                  void dialog
                    .confirm({
                      title: "Delete photo?",
                      message: "This removes the photo permanently.",
                      confirmLabel: "Delete",
                      destructive: true,
                    })
                    .then((ok) => {
                      if (ok) void onDelete(photo.id);
                    })
                }
              >
                <Text className="text-xs font-bold text-white">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ); })()}
      {viewerUri ? <PhotoZoomViewer uri={viewerUri} headers={authHeaders} onClose={() => setViewerUri(null)} /> : null}
    </View>
  );
}
