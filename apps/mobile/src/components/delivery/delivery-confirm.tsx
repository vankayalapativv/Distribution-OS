import { Image } from "expo-image";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addressLine, type DeliverableInvoice } from "../../lib/deliverable-invoice";
import { type PickedPhoto } from "../../lib/photos";
import { useBottomInset } from "../../lib/use-bottom-inset";
import { ErrorBanner } from "../error-banner";

export interface DeliveryConfirmProps {
  invoice: DeliverableInvoice;
  photos: PickedPhoto[];
  stamping: boolean;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onAddPhoto: () => void;
  onRemovePhoto: (index: number) => void;
  onSave: () => void;
}

export function DeliveryConfirm(p: Readonly<DeliveryConfirmProps>) {
  const addr = addressLine(p.invoice);
  const bottomPad = useBottomInset();
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={p.onBack} hitSlop={8}><Text className="text-2xl text-foreground">‹</Text></Pressable>
        <View>
          <Text className="text-xl font-bold text-foreground">Add delivery</Text>
          <Text className="text-sm text-muted-foreground">Add proof photos</Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 py-4">
        <View className="rounded-3xl border border-border bg-card p-4">
          <Text className="text-base font-bold text-card-foreground">{p.invoice.invoiceNumber}</Text>
          <Text className="mt-2 text-sm font-medium text-card-foreground">
            {p.invoice.customerName ?? "Customer"}
            {p.invoice.customerCode ? <Text className="text-xs font-normal text-muted-foreground">  ·  {p.invoice.customerCode}</Text> : null}
          </Text>
          {addr ? <Text className="mt-1 text-sm text-muted-foreground">{addr}</Text> : null}
        </View>
        <View>
          <Text className="mb-2 text-sm font-medium text-foreground">Delivery photos <Text className="text-destructive">*</Text></Text>
          <View className="flex-row flex-wrap gap-2">
            {p.photos.map((ph, i) => (
              <View key={ph.uri} className="relative">
                <Image source={{ uri: ph.uri }} style={{ width: 84, height: 84, borderRadius: 11 }} contentFit="cover" />
                <Pressable className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-destructive" hitSlop={6} onPress={() => p.onRemovePhoto(i)}>
                  <Text className="text-xs font-bold text-white">✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Pressable className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 ${p.stamping ? "opacity-50" : ""}`} disabled={p.stamping} onPress={p.onAddPhoto}>
            {p.stamping ? (
              <><ActivityIndicator size="small" /><Text className="text-sm font-semibold text-secondary-foreground">Adding photo…</Text></>
            ) : (
              <Text className="text-sm font-semibold text-secondary-foreground">Take photo</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {p.error ? <ErrorBanner message={p.error} className="mb-2" /> : null}
        <Pressable className={`items-center rounded-full bg-primary py-3.5 ${p.busy ? "opacity-50" : ""}`} disabled={p.busy} onPress={p.onSave}>
          {p.busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-primary-foreground">Save delivery</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
