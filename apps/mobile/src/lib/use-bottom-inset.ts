import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom padding (px) for a sticky footer / bottom action bar so its button clears
 * the Android navigation bar (3-button back/home/recent) or the gesture home
 * indicator. Adds the safe-area bottom inset on top of a base padding; on devices
 * with no bottom inset (gesture nav flush to the edge) it is just the base, so the
 * footer looks unchanged there.
 *
 * Screens use `SafeAreaView edges={["top"]}` (the bottom edge is owned by the
 * footer bar, whose card background fills to the screen edge with the button
 * lifted up by this padding). Apply as the footer container's `paddingBottom`.
 */
export function useBottomInset(base = 12): number {
  return useSafeAreaInsets().bottom + base;
}
