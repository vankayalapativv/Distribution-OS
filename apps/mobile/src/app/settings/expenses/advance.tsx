import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "../../../components/error-banner";
import { useAdvanceRequest } from "../../../lib/use-advance-request";

/** Request a salary advance — the office approves and sets how it's recovered. */
export default function RequestAdvanceScreen() {
  const f = useAdvanceRequest();

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Request an advance</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 py-4" keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1 text-sm font-medium text-foreground">Amount needed <Text className="text-destructive">*</Text></Text>
          <TextInput
            className="rounded-2xl border border-border bg-card px-4 py-3 text-lg text-foreground"
            placeholder="₹ 0"
            keyboardType="numeric"
            value={f.amount}
            onChangeText={f.setAmount}
          />
        </View>

        <View>
          <Text className="mb-1 text-sm font-medium text-foreground">Reason (optional)</Text>
          <TextInput
            className="rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground"
            placeholder="e.g. medical emergency"
            value={f.reason}
            onChangeText={f.setReason}
          />
        </View>

        <Text className="text-xs text-muted-foreground">
          Recovered from your salary once approved — the office decides full or monthly.
        </Text>

        {f.error ? <ErrorBanner message={f.error} /> : null}

        <Pressable
          className={`items-center rounded-full bg-primary py-3.5 ${f.busy ? "opacity-50" : ""}`}
          disabled={f.busy}
          onPress={f.submit}
        >
          {f.busy ? <ActivityIndicator color="#ffffff" /> : (
            <Text className="text-base font-semibold text-primary-foreground">Send request</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
