import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { DuesExecFilter } from "../../components/admin/dues-exec-filter";
import { DuesBucketSelector } from "../../components/admin/dues-bucket-selector";
import { DuesCustomerList } from "../../components/admin/dues-customer-list";
import { ErrorState } from "../../components/error-state";
import { useAdminDues } from "../../lib/use-admin-dues";

/** Master collection-dues (Super Admin): all customers by ageing bucket,
 *  filterable to a single Sales Executive. */
export default function AdminDuesScreen() {
  const d = useAdminDues();

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="text-2xl text-muted-foreground">‹</Text>
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Collection dues</Text>
      </View>

      <DuesExecFilter
        execs={d.execs}
        execsLoading={d.execsLoading}
        execId={d.execId}
        setExecId={d.setExecId}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 py-4"
        refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={d.onRefresh} />}
      >
        {d.error ? (
          <ErrorState error={d.error} onRetry={() => void d.loadSummary()} />
        ) : (
          <>
            <DuesBucketSelector
              buckets={d.buckets}
              bucket={d.bucket}
              setBucket={d.setBucket}
              loading={d.loading}
            />
            <DuesCustomerList listLoading={d.listLoading} customers={d.customers} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
