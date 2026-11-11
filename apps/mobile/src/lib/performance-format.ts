/**
 * Pure, dependency-free helpers for the performance card. Kept out of
 * `performance.ts` (which imports the API/auth runtime) so they stay unit-testable
 * without pulling in the Expo runtime.
 */
import type { CollectionActual, MyPerformance } from "./performance";

/** Collections for a period, tolerant of older cached payloads without the field. */
export function collectionsForTab(
  perf: MyPerformance,
  tab: "today" | "week" | "month",
): CollectionActual {
  return perf[tab]?.collections ?? { total: 0, verified: 0 };
}
