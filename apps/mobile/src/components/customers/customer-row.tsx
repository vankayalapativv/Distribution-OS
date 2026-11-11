import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { DirectoryCustomer } from "../../lib/customer-directory";
import { avatarColor, initials } from "../../lib/customers/avatar";
import { HEADER_H, ROW_H } from "../../lib/customers/directory-rows";

export function LetterHeader({ letter }: { readonly letter: string }) {
  return (
    <View className="justify-end bg-secondary px-5 pb-1" style={{ height: HEADER_H }}>
      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {letter}
      </Text>
    </View>
  );
}

export function CustomerRow({ c }: { readonly c: DirectoryCustomer }) {
  const subtitle = [c.phone, c.city].filter(Boolean).join(" · ");
  return (
    <Pressable
      className="flex-row items-center gap-3 bg-secondary px-5 active:bg-muted"
      style={{ height: ROW_H }}
      onPress={() => router.push({ pathname: "/customer/[id]", params: { id: c.id, name: c.name } })}
    >
      <View className={`h-11 w-11 items-center justify-center rounded-full ${avatarColor(c.name)}`}>
        <Text className="text-sm font-bold text-white">{initials(c.name)}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {c.name}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
