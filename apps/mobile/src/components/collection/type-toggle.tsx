import { Pressable, Text, View } from "react-native";

const OPTIONS = [
  { key: "general", label: "General", hint: "Settling dues" },
  { key: "advance", label: "Advance", hint: "Paying ahead" },
] as const;

/** General (settling dues) / Advance (paying ahead) segmented toggle. */
export function CollectionTypeToggle({
  value,
  onChange,
}: {
  readonly value: "general" | "advance";
  readonly onChange: (v: "general" | "advance") => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">Collection type</Text>
      <View className="flex-row rounded-2xl border border-border bg-card p-1">
        {OPTIONS.map((t) => {
          const active = value === t.key;
          return (
            <Pressable
              key={t.key}
              className={`flex-1 items-center rounded-xl py-2 ${active ? "bg-accent" : ""}`}
              onPress={() => onChange(t.key)}
            >
              <Text
                className={`text-sm font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {t.label}
              </Text>
              <Text
                className={`text-[11px] ${active ? "text-muted-foreground" : "text-muted-foreground/70"}`}
              >
                {t.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value === "advance" ? (
        <Text className="text-xs text-muted-foreground">
          Clears the customer’s oldest dues first. Anything left over is held as credit until
          future invoices use it.
        </Text>
      ) : null}
    </View>
  );
}
