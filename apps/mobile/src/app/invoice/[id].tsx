/**
 * Invoice preview: the SE taps an invoice notification and lands here to SEE
 * the full PDF before forwarding it. The PDF is downloaded fresh (Bearer-auth)
 * to a local file and rendered in-app with react-native-pdf; a "Share to
 * WhatsApp" button forwards that same file. This replaces the old tap →
 * straight-to-share behaviour so nobody sends the wrong invoice.
 */
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pdf from "react-native-pdf";
import { Icon } from "../../components/icon";
import { useInvoicePdf } from "../../components/invoice/use-invoice-pdf";
import { PdfPageSkeleton } from "../../components/skeleton";
import { useBottomInset } from "../../lib/use-bottom-inset";
import { useIsOnline } from "../../lib/connectivity";

export default function InvoicePreviewScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const invoiceId = params.id;
  const label = params.title?.trim() || "Invoice";
  const bottomPad = useBottomInset();
  const online = useIsOnline();

  const { uri, state, setState, sharing, share, retry } = useInvoicePdf(invoiceId, label);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">←</Text>
        </Pressable>
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>

      {/* Body: the full PDF, or loading / error */}
      <View className="flex-1 bg-secondary">
        {(() => {
          if (state === "loading") {
            return <PdfPageSkeleton />;
          }
          if (state === "error") {
            return (
              <View className="flex-1 items-center justify-center gap-3 px-8">
                <Text className="text-center text-sm font-medium text-card-foreground">
                  Couldn&apos;t load this invoice
                </Text>
                <Text className="text-center text-xs text-muted-foreground">
                  {online
                    ? "Something went wrong. Please try again."
                    : "You're offline. Reconnect and try again."}
                </Text>
                <Pressable
                  className="mt-1 rounded-full bg-primary px-5 py-2.5"
                  onPress={retry}
                >
                  <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
                </Pressable>
              </View>
            );
          }
          if (uri) {
            return (
              <Pdf
                source={{ uri, cache: false }}
                trustAllCerts={false}
                style={{ flex: 1, backgroundColor: "transparent" }}
                onError={() => setState("error")}
              />
            );
          }
          return null;
        })()}
      </View>

      {/* Share button — forward the same file to the customer on WhatsApp */}
      <View className="border-t border-border bg-background px-4 pt-3" style={{ paddingBottom: bottomPad }}>
        <Pressable
          className={`flex-row items-center justify-center gap-2 rounded-full bg-primary py-3.5 ${
            state !== "ready" || sharing ? "opacity-50" : ""
          }`}
          onPress={() => void share()}
          disabled={state !== "ready" || sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Icon name="share-social-outline" size={18} color="#ffffff" />
          )}
          <Text className="text-base font-semibold text-primary-foreground">
            Share to WhatsApp
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
