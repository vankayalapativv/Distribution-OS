import { Text, TextInput, View } from "react-native";

function referencePlaceholder(mode: string): string {
  if (mode === "cheque") return "Cheque no.";
  if (mode === "cash") return "Receipt no. / note";
  return "UTR / transaction ref.";
}

/** Optional reference number (+ optional bank name when the mode is cheque). */
export function ReferenceField({
  mode,
  reference,
  onReference,
  bankName,
  onBankName,
  placeholderColor,
}: {
  readonly mode: string;
  readonly reference: string;
  readonly onReference: (v: string) => void;
  readonly bankName: string;
  readonly onBankName: (v: string) => void;
  readonly placeholderColor: string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-foreground">
        {mode === "cheque" ? "Cheque number" : "Reference number"}{" "}
        <Text className="font-normal text-muted-foreground">(optional)</Text>
      </Text>
      <TextInput
        className="rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
        placeholder={
          referencePlaceholder(mode)
        }
        placeholderTextColor={placeholderColor}
        value={reference}
        onChangeText={onReference}
      />
      {mode === "cheque" ? (
        <TextInput
          className="mt-2 rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
          placeholder="Bank name (optional)"
          placeholderTextColor={placeholderColor}
          value={bankName}
          onChangeText={onBankName}
        />
      ) : null}
    </View>
  );
}
