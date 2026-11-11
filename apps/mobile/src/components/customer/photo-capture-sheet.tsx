import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../icon";

/** Bottom sheet: capture a market-intelligence photo from camera or gallery. */
export function PhotoCaptureSheet({
  visible,
  onClose,
  onPick,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onPick: (source: "camera" | "gallery") => void;
}) {
  // Bare <Modal> → outside the SafeAreaProvider tree; pad by the device inset.
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="gap-2.5 rounded-t-3xl bg-card px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-1 h-1 w-9 self-center rounded-full bg-border" />
          <Text className="mb-1 text-center text-sm font-semibold text-muted-foreground">
            Add market-intelligence photo
          </Text>
          <Pressable
            className="flex-row items-center gap-3 rounded-2xl bg-secondary px-4 py-4"
            onPress={() => {
              onClose();
              onPick("camera");
            }}
          >
            <Icon name="camera-outline" size={20} color="#334155" />
            <Text className="text-base font-semibold text-secondary-foreground">Take photo</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-3 rounded-2xl bg-secondary px-4 py-4"
            onPress={() => {
              onClose();
              onPick("gallery");
            }}
          >
            <Icon name="image-outline" size={20} color="#334155" />
            <Text className="text-base font-semibold text-secondary-foreground">From gallery</Text>
          </Pressable>
          <Pressable className="items-center py-3" onPress={onClose}>
            <Text className="text-base font-semibold text-muted-foreground">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
