import { type DimensionValue, View } from "react-native";
import { Skeleton, SkeletonTheme } from "../skeleton";

/** One bubble-shaped shimmer, aligned left (incoming) or right (own). */
function SkelBubble({ mine, width, height }: { readonly mine?: boolean; readonly width: DimensionValue; readonly height: number }) {
  return (
    <View className={`max-w-[82%] ${mine ? "self-end items-end" : "self-start items-start"}`}>
      {mine ? null : <Skeleton width={72} height={9} style={{ marginBottom: 4, marginLeft: 4 }} />}
      <Skeleton width={width} height={height} radius={16} />
    </View>
  );
}

/** Context-aware first-load shimmer for the Notes chat — a day separator and a
 *  few alternating incoming/own bubbles, mirroring the real transcript. The
 *  header and bottom compose bar stay rendered (not shimmered). */
export function NotesChatSkeleton() {
  return (
    <SkeletonTheme>
      <View className="flex-1 gap-2.5 px-3 py-4">
        <Skeleton width={56} height={10} style={{ alignSelf: "center", marginBottom: 2 }} />
        <SkelBubble width={190} height={44} />
        <SkelBubble mine width={150} height={38} />
        <SkelBubble width={210} height={52} />
        <SkelBubble mine width={120} height={38} />
        <SkelBubble width={168} height={44} />
      </View>
    </SkeletonTheme>
  );
}
