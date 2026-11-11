import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** Time-of-day greeting (device-local hour). Late night / pre-dawn → night. */
function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

/** Home header: a time-based greeting with the SE's name, and the live date +
 *  time below. Isolated so its tick doesn't re-render the whole dashboard. */
export function GreetingHeader({ name }: { readonly name: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const greeting = greetingFor(now.getHours());
  const date = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  // Shimmer until the signed-in name is available (e.g. auth still hydrating).
  if (!name) {
    return (
      <View className="flex-1 pr-3">
        <SkeletonTheme>
          <Skeleton width={200} height={24} />
          <View className="mt-1.5">
            <Skeleton width={130} height={12} />
          </View>
        </SkeletonTheme>
      </View>
    );
  }
  return (
    <View className="flex-1 pr-3">
      <Text className="text-[24px] font-extrabold text-foreground" numberOfLines={1}>
        {greeting}
        {name ? `, ${name}` : ""}
      </Text>
      <Text className="mt-0.5 text-md text-muted-foreground">
        {date} · {time}
      </Text>
    </View>
  );
}
