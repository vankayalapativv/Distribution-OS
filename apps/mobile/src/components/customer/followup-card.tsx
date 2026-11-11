import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { apiFetch } from "../../lib/api";
import { getLocalDb } from "../../lib/db";
import {
  getOpenFollowup,
  resolveFollowupLocal,
  type LocalFollowup,
} from "../../lib/customer/followups";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Persistent card showing the customer's open follow-up ("said next week payment
 * last time") with a Mark-done action. Reads the offline mirror and refreshes on
 * focus, so it reflects a check-in popup resolving it or a new checkout creating one.
 */
export function FollowupCard({
  customerId,
  token,
}: Readonly<{ customerId: string; token: string | null }>) {
  const [followup, setFollowup] = useState<LocalFollowup | null>(null);

  useFocusEffect(
    useCallback(() => {
      const db = getLocalDb();
      setFollowup(db ? getOpenFollowup(db, customerId) : null);
    }, [customerId]),
  );

  if (!followup) return null;

  const onDone = () => {
    const db = getLocalDb();
    if (db) resolveFollowupLocal(db, customerId);
    setFollowup(null);
    // Best-effort server resolve (office view + stops the push); local is done.
    void apiFetch(`/followups/customers/${customerId}/resolve`, { method: "POST", token }).catch(
      () => undefined,
    );
  };

  return (
    <View className="gap-1.5 rounded-3xl border border-amber-300 bg-amber-50 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
          Pending follow-up
        </Text>
        {followup.followUpAt ? (
          <Text className="text-[11px] font-semibold text-amber-700">
            {formatWhen(followup.followUpAt)}
          </Text>
        ) : null}
      </View>
      <Text className="text-sm text-amber-900">Last visit: “{followup.reason}”</Text>
      <Pressable
        className="mt-1 self-start rounded-full bg-amber-600 px-4 py-1.5"
        onPress={onDone}
      >
        <Text className="text-xs font-semibold text-white">Mark done</Text>
      </Pressable>
    </View>
  );
}
