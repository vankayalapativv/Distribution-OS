import { Pressable, Text } from "react-native";
import { Icon, type IconName } from "../icon";
import { Skeleton } from "../skeleton";

/** Where the customer's visit sits today: not started → open → finished. */
export type VisitState = "none" | "open" | "done";

/** Per-state button appearance (colour, icon, text colour). */
const BUTTON_STYLE: Record<VisitState, { bg: string; iconName: IconName; iconColor: string; textColor: string }> = {
  done: { bg: "bg-green-50", iconName: "checkmark-circle", iconColor: "#15803d", textColor: "text-green-700" },
  open: { bg: "bg-amber-500", iconName: "log-out-outline", iconColor: "#ffffff", textColor: "text-white" },
  none: { bg: "bg-green-600", iconName: "location-outline", iconColor: "#ffffff", textColor: "text-white" },
};

/** Visit-state + busy → the button caption. */
function buttonLabel(state: VisitState, busy: boolean): string {
  if (state === "done") return "Visited today";
  if (state === "open") return busy ? "Checking out…" : "Check out";
  return busy ? "Checking in…" : "Check in";
}

/**
 * Field-only visit button that cycles through the day's visit:
 *   none → green "Check in"
 *   open → amber "Check out"
 *   done → locked green "Visited today"
 *
 * `confirmed` must be the header query's `isFetchedAfterMount`: the visit state is
 * derived from cached header data that paints instantly, so until the fresh fetch
 * confirms it we show a button-shaped skeleton rather than flashing one state
 * (e.g. "Check in") and swapping to another ("Visited today") a moment later.
 */
export function CheckInButton({
  state,
  busy,
  confirmed,
  onPress,
}: {
  readonly state: VisitState;
  readonly busy: boolean;
  readonly confirmed: boolean;
  readonly onPress: () => void;
}) {
  // Animated shimmer in the button's exact footprint while the visit state is
  // still being confirmed — so the SE never sees a wrong button flash and swap.
  if (!confirmed) {
    return <Skeleton height={46} radius={16} />;
  }

  const s = BUTTON_STYLE[state];
  const label = buttonLabel(state, busy);

  return (
    <Pressable
      className={`flex-row items-center justify-center gap-2 rounded-2xl py-3 ${s.bg} ${busy ? "opacity-50" : ""}`}
      disabled={busy || state === "done"}
      onPress={onPress}
    >
      <Icon name={s.iconName} size={18} color={s.iconColor} />
      <Text className={`text-[15px] font-semibold ${s.textColor}`}>{label}</Text>
    </Pressable>
  );
}
