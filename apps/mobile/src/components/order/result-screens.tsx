import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CreditStatus } from "../../lib/order/types";
import type { OrderCart } from "../../lib/order/use-order-cart";
import { OrderHeader } from "./order-header";

/** S6 confirmation after a successful POST /orders. */
export function OrderConfirmation({
  orderCode,
  queued = false,
  customerName,
  cart,
  onDone,
  onAnother,
}: Readonly<{
  orderCode: string;
  /** True when the order was saved to the offline outbox and will sync later. */
  queued?: boolean;
  customerName?: string;
  cart: OrderCart;
  onDone: () => void;
  onAnother: () => void;
}>) {
  return (
    <SafeAreaView className="flex-1 bg-secondary">
      <View className="flex-1 items-center justify-center gap-2.5 px-8">
        <View className="h-16 w-16 items-center justify-center rounded-full border-2 border-green-600">
          <Text className="text-3xl text-green-700">✓</Text>
        </View>
        <Text className="mt-1 text-lg font-semibold text-foreground">
          {queued ? "Order saved" : "Order placed"}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {queued
            ? `Will sync when you're back online · ${customerName ?? "customer"}`
            : `${orderCode} · ${customerName ?? "customer"}`}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {cart.totalLines} item{cart.totalLines === 1 ? "" : "s"} · {cart.totalLitres} L
        </Text>
        <Pressable className="mt-4 rounded-full bg-primary px-10 py-3" onPress={onDone}>
          <Text className="text-sm font-semibold text-primary-foreground">Done</Text>
        </Pressable>
        <Pressable onPress={onAnother}>
          <Text className="mt-1 text-sm font-semibold text-primary">Start another order</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Credit-limit block screen — shown once the credit query resolves blocked. */
export function CreditBlocked({
  customerName,
  credit,
  onBack,
}: Readonly<{
  customerName?: string;
  credit: CreditStatus;
  onBack: () => void;
}>) {
  return (
    <SafeAreaView className="flex-1 bg-secondary">
      <OrderHeader title="New order" subtitle={customerName} onBack={onBack} />
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-lg font-semibold text-destructive">Orders blocked</Text>
        <Text className="text-center text-sm text-foreground">
          {customerName ?? "This customer"} has invoices overdue beyond {credit.creditOverdueDays}{" "}
          days.
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          Outstanding: ₹{credit.totalOutstanding.toLocaleString("en-IN")}. Collect payment before
          taking a new order.
        </Text>
        <Pressable className="mt-4 rounded-full bg-primary px-10 py-3" onPress={onBack}>
          <Text className="text-sm font-semibold text-primary-foreground">Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
