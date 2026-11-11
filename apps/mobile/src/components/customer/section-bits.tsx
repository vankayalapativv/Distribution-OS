import { Pressable, Text, View } from "react-native";

/** Fulfillment-ladder + approval chip colours (customer-page badges). */
export const STATUS_CHIP: Record<string, string> = {
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-700",
  ordered: "bg-slate-100 text-slate-700",
  partially_invoiced: "bg-amber-100 text-amber-800",
  invoiced: "bg-blue-100 text-blue-700",
  partially_delivered: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

/** Readable labels for the fulfillment stages (formatStatus keeps underscores). */
export const FULFILLMENT_LABEL: Record<string, string> = {
  ordered: "Ordered",
  partially_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function SectionTitle({ children }: { readonly children: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}

export function SectionError({ label, onRetry }: { readonly label: string; readonly onRetry: () => void }) {
  return (
    <View className="items-center rounded-3xl border border-border bg-card px-4 py-6">
      <Text className="text-center text-sm text-muted-foreground">{label}</Text>
      <Pressable className="mt-3 rounded-full bg-secondary px-4 py-2" onPress={onRetry}>
        <Text className="text-sm font-medium text-secondary-foreground">Try again</Text>
      </Pressable>
    </View>
  );
}
