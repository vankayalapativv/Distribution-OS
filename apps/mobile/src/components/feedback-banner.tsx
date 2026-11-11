import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "./icon";

/** Visual severity for inline feedback — matches the app's one error language,
 *  now extended to warning/success/info so a soft notice doesn't look like a
 *  hard failure. */
export type FeedbackVariant = "error" | "warning" | "success" | "info";

const VARIANT: Record<FeedbackVariant, { color: string; icon: IconName }> = {
  error: { color: "#dc2626", icon: "alert-circle" },
  warning: { color: "#d97706", icon: "warning-outline" },
  success: { color: "#16a34a", icon: "checkmark-circle" },
  info: { color: "#2563eb", icon: "information-circle" },
};

/**
 * One inline feedback banner for the whole app — a severity-coloured box with a
 * matching icon, an optional bold title, the message, and an optional "Try again"
 * for load failures. Error stays destructive-red (the prior look); warning is
 * amber, success green, info blue. The title + icon carry the colour; the message
 * stays dark for readability (red for error, to keep its emphasis).
 */
export function FeedbackBanner({
  variant = "error",
  title,
  message,
  onRetry,
  className,
}: {
  readonly variant?: FeedbackVariant;
  readonly title?: string;
  readonly message: string;
  readonly onRetry?: () => void;
  readonly className?: string;
}) {
  const v = VARIANT[variant];
  return (
    <View
      className={`flex-row items-start gap-2.5 rounded-xl border bg-white px-4 py-3 ${className ?? ""}`}
      style={{ borderColor: v.color }}
    >
      <Icon name={v.icon} size={18} color={v.color} />
      <View className="flex-1 gap-1">
        {title ? (
          <Text className="text-sm font-semibold leading-5" style={{ color: v.color }}>
            {title}
          </Text>
        ) : null}
        <Text
          className="text-sm font-medium leading-5"
          style={{ color: variant === "error" ? v.color : "#1f2937" }}
        >
          {message}
        </Text>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={6} className="mt-0.5 flex-row items-center gap-1 self-start">
            <Icon name="refresh" size={13} color={v.color} />
            <Text className="text-xs font-semibold" style={{ color: v.color }}>
              Try again
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
