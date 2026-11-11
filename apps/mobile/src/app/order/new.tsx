import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  CatalogueLoadError,
  CatalogueLoading,
} from "../../components/order/catalogue-load-error";
import { CatalogueScreen } from "../../components/order/catalogue-screen";
import { ReviewScreen } from "../../components/order/review-screen";
import { CreditBlocked, OrderConfirmation } from "../../components/order/result-screens";
import { useOrderCart } from "../../lib/order/use-order-cart";
import { useOrderQueries } from "../../lib/order/use-order-queries";
import { useOrderSubmit } from "../../lib/order/use-order-submit";
import { useAuth } from "../../lib/auth";

/** S5 order creation + S6 confirmation — online-only. Oils + credit load in
 *  parallel on open; the catalogue is organised by brand tabs (oils only). */
export default function NewOrderScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName?: string;
  }>();
  const token = useAuth((s) => s.token);
  const cart = useOrderCart();
  const submit = useOrderSubmit(customerId, token, cart);
  const [reviewing, setReviewing] = useState(false);
  const { oils, credit } = useOrderQueries(customerId, token);

  const products = oils.data ?? [];

  if (submit.result) {
    return (
      <OrderConfirmation
        orderCode={submit.result.orderCode}
        queued={submit.result.queued}
        customerName={customerName}
        cart={cart}
        onDone={() => router.back()}
        onAnother={() => {
          cart.reset();
          submit.reset();
          setReviewing(false);
        }}
      />
    );
  }

  // Credit resolves in parallel; block only once it resolves blocked.
  if (credit.data?.creditBlocked) {
    return (
      <CreditBlocked customerName={customerName} credit={credit.data} onBack={() => router.back()} />
    );
  }

  if (oils.isPending || credit.isPending) {
    return <CatalogueLoading customerName={customerName} onBack={() => router.back()} />;
  }

  if (oils.isError) {
    return (
      <CatalogueLoadError
        customerName={customerName}
        onBack={() => router.back()}
        onRetry={() => void oils.refetch()}
        error={oils.error}
      />
    );
  }

  if (reviewing) {
    return (
      <ReviewScreen
        cart={cart}
        products={products}
        customerName={customerName}
        onBack={() => setReviewing(false)}
        onSubmit={submit.submit}
        submitting={submit.submitting}
        error={submit.error}
      />
    );
  }

  return (
    <CatalogueScreen
      customerName={customerName}
      products={products}
      creditUnknown={credit.data === null}
      cart={cart}
      onReview={() => setReviewing(true)}
      // Only flag offline when the settled data came from cache AND we're not
      // mid-revalidation — so a normal (succeeding) refetch on open doesn't flash
      // the "showing last synced data" banner while fresh data is on its way.
      offline={oils.fromCache && !oils.isFetching}
    />
  );
}
