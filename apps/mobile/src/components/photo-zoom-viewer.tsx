import { Image } from "expo-image";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Icon } from "./icon";

const MAX_SCALE = 5;

/**
 * Full-screen image preview over a dark backdrop with pinch-to-zoom, pan (while
 * zoomed) and double-tap to toggle 1×/2×. Close with the ✕ button. The gesture
 * tree is wrapped in its own GestureHandlerRootView because a React Native
 * `Modal` renders in a separate native view tree that the app-root provider
 * does not cover.
 */
export function PhotoZoomViewer({ uri, onClose }: { readonly uri: string; readonly onClose: () => void }) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(Gesture.Race(doubleTap, pan), pinch);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black/95">
          <GestureDetector gesture={composed}>
            <Animated.View style={{ flex: 1 }}>
              <Animated.View style={[{ flex: 1 }, imageStyle]}>
                <Image
                  source={{ uri }}
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
