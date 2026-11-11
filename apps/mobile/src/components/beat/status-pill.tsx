import { Text } from "react-native";

const STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  checked_in: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-700",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  checked_in: "Checked in",
  completed: "Done",
  missed: "Missed",
};

/** Beat-stop status pill: pending=amber, done=green, missed=red (unvisited after
 *  the 8 PM day-end — see effectiveStopStatus). */
export function StatusPill({ status }: { readonly status: string }) {
  return (
    <Text
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status] ?? STYLES.pending}`}
    >
      {LABELS[status] ?? status}
    </Text>
  );
}
