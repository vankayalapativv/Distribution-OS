import { ScrollView, Text, View } from "react-native";
import { formatStatus } from "../lib/format";
import type { OrderDetail } from "../lib/order-detail";
import {
  dateLabel,
  FULFILLMENT_LABEL,
  packLabel,
  STATUS_CHIP,
} from "./order-detail-sheet-utils";

/** The loaded order: header + status chip, scrollable line items, totals bar. */
export function OrderDetailBody({
  detail,
  fulfillment,
}: Readonly<{
  detail: OrderDetail;
  fulfillment: string;
}>) {
  return (
    <>
      {/* Header */}
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-card-foreground">
          {detail.orderCode ?? "Order"}
        </Text>
        <Text
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_CHIP[fulfillment] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {FULFILLMENT_LABEL[fulfillment] ?? formatStatus(fulfillment)}
        </Text>
      </View>
      <Text className="mb-3 text-xs text-muted-foreground">
        {dateLabel(detail.orderDate)}
      </Text>

      {/* Items */}
      <ScrollView className="max-h-96">
        <View className="overflow-hidden rounded-xl border border-border">
          {detail.items.map((item, i) => {
            const packText = item.packSizeLitres != null ? ` · ${packLabel(item.packSizeLitres)} pack` : "";
            const subText = `${item.segment ?? "Oil"}${packText}`;
            return (
            <View
              key={`${item.name}-${item.segment ?? ""}-${item.packSizeLitres ?? ""}-${item.quantityUnits}`}
              className={`flex-row items-center justify-between gap-3 px-4 py-2.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-card-foreground" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {subText}
                </Text>
              </View>
              <Text className="shrink-0 text-right text-sm tabular-nums text-card-foreground">
                ×{item.quantityUnits}
                {item.totalLitres != null ? (
                  <Text className="text-xs text-muted-foreground">
                    {"  "}{item.totalLitres} L
                  </Text>
                ) : null}
              </Text>
            </View>
            );
          })}
          {detail.items.length === 0 ? (
            <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
              No line items recorded.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Totals */}
      <View className="mt-3 flex-row items-center justify-between rounded-xl bg-secondary px-4 py-3">
        <Text className="text-sm font-medium text-secondary-foreground">Total</Text>
        <Text className="text-sm font-semibold tabular-nums text-secondary-foreground">
          {detail.totalLitres > 0 ? `${detail.totalLitres} L` : "—"}
        </Text>
      </View>
    </>
  );
}
