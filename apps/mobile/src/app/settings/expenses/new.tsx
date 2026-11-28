import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "../../../components/error-banner";
import { useClaimForm } from "../../../lib/use-claim-form";

/** Submit a new expense claim (receipt required), or edit + resubmit a rejected one. */
export default function NewExpenseScreen() {
  const f = useClaimForm();

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{f.editId ? (f.editStatus === "rejected" ? "Edit & resubmit" : "Edit expense") : "New expense"}</Text>
      </View>

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

        {f.editId ? null : (
          <View>
            <Text className="mb-1 text-sm font-medium text-foreground">Receipt <Text className="text-destructive">*</Text></Text>
            {f.receiptUri ? (
              <Image source={{ uri: f.receiptUri }} className="h-40 w-full rounded-2xl" resizeMode="cover" />
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
          </View>
        )}

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
    </SafeAreaView>
  );
}
