import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../icon";
import { fetchSalesExecutives } from "../../lib/admin-dues";
import { SalesExecPickerModal } from "./sales-exec-picker-modal";

/**
 * Searchable sales-executive picker for the New Customer screen (Super Admin
 * only). A tappable field opens a bottom-sheet modal with a live-filtered list
 * of active executives; picking one assigns the new customer's owner. Mirrors
 * the web "Add customer" dialog, where an office role must assign the SE.
 */
export function SalesExecSelect({
  value,
  valueName,
  onSelect,
  required,
  error,
}: {
  readonly value: string | null;
  readonly valueName: string | null;
  readonly onSelect: (id: string, name: string) => void;
  readonly required?: boolean;
  readonly error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: execs = [], isPending } = useQuery({
    queryKey: ["sales-executives"],
    queryFn: fetchSalesExecutives,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? execs.filter((e) => e.name.toLowerCase().includes(q)) : execs;
  }, [execs, search]);

  function close() {
    setOpen(false);
    setSearch("");
  }

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">
        Sales executive{required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-row items-center justify-between rounded-lg border bg-background px-4 py-2.5 ${
          error ? "border-destructive" : "border-border"
        }`}
      >
        <Text className={valueName ? "text-foreground" : "text-muted-foreground"}>
          {valueName ?? "Select executive"}
        </Text>
        <Icon name="chevron-down" size={16} color="#64748b" />
      </Pressable>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}

      <SalesExecPickerModal
        visible={open}
        value={value}
        filtered={filtered}
        isPending={isPending}
        search={search}
        onSearch={setSearch}
        onSelect={onSelect}
        onClose={close}
      />
    </View>
  );
}
