import { type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useIsOnline } from "../lib/connectivity";
import { humanizeError } from "../lib/humanize-error";
import { Icon } from "./icon";

/**
 * The standard "this failed" state for any screen or section: a friendly,
 * humanized message (offline-aware) plus a Retry affordance — so a failed load
 * is never a dead-end or a raw error string. Drop it into a query's error branch:
 *
 *   if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
 */
export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
  /** Inline sections (a card body) — smaller, no full-height centering. */
  readonly compact?: boolean;
}) {
  const online = useIsOnline();
  const { title, message, severity } = humanizeError(error, { online });
  // Severity-coloured so a hard error (red) reads differently from a soft
  // warning / offline (amber), instead of a flat grey for everything.
  const color = !online || severity === "warning" ? "#d97706" : "#dc2626";
  let iconName: ComponentProps<typeof Icon>["name"] = "alert-circle-outline";
  if (!online) iconName = "cloud-offline-outline";
  else if (severity === "warning") iconName = "warning-outline";
  return (
    <View className={`items-center justify-center gap-2 px-8 ${compact ? "py-8" : "flex-1 py-16"}`}>
      <Icon name={iconName} size={compact ? 26 : 34} color={color} />
      <Text className="text-center text-base font-semibold" style={{ color }}>{title}</Text>
      <Text className="text-center text-sm text-muted-foreground">{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          className="mt-2 flex-row items-center gap-1.5 rounded-lg bg-secondary px-4 py-2"
          hitSlop={8}
        >
          <Icon name="refresh" size={15} color="#334155" />
          <Text className="text-sm font-semibold text-foreground">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
