import { ActivityIndicator, View } from "react-native";

/** Full-screen spinner. `overlay` positions it above the navigator so it can
 *  hide the underlying screen while a role redirect is still resolving. */
export function Splash({ overlay = false }: { readonly overlay?: boolean }) {
  return (
    <View
      className={`items-center justify-center bg-background ${
        overlay ? "absolute bottom-0 left-0 right-0 top-0" : "flex-1"
      }`}
    >
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}
