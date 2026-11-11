import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useBottomInset } from "../../lib/use-bottom-inset";

/** Sticky footer save button shared by the settings sub-screens. */
export function SaveBar({
  label,
  busy,
  canSave,
  onPress,
}: {
  readonly label: string;
  readonly busy: boolean;
  readonly canSave: boolean;
  readonly onPress: () => void;
}) {
  const bottomPad = useBottomInset();
  return (
    <View className="border-t border-border px-5 pt-3" style={{ paddingBottom: bottomPad }}>
      <Pressable
        className={`items-center rounded-lg bg-primary py-3.5 ${canSave ? "" : "opacity-50"}`}
        onPress={onPress}
        disabled={!canSave}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-base font-semibold text-primary-foreground">{label}</Text>
        )}
      </Pressable>
    </View>
  );
}
