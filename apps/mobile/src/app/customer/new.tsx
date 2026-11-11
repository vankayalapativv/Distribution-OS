import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "../../components/error-banner";
import { PhotoZoomViewer } from "../../components/photo-zoom-viewer";
import { NewCustomerForm } from "../../components/customer/new/new-customer-form";
import { useNewCustomerForm } from "../../lib/customer/use-new-customer-form";
import { useBottomInset } from "../../lib/use-bottom-inset";

/** Field capture of a new customer (SE — active immediately, decided 2026-07-09). */
export default function NewCustomerScreen() {
  const form = useNewCustomerForm();
  const { busy, error, onSubmit, photo } = form;
  const bottomPad = useBottomInset();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">New customer</Text>
      </View>

      <NewCustomerForm form={form} />

      <View className="border-t border-border px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {error ? <ErrorBanner message={error} className="mb-2.5" /> : null}
        <Pressable
          className={`items-center rounded-lg bg-primary py-3.5 ${busy ? "opacity-50" : ""}`}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">Save customer</Text>
          )}
        </Pressable>
      </View>

      {photo.viewerUri ? (
        <PhotoZoomViewer uri={photo.viewerUri} onClose={() => photo.setViewerUri(null)} />
      ) : null}
    </SafeAreaView>
  );
}
