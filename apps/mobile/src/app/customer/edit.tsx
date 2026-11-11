import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../components/error-state";
import { FormFieldSkeleton, SkeletonTheme } from "../../components/skeleton";
import { EditForm } from "../../components/customer/edit/edit-customer-form";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { CustomerDetail } from "../../lib/customer/use-edit-customer-form";

/**
 * SE-restricted customer edit (decided 2026-07-10): address + GPS only.
 * The API ignores any other field for SALES_EXECUTIVE and 404s on customers
 * the SE didn't create. Fields are pre-filled from the server (online-only).
 */
export default function EditCustomerScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const token = useAuth((s) => s.token);

  const detailQuery = useQuery({
    queryKey: ["customer-edit", id],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${id}`, { token }),
    enabled: Boolean(token && id),
    // Always reseed the form from live values, never a stale post-save cache.
    staleTime: 0,
    refetchOnMount: "always",
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
            Edit {detailQuery.data?.legalName ?? name ?? "customer"}
          </Text>
          <Text className="text-xs text-muted-foreground">
            Phone, address, shop location and customer photos
          </Text>
        </View>
      </View>

      {(() => {
        if (detailQuery.isPending) {
          return (
            <SkeletonTheme>
              <View className="gap-4 px-5 py-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <FormFieldSkeleton key={i} />
                ))}
              </View>
            </SkeletonTheme>
          );
        }
        if (detailQuery.isError) {
          return (
            <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
          );
        }
        return <EditForm id={id!} token={token} initial={detailQuery.data!} />;
      })()}
    </SafeAreaView>
  );
}
