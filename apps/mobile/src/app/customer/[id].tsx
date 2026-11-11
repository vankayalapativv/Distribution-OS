import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDialog } from "../../components/dialog";
import { OrderDetailSheet, type OrderSheetTarget } from "../../components/order-detail-sheet";
import { ActionRow } from "../../components/customer/action-row";
import { CheckInButton } from "../../components/customer/check-in-button";
import { CollectionsSection } from "../../components/customer/collections-section";
import { FollowupCard } from "../../components/customer/followup-card";
import { CustomerSkeleton } from "../../components/customer/customer-skeleton";
import { HeroCard } from "../../components/customer/hero-card";
import { OrdersSection } from "../../components/customer/orders-section";
import { PhotoCaptureSheet } from "../../components/customer/photo-capture-sheet";
import { PhotosSection } from "../../components/customer/photos-section";
import { CustomerTopBar } from "../../components/customer/top-bar";
import { useAuth } from "../../lib/auth";
import { useCheckIn } from "../../lib/customer/use-checkin";
import { useCustomerScreen } from "../../lib/customer/queries";
import { usePhotos } from "../../lib/customer/use-photos";
import { usePullRefresh } from "../../lib/use-pull-refresh";

/** S10 — customer workspace: sale/collection actions, history, market intel. */
export default function CustomerDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const dialog = useDialog();
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  // Super Admin can CHECK IN at customers (without starting a day) but still has
  // no Market Intelligence / photos / follow-up (field-capture) surface.
  const isAdmin = user?.role === "SUPER_ADMIN";

  const { headerQuery, creditQuery, ordersQuery, collectionsQuery, invalidate } = useCustomerScreen(id, token); // prettier-ignore
  const header = headerQuery.data;
  const credit = creditQuery.data ?? null;
  const customerName = header?.legalName ?? header?.customerName ?? name ?? "Customer";
  const photos = usePhotos(id, token, customerName, user?.name ?? "");

  const { state: visitState, busy: checkinBusy, onPress: onVisitPress, reasonSheet, followupSheet } = useCheckIn({
    id,
    token,
    userId: user?.id,
    role: user?.role ?? undefined,
    customerName,
    saved: { latitude: header?.latitude ?? null, longitude: header?.longitude ?? null },
    serverVisitedToday: header?.visitedToday === true,
    serverCheckedOut: header?.todayVisitCheckedOut === true,
    serverVisitId: header?.todayVisitId ?? null,
    confirm: dialog.confirm,
    onChanged: () => void invalidate(),
  });
  const [marketSheet, setMarketSheet] = useState(false);
  const [orderSheet, setOrderSheet] = useState<OrderSheetTarget | null>(null);

  useFocusEffect(useCallback(() => void invalidate(), [id])); // eslint-disable-line react-hooks/exhaustive-deps

  const { refreshing, onRefresh } = usePullRefresh(() =>
    Promise.all([invalidate(), photos.query.refetch()]),
  );

  // Credit block state for the action row. Prefer the HEADER's value so it's
  // known at first paint (no enabled-"Order"→"Blocked" flash); fall back to the
  // invoices credit query only when an older cached header lacks it. undefined
  // (neither resolved yet) → the action row shows its skeleton.
  const creditBlocked = header?.creditBlocked ?? credit?.creditBlocked;

  return (
    <SafeAreaView className="flex-1 bg-secondary">
      <CustomerTopBar id={id!} name={customerName} code={header?.customerCode ?? null} />

      {headerQuery.isPending ? (
        <CustomerSkeleton />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-5 py-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <HeroCard header={header} credit={credit} creditPending={creditQuery.isPending} />
          <CheckInButton
            state={visitState}
            busy={checkinBusy}
            confirmed={headerQuery.isFetchedAfterMount}
            onPress={() => void onVisitPress()}
          />
          {!isAdmin && <FollowupCard customerId={id!} token={token} />}
          <ActionRow
            id={id!}
            customerName={customerName}
            creditBlocked={creditBlocked}
            creditLoading={creditQuery.isPending}
            isAdmin={isAdmin}
            onMarket={() => setMarketSheet(true)}
          />
          <OrdersSection query={ordersQuery} onOpen={(o) => setOrderSheet({ orderId: o.id, fulfillmentStatus: o.fulfillmentStatus })} />
          <CollectionsSection query={collectionsQuery} />
          {!isAdmin && <PhotosSection state={photos} token={token} />}
        </ScrollView>
      )}

      {orderSheet ? <OrderDetailSheet target={orderSheet} onClose={() => setOrderSheet(null)} /> : null}
      <PhotoCaptureSheet visible={marketSheet} onClose={() => setMarketSheet(false)} onPick={photos.onAdd} />
      {reasonSheet}
      {followupSheet}
    </SafeAreaView>
  );
}
