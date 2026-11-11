/**
 * Tap-cards for the tracking map — a customer pin and a check-in pin each open a
 * native bottom card (not the map's HTML popup, which can't navigate the RN app).
 * The card shows the SAME details as the web popup, and the customer name is
 * tappable to open that customer's screen.
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "../icon";
import type { CheckinMarker, MapCustomer } from "../../lib/admin-tracking";
import {
  bucketColor,
  bucketLabel,
  checkinTime,
  collectionChip,
  orderChip,
  rupees,
  type Chip,
} from "../../lib/tracking-overlays";

function Pill({ chip }: { readonly chip: Chip }) {
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: chip.bg }}>
      <Text className="text-[11px] font-semibold" style={{ color: chip.fg }}>
        {chip.label}
      </Text>
    </View>
  );
}

function CardShell({
  children,
  onClose,
}: {
  readonly children: React.ReactNode;
  readonly onClose: () => void;
}) {
  return (
    <View
      className="absolute inset-x-0 bottom-0 gap-2 rounded-t-3xl border-t border-border bg-card px-5 pb-6 pt-3"
      style={{ shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}
    >
      <View className="mb-1 h-1 w-9 self-center rounded-full bg-border" />
      <Pressable onPress={onClose} hitSlop={10} className="absolute right-4 top-4">
        <Icon name="close" size={22} color="#64748b" />
      </Pressable>
      {children}
    </View>
  );
}

/** Customer pin card — name (opens the customer), city · salesperson, dues line,
 *  last-order / last-collection chips. Mirrors the web customer popup. */
export function CustomerCard({
  customer,
  onClose,
  onOpen,
}: {
  readonly customer: MapCustomer;
  readonly onClose: () => void;
  readonly onOpen: (c: MapCustomer) => void;
}) {
  const meta = [customer.city, customer.executiveName].filter(Boolean).join(" · ");
  return (
    <CardShell onClose={onClose}>
      <Pressable onPress={() => onOpen(customer)} className="flex-row items-center gap-1.5 self-start pr-8">
        <Text className="text-base font-bold text-primary">{customer.name}</Text>
        <Icon name="chevron-forward" size={16} color="#2563eb" />
      </Pressable>
      {meta ? <Text className="text-xs text-muted-foreground">{meta}</Text> : null}
      {customer.outstanding > 0 ? (
        <Text className="text-[13px]">
          <Text className="font-bold" style={{ color: bucketColor(customer.bucket) }}>
            {rupees(customer.outstanding)}
          </Text>
          <Text className="text-muted-foreground"> due · {bucketLabel(customer.bucket)}</Text>
        </Text>
      ) : (
        <Text className="text-[13px] font-medium" style={{ color: "#94a3b8" }}>
          No dues
        </Text>
      )}
      <View className="mt-0.5 gap-1.5">
        <Pill chip={orderChip(customer.lastOrderDays)} />
        <Pill chip={collectionChip(customer.lastCollectionDays)} />
      </View>
    </CardShell>
  );
}

/** Check-in pin card — customer (opens them), planned/unplanned + time, and the
 *  orders (litres) + collections (₹) made at that visit. */
export function CheckinCard({
  checkin,
  onClose,
  onOpen,
}: {
  readonly checkin: CheckinMarker;
  readonly onClose: () => void;
  readonly onOpen: (c: CheckinMarker) => void;
}) {
  const time = checkinTime(checkin.checkInAt);
  const planned = checkin.planned === "planned";
  return (
    <CardShell onClose={onClose}>
      <Pressable onPress={() => onOpen(checkin)} className="flex-row items-center gap-1.5 self-start pr-8">
        <Text className="text-base font-bold text-primary">{checkin.customerName}</Text>
        <Icon name="chevron-forward" size={16} color="#2563eb" />
      </Pressable>
      <View className="flex-row items-center gap-2">
        <View
          className="self-start rounded-full px-2 py-0.5"
          style={{ backgroundColor: planned ? "#dcfce7" : "#e0e7ff" }}
        >
          <Text className="text-[11px] font-semibold" style={{ color: planned ? "#15803d" : "#4338ca" }}>
            {planned ? "Planned visit" : "Unplanned visit"}
          </Text>
        </View>
        {time ? <Text className="text-xs text-muted-foreground">{time}</Text> : null}
      </View>

      <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
        <Text className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Orders
        </Text>
        {checkin.orders.length ? (
          checkin.orders.map((o) => (
            <View key={o.id} className="flex-row justify-between py-0.5">
              <Text className="text-[13px] text-foreground">{o.code}</Text>
              <Text className="text-[13px] font-semibold text-foreground">{o.litres} L</Text>
            </View>
          ))
        ) : (
          <Text className="py-0.5 text-[13px] text-muted-foreground">No orders</Text>
        )}

        <Text className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </Text>
        {checkin.collections.length ? (
          checkin.collections.map((c) => (
            <View key={c.id} className="flex-row justify-between py-0.5">
              <Text className="text-[13px] text-foreground">{c.code}</Text>
              <Text className="text-[13px] font-semibold text-foreground">{rupees(c.amount)}</Text>
            </View>
          ))
        ) : (
          <Text className="py-0.5 text-[13px] text-muted-foreground">No collections</Text>
        )}
      </ScrollView>
    </CardShell>
  );
}
