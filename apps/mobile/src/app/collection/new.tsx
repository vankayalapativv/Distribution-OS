import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { AmountField } from "../../components/collection/amount-field";
import { CollectionConfirmation } from "../../components/collection/confirmation";
import { ModeChips } from "../../components/collection/mode-chips";
import { ProofField } from "../../components/collection/proof-field";
import { RecordButton } from "../../components/collection/record-button";
import { ReferenceField } from "../../components/collection/reference-field";
import { CollectionTypeToggle } from "../../components/collection/type-toggle";
import { ErrorBanner } from "../../components/error-banner";
import { useCollectionForm } from "../../lib/collection/use-collection-form";
import { usePlaceholderColor } from "../../lib/theme";
import { useBottomInset } from "../../lib/use-bottom-inset";

/** S7 record collection + S8 confirmation — online-only (POST + direct R2 upload). */
export default function NewCollectionScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName?: string;
  }>();
  const placeholder = usePlaceholderColor();
  const bottomPad = useBottomInset();
  const f = useCollectionForm(customerId, customerName ?? null);

  if (f.confirmedCode || f.queued) {
    return (
      <CollectionConfirmation
        code={f.confirmedCode ?? ""}
        queued={f.queued}
        amountNum={f.amountNum}
        mode={f.mode}
        collectionType={f.collectionType}
        onReset={f.reset}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Record collection</Text>
          {customerName ? (
            <Text className="text-sm text-muted-foreground">{customerName}</Text>
          ) : null}
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={24}
      >
        <CollectionTypeToggle value={f.collectionType} onChange={f.setCollectionType} />
        <AmountField value={f.amount} onChange={f.setAmount} placeholderColor={placeholder} />
        <ModeChips value={f.mode} onChange={f.setMode} />
        <ReferenceField
          mode={f.mode}
          reference={f.reference}
          onReference={f.setReference}
          bankName={f.bankName}
          onBankName={f.setBankName}
          placeholderColor={placeholder}
        />
        <ProofField photo={f.photo} preparing={f.preparing} uploading={f.submitting} onAdd={f.addPhoto} onRemove={() => f.setPhoto(null)} />
      </KeyboardAwareScrollView>

      <View className="border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {f.submitError ? <ErrorBanner message={f.submitError} className="mb-2" /> : null}
        <RecordButton
          canSubmit={f.canSubmit}
          submitting={f.submitting}
          status={f.status}
          amountNum={f.amountNum}
          onPress={f.onSubmit}
        />
      </View>
    </SafeAreaView>
  );
}
