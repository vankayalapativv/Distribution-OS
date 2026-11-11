/**
 * Shimmer skeletons (first-load placeholders).
 *
 * A light band sweeps left→right across gray blocks shaped like the real
 * content — "context aware": each screen composes a skeleton that mirrors
 * its layout, instead of a generic spinner. Pure RN (no gradient dependency,
 * so no native rebuild): the sweep is a skewed translucent band driven by a
 * single shared native-driver transform loop — cheap on low-end devices.
 *
 * Rule of use: skeletons appear ONLY when there is nothing cached to show.
 * When offline data exists, screens render it instantly and refresh quietly.
 *
 * This module is a barrel: the shimmer engine, the block primitive and the
 * per-screen row shapes live in sibling files, re-exported here so every
 * screen keeps importing from "components/skeleton".
 */
export { SkeletonTheme } from "./skeleton-sweep";
export { Skeleton } from "./skeleton-block";
export {
  CardRowSkeleton,
  ContactRowSkeleton,
  InvoiceRowSkeleton,
  ListRowSkeleton,
  PickerRowSkeleton,
} from "./skeleton-list-rows";
export {
  DuesRowSkeleton,
  FormFieldSkeleton,
  LedgerRowSkeleton,
  NotificationRowSkeleton,
  RecordRowSkeleton,
} from "./skeleton-detail-rows";
export { PdfPageSkeleton, SkeletonList } from "./skeleton-docs";
