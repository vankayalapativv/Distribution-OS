import { Pressable, Text } from "react-native";

/** Compact "End day" pill beside the greeting — shown only while the day is on.
 *  Tapping it confirms, then stops tracking and locks the day until tomorrow. */
export function EndDayButton({
  busy,
  onPress,
}: {
  readonly busy: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      className={`items-center justify-center rounded-full bg-amber-500 px-3.5 py-2 ${
        busy ? "opacity-50" : "active:opacity-90"
      }`}
      disabled={busy}
      onPress={onPress}
      accessibilityLabel="End day"
    >
      <Text className="text-[13px] font-semibold text-white">{busy ? "Ending…" : "End day"}</Text>
    </Pressable>
  );
}
