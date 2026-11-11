import { Text, View } from "react-native";
import type { FulfillmentSummary } from "../../lib/admin-fulfillment";

/** Per-stage tint: soft fill + a coloured left accent + matching label/value,
 *  keyed to the same palette as the web fulfillment summary so both read alike. */
const TINT: Record<string, { card: string; label: string; value: string }> = {
  ordered: { card: "border-slate-200 border-l-slate-400 bg-slate-50", label: "text-slate-600", value: "text-slate-700" },
  partiallyInvoiced: { card: "border-indigo-200 border-l-indigo-400 bg-indigo-50", label: "text-indigo-700", value: "text-indigo-700" },
  invoiced: { card: "border-blue-200 border-l-blue-500 bg-blue-50", label: "text-blue-700", value: "text-blue-700" },
  partiallyDelivered: { card: "border-amber-200 border-l-amber-500 bg-amber-50", label: "text-amber-800", value: "text-amber-800" },
  delivered: { card: "border-green-200 border-l-green-500 bg-green-50", label: "text-green-700", value: "text-green-700" },
  partiallyReturned: { card: "border-orange-200 border-l-orange-400 bg-orange-50", label: "text-orange-700", value: "text-orange-700" },
  returned: { card: "border-rose-200 border-l-rose-500 bg-rose-50", label: "text-rose-700", value: "text-rose-700" },
  cancelled: { card: "border-gray-200 border-l-gray-400 bg-gray-100", label: "text-gray-500", value: "text-gray-600" },
};

export interface Stage {
  key: keyof FulfillmentSummary;
  label: string;
  emphasized?: boolean;
}

/** Three semantic groups (funnel order): the pipeline up to delivery, the
 *  completed end-state, and returns (a reversal — kept apart on purpose). */
export const GROUPS: { title: string; stages: Stage[] }[] = [
  {
    title: "In progress",
    stages: [
      { key: "ordered", label: "Ordered" },
      { key: "partiallyInvoiced", label: "Partial inv." },
      { key: "invoiced", label: "Invoiced" },
      { key: "partiallyDelivered", label: "Partial del." },
    ],
  },
  {
    title: "Completed",
    stages: [
      { key: "delivered", label: "Delivered", emphasized: true },
      { key: "cancelled", label: "Cancelled" },
    ],
  },
  {
    title: "Returns",
    stages: [
      { key: "partiallyReturned", label: "Partial ret." },
      { key: "returned", label: "Returned" },
    ],
  },
];

/** One stat tile — soft-tinted, coloured left accent bar, label + count. */
export function Tile({ stage, value }: { readonly stage: Stage; readonly value: number }) {
  const t = TINT[stage.key];
  return (
    // flex-1 so two tiles share a row 50/50 (a lone tile fills the row). Rows of two
    // are formed by the card (see AdminFulfillmentCard) chunking stages into pairs.
    <View className={`flex-1 rounded-xl border border-l-4 px-3 py-2.5 ${t.card}`}>
      <Text className={`text-[11px] font-medium ${t.label}`}>{stage.label}</Text>
      <Text className={`mt-0.5 font-bold tabular-nums ${stage.emphasized ? "text-2xl" : "text-lg"} ${t.value}`}>
        {value}
      </Text>
    </View>
  );
}
