/**
 * Customer notes (SE): a running, append-only thread for one customer. The SE can
 * add notes any number of times but cannot edit or delete them once saved (only a
 * Super Admin can, from the web). Shows every note on the customer, newest first,
 * with author + date/time and an "edited" marker when a Super Admin has changed it.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactElement, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../components/error-state";
import { AddNoteBox } from "../../components/notes/add-note-box";
import { NoteCard, type CustomerNote } from "../../components/notes/note-card";
import { CardRowSkeleton, SkeletonList } from "../../components/skeleton";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cacheKeys } from "../../lib/cache-keys";
import { useIsOnline } from "../../lib/connectivity";
import { useCachedQuery } from "../../lib/use-cached-query";

export default function NotesScreen() {
  const { id, customerName } = useLocalSearchParams<{ id: string; customerName?: string }>();
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const online = useIsOnline();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useCachedQuery({
    queryKey: ["customer-notes", id],
    cacheKey: cacheKeys.notes(id ?? ""),
    fetcher: () => apiFetch<{ notes: CustomerNote[] }>(`/customers/${id}/notes`, { token }),
    enabled: Boolean(token && id),
  });
  const notes = query.data?.notes ?? [];

  const addMut = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/customers/${id}/notes`, { method: "POST", body: { body }, token }),
    onSuccess: () => {
      setDraft("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["customer-notes", id] });
    },
    // Save is gated on connectivity (disabled offline), so a failure here is a
    // server/unexpected error while online — don't blame the connection.
    onError: () => setError("Couldn't save the note. Please try again."),
  });

  // Notes post straight to the API with no offline queue (unlike orders /
  // collections / visits), so a note genuinely can't be saved offline — gate
  // Save on connectivity and tell the user, rather than let the app-wide
  // "saved & will sync" bar imply a note was queued.
  const canSave = draft.trim().length > 0 && !addMut.isPending && online;

  // Empty slot — skeleton while loading, error on failure, else the hint. Built
  // here (not an inline component in the JSX) so each branch is a plain element.
  let emptyContent: ReactElement;
  if (query.isPending) {
    emptyContent = <SkeletonList count={4} row={CardRowSkeleton} />;
  } else if (query.isError) {
    emptyContent = (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
    );
  } else {
    emptyContent = (
      <Text className="py-10 text-center text-sm text-muted-foreground">
        No notes yet for this customer.
      </Text>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Notes</Text>
          {customerName ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {customerName}
            </Text>
          ) : null}
        </View>
      </View>

      <FlatList
        className="flex-1"
        contentContainerClassName="gap-3 px-5 py-4"
        keyboardShouldPersistTaps="handled"
        data={notes}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={
          <AddNoteBox
            draft={draft}
            setDraft={setDraft}
            error={error}
            canSave={canSave}
            saving={addMut.isPending}
            onSave={() => addMut.mutate(draft.trim())}
            offline={!online}
          />
        }
        renderItem={({ item: n }) => <NoteCard note={n} />}
        ListEmptyComponent={emptyContent}
      />
    </SafeAreaView>
  );
}
