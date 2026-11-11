import { Pressable, ScrollView, Text, View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";
import type { SalesExec } from "../../lib/admin-dues";

/** Horizontal SE filter chips. "All executives" is real from the first frame;
 *  the name chips shimmer as placeholders until the executive list loads. */
export function DuesExecFilter({
  execs,
  execsLoading,
  execId,
  setExecId,
}: {
  readonly execs: SalesExec[];
  readonly execsLoading: boolean;
  readonly execId: string | null;
  readonly setExecId: (id: string | null) => void;
}) {
  return (
    <View className="border-b border-border bg-card py-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
        {[{ id: null, name: "All executives" } as { id: string | null; name: string }, ...execs].map(
          (e) => {
            const active = execId === e.id;
            return (
              <Pressable
                key={e.id ?? "all"}
                onPress={() => setExecId(e.id)}
                className={`rounded-full border px-3 py-1.5 ${
                  active ? "border-primary bg-primary" : "border-border bg-secondary"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    active ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {e.name}
                </Text>
              </Pressable>
            );
          },
        )}
        {execsLoading && execs.length === 0 ? (
          <SkeletonTheme>
            {[46, 62, 40, 54].map((w, i) => (
              <View key={i} className="rounded-full border border-border bg-secondary px-3 py-1.5">
                <Skeleton width={w} height={13} radius={7} />
              </View>
            ))}
          </SkeletonTheme>
        ) : null}
      </ScrollView>
    </View>
  );
}
