import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ErrorBanner } from "../../components/error-banner";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDialog } from "../../components/dialog";
import { CustomerPicker } from "../../components/reminders/customer-picker";
import { saveReminder } from "../../components/reminders/save-reminder";
import { useReminderForm } from "../../components/reminders/use-reminder-form";
import { WhenField } from "../../components/reminders/when-field";
import { usePlaceholderColor } from "../../lib/theme";
import { useBottomInset } from "../../lib/use-bottom-inset";

/** Full-screen reminder form (pushed route — keyboard never covers it).
 *  Doubles as the Edit screen when an `id` param is passed. */
export default function NewReminderScreen() {
  const placeholder = usePlaceholderColor();
  const bottomPad = useBottomInset();
  const dialog = useDialog();
  const form = useReminderForm();
  const { editId, title, setTitle, error, setError, busy } = form;
  const onSave = () => void saveReminder({ ...form, confirm: dialog.confirm });

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">
          {editId != null ? "Edit reminder" : "New reminder"}
        </Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Text className="text-sm font-medium text-foreground">
          Remind me about <Text className="text-destructive">*</Text>
        </Text>
        <TextInput
          className="mt-1 rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground"
          placeholder="e.g. Collect payment"
          placeholderTextColor={placeholder}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (error) setError(null);
          }}
        />

        <WhenField
          when={form.when}
          whenLabel={form.whenLabel}
          showDate={form.showDate}
          showTime={form.showTime}
          setShowDate={form.setShowDate}
          setShowTime={form.setShowTime}
          setWhen={form.setWhen}
        />

        <CustomerPicker
          customer={form.customer}
          customerSearch={form.customerSearch}
          trimmedSearch={form.trimmedSearch}
          filteredCustomers={form.filteredCustomers}
          pending={form.customersQuery.isPending}
          setCustomer={form.setCustomer}
          setCustomerSearch={form.setCustomerSearch}
          clearError={() => setError(null)}
        />

        {error ? <ErrorBanner message={error} className="mt-3" /> : null}
      </KeyboardAwareScrollView>

      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        <Pressable
          className={`items-center rounded-full bg-primary py-3.5 ${busy ? "opacity-50" : ""}`}
          disabled={busy}
          onPress={onSave}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              {editId != null ? "Save changes" : "Set reminder"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
