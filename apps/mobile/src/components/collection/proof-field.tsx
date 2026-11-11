import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PickedPhoto } from "../../lib/photos";
import { Icon } from "../icon";
import { PhotoShimmer } from "../photo-shimmer";
import { ProofViewer } from "./proof-viewer";

/** Mandatory payment-proof capture: shimmer while preparing/uploading, else the
 *  thumbnail (tap to view full-screen) + remove, else the capture buttons. */
export function ProofField({
  photo,
  preparing,
  uploading,
  onAdd,
  onRemove,
}: {
  readonly photo: PickedPhoto | null;
  /** The picked photo is being stamped (watermark compositing). */
  readonly preparing?: boolean;
  /** The proof is uploading to the server (during submit). */
  readonly uploading?: boolean;
  readonly onAdd: (source: "camera" | "gallery") => void;
  readonly onRemove: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  function field() {
    if (preparing) return <PhotoShimmer label="Preparing photo…" />;
    if (photo && uploading) return <PhotoShimmer label="Uploading…" />;
    if (photo) {
      return (
        <View className="overflow-hidden rounded-3xl border border-border bg-card">
          <Pressable onPress={() => setViewing(true)}>
            <Image source={{ uri: photo.uri }} style={{ width: "100%", height: 200 }} contentFit="cover" />
          </Pressable>
          <View className="flex-row items-center justify-between px-3 py-2">
            <Text className="text-xs text-muted-foreground">Proof attached · tap to view</Text>
            <Pressable onPress={onRemove} hitSlop={8}>
              <Text className="text-sm font-medium text-destructive">Remove</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3"
          onPress={() => onAdd("camera")}
        >
          <Icon name="camera-outline" size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-primary-foreground">Take photo</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3"
          onPress={() => onAdd("gallery")}
        >
          <Icon name="image-outline" size={16} color="#334155" />
          <Text className="text-sm font-semibold text-secondary-foreground">From gallery</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">
        Payment proof <Text className="text-destructive">*</Text>
      </Text>
      {field()}
      <Text className="text-xs text-muted-foreground">
        A photo of the receipt, cash or cheque is required.
      </Text>
      {viewing && photo ? <ProofViewer uri={photo.uri} onClose={() => setViewing(false)} /> : null}
    </View>
  );
}
