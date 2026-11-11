import { useEffect } from "react";
import { BackHandler, Linking, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type LocationBlockReason } from "../lib/location-health";
import { useLocationGuard } from "../lib/use-location-guard";
import { Icon } from "./icon";

const COPY: Record<LocationBlockReason, { title: string; body: string; cta: string }> = {
  gps_off: {
    title: "Turn on Location",
    body: "Your phone's Location (GPS) is switched off. Turn it back on to keep recording your route and continue working.",
    cta: "Open location settings",
  },
  foreground_denied: {
    title: "Allow location for Distribution OS",
    body: 'Location permission for Distribution OS was turned off. Open settings → Permissions → Location and choose "Allow all the time" to continue.',
    cta: "Open app settings",
  },
  background_denied: {
    title: 'Set location to "Allow all the time"',
    body: 'Distribution OS must keep recording your route even when the app is in your pocket. Open settings → Permissions → Location and choose "Allow all the time".',
    cta: "Open app settings",
  },
};

function openFix(reason: LocationBlockReason): void {
  if (reason === "gps_off" && Linking.sendIntent) {
    void Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS").catch(() => Linking.openSettings());
    return;
  }
  void Linking.openSettings();
}

/** Full-screen, non-dismissable blocker shown while location health is broken. */
function LocationGuardOverlay({ reason, onRecheck }: { readonly reason: LocationBlockReason; readonly onRecheck: () => void }) {
  // Swallow the Android hardware back button — this gate cannot be dismissed.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
  const copy = COPY[reason];
  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <SafeAreaView className="flex-1 items-center justify-center bg-secondary px-8">
        <View className="items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Icon name="location-outline" size={32} color="#dc2626" />
          </View>
          <Text className="text-center text-2xl font-bold text-foreground">{copy.title}</Text>
          <Text className="text-center text-base text-muted-foreground">{copy.body}</Text>
          <Text className="text-center text-sm font-semibold text-red-600">
            You can&apos;t continue until location is on.
          </Text>
        </View>
        <View className="absolute inset-x-8 bottom-10 gap-3">
          <Pressable className="items-center rounded-full bg-primary py-3.5" onPress={() => openFix(reason)}>
            <Text className="text-base font-semibold text-primary-foreground">{copy.cta}</Text>
          </Pressable>
          <Pressable className="items-center py-2" onPress={onRecheck}>
            <Text className="text-sm font-medium text-muted-foreground">I&apos;ve turned it on — re-check</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Wraps the app: enforces live location health for field roles during a run. */
export function LocationGuard({ children }: { readonly children: React.ReactNode }) {
  const { blocked, reason, recheck } = useLocationGuard();
  return (
    <>
      {children}
      {blocked && reason ? <LocationGuardOverlay reason={reason} onRecheck={recheck} /> : null}
    </>
  );
}
