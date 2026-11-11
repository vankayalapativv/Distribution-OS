import { Pressable, Text, View } from "react-native";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

/** Right-side A–Z fast-scroll rail: tapping a present letter jumps to it;
 *  absent letters are dimmed + disabled. */
export function AzIndex({
  presentLetters,
  onJump,
}: {
  readonly presentLetters: Set<string>;
  readonly onJump: (letter: string) => void;
}) {
  return (
    <View className="absolute bottom-2 right-0 top-2 justify-center" pointerEvents="box-none">
      {ALPHABET.map((letter) => {
        const present = presentLetters.has(letter);
        return (
          <Pressable
            key={letter}
            hitSlop={4}
            disabled={!present}
            onPress={() => onJump(letter)}
            className="px-2 py-0.5"
          >
            <Text
              className={`text-center text-[10px] font-bold ${
                present ? "text-primary" : "text-muted-foreground/25"
              }`}
            >
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
