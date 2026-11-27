/**
 * Customer notes — a WhatsApp-style chat thread (append-only). The SE can add
 * notes any number of times but cannot edit or delete them once saved (only a
 * Super Admin can, from the web). Own notes align right; everyone else's align
 * left with the author's name. Oldest → newest, grouped by day, auto-scrolled
 * to the latest.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../components/error-state";
import { ChatBubble } from "../../components/notes/chat-bubble";
import { ChatDaySeparator } from "../../components/notes/chat-day-separator";
import { NotesComposeBar } from "../../components/notes/notes-compose-bar";
import { NotesChatSkeleton } from "../../components/notes/notes-chat-skeleton";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cacheKeys } from "../../lib/cache-keys";
import { useIsOnline } from "../../lib/connectivity";
import { buildChatItems, type ChatItem, type CustomerNote } from "../../lib/notes/chat-notes";
import { useCachedQuery } from "../../lib/use-cached-query";

export default function NotesScreen() {
  const { id, customerName } = useLocalSearchParams<{ id: string; customerName?: string }>();
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const online = useIsOnline();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);

  const query = useCachedQuery({
    queryKey: ["customer-notes", id],
    cacheKey: cacheKeys.notes(id ?? ""),
    fetcher: () => apiFetch<{ notes: CustomerNote[] }>(`/customers/${id}/notes`, { token }),
    enabled: Boolean(token && id),
  });
  const items = buildChatItems(query.data?.notes ?? [], user?.name ?? null);

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

  const canSave = draft.trim().length > 0 && !addMut.isPending && online;
  const toEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: false }), []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-1">
          {(() => {
            if (query.isPending) return <NotesChatSkeleton />;
            if (query.isError) {
              return (
                <View className="px-5 pt-6">
                  <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
                </View>
              );
            }
            if (items.length === 0) {
              return (
                <View className="flex-1 items-center justify-center px-10">
                  <Text className="text-center text-sm text-muted-foreground">
                    No notes yet. Add the first note about this customer below.
                  </Text>
                </View>
              );
            }
            return (
              <FlatList
                ref={listRef}
                data={items}
                keyExtractor={(it) => it.key}
                renderItem={({ item }) =>
                  item.kind === "day" ? (
                    <ChatDaySeparator label={item.label} />
                  ) : (
                    <ChatBubble note={item.note} mine={item.mine} />
                  )
                }
                contentContainerClassName="gap-2 px-3 py-4"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onContentSizeChange={toEnd}
              />
            );
          })()}
        </View>

        <NotesComposeBar
          draft={draft}
          onChange={(t) => {
            setDraft(t);
            if (error) setError(null);
          }}
          canSave={canSave}
          saving={addMut.isPending}
          onSave={() => addMut.mutate(draft.trim())}
          offline={!online}
          error={error}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
