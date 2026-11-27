/**
 * Tap-cards for the tracking map — a customer pin and a check-in pin each open a
 * native bottom card (not the map's HTML popup, which can't navigate the RN app).
 * The card shows the SAME details as the web popup, and the customer name is
 * tappable to open that customer's screen.
 */
import { Pressable, Text, View } from "react-native";
import { Icon } from "../icon";
import type { DuesBand, MapCustomer } from "../../lib/admin-tracking";
import { bucketColor, bucketLabel, collectionChip, orderChip, rupees } from "../../lib/tracking-overlays";
import { CardShell, Pill } from "./tracking-card-shell";

export { CheckinCard } from "./checkin-card";

/** Customer pin card — name (opens the customer), city · salesperson, dues line,
 *  last-order / last-collection chips. Mirrors the web customer popup. */
export function CustomerCard({
  customer,
  bands,
  onClose,
  onOpen,
}: {
  readonly customer: MapCustomer;
  readonly bands: DuesBand[];
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
          <Text className="text-muted-foreground"> due · {bucketLabel(customer.bucket, bands)}</Text>
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
