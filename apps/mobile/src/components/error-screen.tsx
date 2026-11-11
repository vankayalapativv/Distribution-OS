import { ScrollView, Text, View } from "react-native";
import { Pressable } from "react-native";
import { Icon } from "./icon";

/**
 * Friendly recovery UI shown by the app's top-level ErrorBoundary
 * (wired in src/app/_layout.tsx). Turns a would-be hard crash into a
 * screen the SE can recover from — critical on release APKs where an
 * uncaught render error otherwise closes the whole app.
 */
export function ErrorScreen({ error, retry }: { readonly error: Error; readonly retry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
      <Icon name="warning-outline" size={52} color="#dc2626" />

      <Text className="text-center text-lg font-bold text-foreground">
        Something went wrong
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        The app hit an unexpected error. Your saved data is safe. Tap below to
        continue — if it keeps happening, note what you were doing and tell the
        office team.
      </Text>

      <Pressable
        className="mt-2 items-center rounded-lg bg-primary px-6 py-3"
        onPress={retry}
      >
        <Text className="text-base font-semibold text-primary-foreground">Try again</Text>
      </Pressable>

      {/* Collapsed technical detail — helps support without alarming the SE. */}
      <ScrollView
        className="mt-4 max-h-32 w-full rounded-lg bg-secondary p-3"
        contentContainerClassName="gap-1"
      >
        <Text className="text-xs font-medium text-muted-foreground">Details (for support):</Text>
        <Text className="text-xs text-muted-foreground">{error.message}</Text>
      </ScrollView>
    </View>
  );
}
