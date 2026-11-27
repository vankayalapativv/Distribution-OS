import { Image } from "expo-image";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Icon } from "./icon";
import { buildZoomGestures, type ZoomValues } from "./photo-zoom-gestures";

/**
 * Full-screen image preview over a dark backdrop with pinch-to-zoom, pan (while
 * zoomed) and double-tap to toggle 1×/2×. Close with the ✕ button. The gesture
 * tree is wrapped in its own GestureHandlerRootView because a React Native
 * `Modal` renders in a separate native view tree that the app-root provider
 * does not cover.
 */
export function PhotoZoomViewer({
  uri,
  headers,
  onClose,
}: {
  readonly uri: string;
  /** Optional auth headers for a server-hosted image (e.g. an authed photo URL). */
  readonly headers?: Record<string, string>;
  readonly onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();

  const v: ZoomValues = {
    scale: useSharedValue(1),
    savedScale: useSharedValue(1),
    tx: useSharedValue(0),
    ty: useSharedValue(0),
    savedTx: useSharedValue(0),
    savedTy: useSharedValue(0),
  };
  const composed = buildZoomGestures(v);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: v.tx.value }, { translateY: v.ty.value }, { scale: v.scale.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black/95">
          <GestureDetector gesture={composed}>
            <Animated.View style={{ flex: 1 }}>
              <Animated.View style={[{ flex: 1 }, imageStyle]}>
                <Image
                  source={{ uri, headers }}
                  style={{ width, height }}
                  contentFit="contain"
                  transition={100}
                />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
          <Pressable
            className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-white/15"
            onPress={onClose}
            hitSlop={8}
          >
            <Icon name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
