import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "../../../components/error-banner";
import { PhotoZoomViewer } from "../../../components/photo-zoom-viewer";
import { useClaimForm } from "../../../lib/use-claim-form";

/** Submit a new expense claim (receipt required), or edit + resubmit a rejected one. */
export default function NewExpenseScreen() {
  const f = useClaimForm();
  const [viewingReceipt, setViewingReceipt] = useState(false);
  // Show the already-attached receipt (authed) until the user picks a replacement.
  const showAttached = Boolean(f.editId && f.editHasReceipt && f.billUri && !f.receiptUri);
  // Whichever receipt is currently on the form is the one the viewer opens: a
  // freshly-picked local image (no auth), else the attached server copy (authed).
  const viewUri = f.receiptUri ?? (showAttached ? f.billUri : null);
  const viewHeaders = f.receiptUri ? undefined : f.authHeaders;

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{f.editId ? (f.editStatus === "rejected" ? "Edit & resubmit" : "Edit expense") : "New expense"}</Text>
      </View>

      {f.editLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : f.editError ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-sm text-muted-foreground">Couldn&apos;t load this claim. Check your connection and try again.</Text>
          <Pressable className="rounded-full bg-primary px-5 py-2.5" onPress={() => void f.retryEdit()}>
            <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 py-4" keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1 text-sm font-medium text-foreground">Category <Text className="text-destructive">*</Text></Text>
          {f.categoriesLoading ? (
            <ActivityIndicator />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {f.categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => f.setCategoryId(cat.id)}
                  className={`rounded-full border px-3 py-1.5 ${f.categoryId === cat.id ? "border-primary bg-primary" : "border-border bg-card"}`}
                >
                  <Text className={`text-sm font-medium ${f.categoryId === cat.id ? "text-primary-foreground" : "text-card-foreground"}`}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View>
          <Text className="mb-1 text-sm font-medium text-foreground">Amount <Text className="text-destructive">*</Text></Text>
          <TextInput
            className="rounded-2xl border border-border bg-card px-4 py-3 text-lg text-foreground"
            placeholder="₹ 0"
            keyboardType="numeric"
            value={f.amount}
            onChangeText={f.setAmount}
          />
        </View>

        <View>
          <Text className="mb-1 text-sm font-medium text-foreground">
            {f.editId ? "Replace receipt (optional)" : <>Receipt <Text className="text-destructive">*</Text></>}
          </Text>
          {f.receiptUri ? (
            // The freshly-picked receipt — tap to view full-screen (pinch-zoom).
            <View className="overflow-hidden rounded-2xl border border-border bg-card">
              <Pressable onPress={() => setViewingReceipt(true)} accessibilityLabel="View receipt">
                <Image source={{ uri: f.receiptUri }} className="h-40 w-full" resizeMode="cover" />
              </Pressable>
              <View className="px-3 py-2">
                <Text className="text-xs text-muted-foreground">Receipt added · tap to view</Text>
              </View>
            </View>
          ) : showAttached && f.billUri ? (
            // The receipt already on file — tap to view full-screen (pinch-zoom).
            <View className="overflow-hidden rounded-2xl border border-border bg-card">
              <Pressable onPress={() => setViewingReceipt(true)} accessibilityLabel="View receipt">
                <ExpoImage
                  source={{ uri: f.billUri, headers: f.authHeaders }}
                  style={{ width: "100%", height: 160, backgroundColor: "#f3f4f6" }}
                  contentFit="cover"
                  cachePolicy="none"
                  transition={150}
                />
              </Pressable>
              <View className="px-3 py-2">
                <Text className="text-xs text-muted-foreground">Receipt attached · tap to view</Text>
              </View>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <Pressable className="flex-1 items-center rounded-2xl border border-dashed border-primary bg-card py-4" onPress={() => f.pickReceipt("camera")}>
                <Text className="text-sm font-semibold text-primary">📷 Camera</Text>
              </Pressable>
              <Pressable className="flex-1 items-center rounded-2xl border border-dashed border-primary bg-card py-4" onPress={() => f.pickReceipt("gallery")}>
                <Text className="text-sm font-semibold text-primary">🖼 Gallery</Text>
              </Pressable>
            </View>
          )}
          {f.receiptUri ? (
            <Pressable className="mt-2 self-start" onPress={() => f.pickReceipt("camera")}>
              <Text className="text-xs font-semibold text-primary">Retake</Text>
            </Pressable>
          ) : null}
          {showAttached ? (
            <View className="mt-2 flex-row gap-4">
              <Pressable onPress={() => f.pickReceipt("camera")}>
                <Text className="text-xs font-semibold text-primary">📷 Replace with photo</Text>
              </Pressable>
              <Pressable onPress={() => f.pickReceipt("gallery")}>
                <Text className="text-xs font-semibold text-primary">🖼 Replace from gallery</Text>
              </Pressable>
            </View>
          ) : null}
          {f.editId && !f.receiptUri && !showAttached ? (
            <Text className="mt-1 text-xs text-muted-foreground">Keep the attached receipt, or pick a new one to replace it.</Text>
          ) : null}
        </View>

        <View>
          <Text className="mb-1 text-sm font-medium text-foreground">Note (optional)</Text>
          <TextInput
            className="rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground"
            placeholder="e.g. highway toll"
            value={f.remarks}
            onChangeText={f.setRemarks}
          />
        </View>

        {f.error ? <ErrorBanner message={f.error} /> : null}

        <Pressable
          className={`items-center rounded-full bg-primary py-3.5 ${f.busy ? "opacity-50" : ""}`}
          disabled={f.busy}
          onPress={f.save}
        >
          {f.busy ? <ActivityIndicator color="#ffffff" /> : (
            <Text className="text-base font-semibold text-primary-foreground">{f.editId ? (f.editStatus === "rejected" ? "Resubmit" : "Save changes") : "Submit for approval"}</Text>
          )}
        </Pressable>
      </ScrollView>
      )}
      {viewingReceipt && viewUri ? (
        <PhotoZoomViewer uri={viewUri} headers={viewHeaders} onClose={() => setViewingReceipt(false)} />
      ) : null}
    </SafeAreaView>
  );
}
