import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "../error-banner";
import { type PickedPhoto } from "../../lib/photos";
import { useBottomInset } from "../../lib/use-bottom-inset";
import { DeliveryHeader } from "./delivery-header";
import { RequiredLabel } from "./field-label";
import { OdometerPhoto } from "./odometer-photo";

export interface EndRunFormProps {
  stopsDone: number;
  endOdo: string;
  endPhoto: PickedPhoto | null;
  errors: { odo?: string; photo?: string };
  busy: boolean;
  stamping: boolean;
  placeholder: string;
  error: string | null;
  onEndOdo: (t: string) => void;
  onAddPhoto: () => void;
  onClearPhoto: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function EndRunForm(p: Readonly<EndRunFormProps>) {
  const bottomPad = useBottomInset();
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <DeliveryHeader title="End Deliveries" sub="Add closing meter reading" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, gap: 16 }} bottomOffset={24}>
        <View className="flex-row items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3">
          <Text className="text-sm font-medium text-amber-800">
            {p.stopsDone} deliver{p.stopsDone === 1 ? "y" : "ies"} done
          </Text>
        </View>
        <View className="gap-1.5">
          <RequiredLabel>Closing meter reading (KM)</RequiredLabel>
          <TextInput
            className={`rounded-2xl border bg-card px-4 py-3 text-base text-foreground ${p.errors.odo ? "border-destructive" : "border-border"}`}
            keyboardType="numeric" placeholder="e.g. 48297" placeholderTextColor={p.placeholder}
            value={p.endOdo} onChangeText={p.onEndOdo} editable={!p.busy}
          />
          {p.errors.odo ? <Text className="text-xs text-destructive">{p.errors.odo}</Text> : null}
        </View>
        <OdometerPhoto
          photo={p.endPhoto} error={p.errors.photo} busy={p.stamping}
          onCamera={p.onAddPhoto} onClear={p.onClearPhoto}
        />
      </KeyboardAwareScrollView>
      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {p.error ? <ErrorBanner message={p.error} className="mb-2" /> : null}
        <View className="flex-row gap-2">
          <Pressable className="flex-1 items-center rounded-full border border-border bg-card py-3.5" disabled={p.busy} onPress={p.onBack}>
            <Text className="text-base font-semibold text-secondary-foreground">Back</Text>
          </Pressable>
          {/* Blocked while the closing meter photo is still being prepared (stamping). */}
          <Pressable className={`flex-[2] items-center rounded-full border border-destructive bg-red-50 py-3.5 ${p.busy || p.stamping ? "opacity-50" : ""}`} disabled={p.busy || p.stamping} onPress={p.onSubmit}>
            {p.busy ? <ActivityIndicator color="#dc2626" /> : <Text className="text-base font-bold text-destructive">End Deliveries</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
