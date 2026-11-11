import { Image } from "expo-image";
import { Modal, Pressable, View } from "react-native";
import { Icon } from "../icon";

/** Full-screen preview of the stamped receipt over a dark backdrop. */
export function ProofViewer({ uri, onClose }: { readonly uri: string; readonly onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/95">
        <Pressable className="flex-1" onPress={onClose}>
          <Image
            source={{ uri }}
            style={{ flex: 1 }}
            contentFit="contain"
          />
        </Pressable>
        <Pressable
          className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-white/15"
          onPress={onClose}
          hitSlop={8}
        >
          <Icon name="close" size={24} color="#ffffff" />
        </Pressable>
      </View>
    </Modal>
  );
}
