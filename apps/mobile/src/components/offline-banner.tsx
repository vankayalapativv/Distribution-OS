import { Text, View } from "react-native";
import { Icon } from "./icon";

/**
 * Subtle "you're viewing cached data" strip, shown when a read screen fell back
 * to its local cache because the network was unreachable. Muted on purpose — it
 * informs without alarming (the data is still usable, just last-synced).
 */
export function OfflineBanner({ className }: { readonly className?: string }) {
  return (
    <View
      className={`flex-row items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 ${className ?? ""}`}
    >
      <Icon name="cloud-offline-outline" size={14} color="#64748b" />
      <Text className="text-xs font-medium text-muted-foreground">
        Showing last synced data
      </Text>
    </View>
  );
}
