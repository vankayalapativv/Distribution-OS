import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "../error-banner";
import { type PickedPhoto } from "../../lib/photos";
import { useBottomInset } from "../../lib/use-bottom-inset";
import { DeliveryHeader } from "./delivery-header";
import { RequiredLabel } from "./field-label";
import { OdometerPhoto } from "./odometer-photo";

export interface StartRunFormProps {
  vehicle: string;
  odo: string;
  odoPhoto: PickedPhoto | null;
  errors: { vehicle?: string; odo?: string; photo?: string };
  busy: boolean;
  stamping: boolean;
  placeholder: string;
  error: string | null;
  onVehicle: (t: string) => void;
  onOdo: (t: string) => void;
  onAddPhoto: () => void;
  onClearPhoto: () => void;
  onSubmit: () => void;
}

export function StartRunForm(p: Readonly<StartRunFormProps>) {
  const bottomPad = useBottomInset();
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <DeliveryHeader title="Start Deliveries" sub="Add your vehicle and meter reading" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, gap: 16 }} bottomOffset={24}>
        <View className="gap-1.5">
          <RequiredLabel>Vehicle number</RequiredLabel>
          <TextInput
            className={`rounded-2xl border bg-card px-4 py-3 text-base text-foreground ${p.errors.vehicle ? "border-destructive" : "border-border"}`}
            placeholder="e.g. TS09AB1234" placeholderTextColor={p.placeholder}
            autoCapitalize="characters" autoCorrect={false} value={p.vehicle}
            onChangeText={p.onVehicle} editable={!p.busy}
          />
          {p.errors.vehicle ? <Text className="text-xs text-destructive">{p.errors.vehicle}</Text> : null}
        </View>
        <View className="gap-1.5">
          <RequiredLabel>Starting meter reading (KM)</RequiredLabel>
          <TextInput
            className={`rounded-2xl border bg-card px-4 py-3 text-base text-foreground ${p.errors.odo ? "border-destructive" : "border-border"}`}
            keyboardType="numeric" placeholder="e.g. 48210" placeholderTextColor={p.placeholder}
            value={p.odo} onChangeText={p.onOdo} editable={!p.busy}
          />
          {p.errors.odo ? <Text className="text-xs text-destructive">{p.errors.odo}</Text> : null}
        </View>
        <OdometerPhoto
          photo={p.odoPhoto} error={p.errors.photo} busy={p.stamping}
          onCamera={p.onAddPhoto} onClear={p.onClearPhoto}
        />
      </KeyboardAwareScrollView>
      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {p.error ? <ErrorBanner message={p.error} className="mb-2" /> : null}
        <Pressable className={`items-center rounded-full bg-primary py-3.5 ${p.busy ? "opacity-50" : ""}`} disabled={p.busy} onPress={p.onSubmit}>
          {p.busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-primary-foreground">Start Deliveries</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
