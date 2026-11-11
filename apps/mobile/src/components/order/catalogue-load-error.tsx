import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../error-state";
import { CatalogueSkeleton } from "./catalogue-skeleton";
import { OrderHeader } from "./order-header";

/** Catalogue shimmer while oils and/or credit are still loading. */
export function CatalogueLoading({
  customerName,
  onBack,
}: {
  readonly customerName?: string;
  readonly onBack: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <OrderHeader title="New order" subtitle={customerName} onBack={onBack} />
      <CatalogueSkeleton />
    </SafeAreaView>
  );
}

/** Oils failed to load (offline / server error). Show a retry — NOT an empty
 *  catalogue, which reads as "this distributor has no products." */
export function CatalogueLoadError({
  customerName,
  onBack,
  onRetry,
  error,
}: {
  readonly customerName?: string;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly error?: unknown;
}) {
  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <OrderHeader title="New order" subtitle={customerName} onBack={onBack} />
      <ErrorState error={error} onRetry={onRetry} />
    </SafeAreaView>
  );
}
