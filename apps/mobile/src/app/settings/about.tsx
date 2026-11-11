import { router } from "expo-router";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SUPPORT_PHONE = "+916304800595";

function Row({
  label,
  hint,
  onPress,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between border-t border-border px-4 py-3.5 active:bg-secondary"
      onPress={onPress}
    >
      <View>
        <Text className="text-base text-card-foreground">{label}</Text>
        {hint ? <Text className="mt-0.5 text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
      <Text className="text-lg text-muted-foreground">›</Text>
    </Pressable>
  );
}

/** Help: support contact. */
export default function AboutScreen() {
  function call() {
    void Linking.openURL(`tel:${SUPPORT_PHONE}`);
  }
  function whatsapp() {
    void Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace(/[^0-9]/g, "")}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Help</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 py-4">
        <View className="rounded-xl border border-border bg-card">
          <View className="px-4 pb-1 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Support
            </Text>
          </View>
          <Row label="Call support" hint={SUPPORT_PHONE} onPress={call} />
          <Row label="WhatsApp support" onPress={whatsapp} />
        </View>

        <Text className="text-center text-xs text-muted-foreground">
          Distribution OS Distribution
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
