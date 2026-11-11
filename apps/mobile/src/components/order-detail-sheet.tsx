/**
 * Bottom sheet showing one order's full breakdown — opened by tapping an
 * ORD-*** card on the customer page.
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchOrderDetail, type OrderDetail } from "../lib/order-detail";
import { useIsOnline } from "../lib/connectivity";
import { OrderDetailBody } from "./order-detail-body";
import { OrderDetailSkeleton } from "./order-detail-skeleton";

export interface OrderSheetTarget {
  /** Server order id. */
  orderId?: string;
  /** Fulfillment stage from the list row, so the sheet badge matches the card. */
  fulfillmentStatus?: string | null;
}

export function OrderDetailSheet({
  target,
  onClose,
}: {
  readonly target: OrderSheetTarget;
  readonly onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const online = useIsOnline();
  // This sheet is a bare <Modal>, which renders outside the SafeAreaProvider tree,
  // so pad the bottom by the device inset directly to clear the Android nav bar /
  // home indicator.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setFailed(false);
    if (target.orderId) {
      void fetchOrderDetail(target.orderId).then((result) => {
        if (cancelled) return;
        if (result) setDetail(result);
        else setFailed(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [target.orderId]);

  // Show the fulfillment stage the card showed (defaults to "ordered").
  const fulfillment = target.fulfillmentStatus ?? "ordered";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[80%] rounded-t-3xl bg-card px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 h-1 w-9 self-center rounded-full bg-border" />

          {(() => {
            if (failed) {
              return (
                <View className="items-center gap-2 py-10">
                  <Text className="text-sm font-medium text-card-foreground">
                    Couldn&apos;t load this order
                  </Text>
                  <Text className="px-8 text-center text-xs text-muted-foreground">
                    {online
                      ? "Something went wrong. Please try again."
                      : "You're offline. Reconnect and try again."}
                  </Text>
                </View>
              );
            }
            if (!detail) {
              return <OrderDetailSkeleton />;
            }
            return <OrderDetailBody detail={detail} fulfillment={fulfillment} />;
          })()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
