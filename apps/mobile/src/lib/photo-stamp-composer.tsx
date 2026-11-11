import type { RefObject } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export interface ComposerJob {
  uri: string;
  width: number;
  height: number;
  lines: string[];
}

/**
 * The off-screen composite (photo + address/date band) that captureRef
 * snapshots. Rendered far off-screen rather than at opacity:0 — some Android
 * GPUs darken a snapshot taken under a transparent ancestor — and captured once
 * the <Image> reports it has loaded.
 */
export function StampComposer({
  job,
  shotRef,
  onReady,
  onError,
}: {
  readonly job: ComposerJob;
  readonly shotRef: RefObject<View | null>;
  readonly onReady: () => void;
  readonly onError: () => void;
}) {
  const fontSize = Math.max(12, Math.round(job.width * 0.028));
  return (
    <View pointerEvents="none" style={styles.offscreen}>
      <View
        ref={shotRef}
        collapsable={false}
        style={{ width: job.width, height: job.height, backgroundColor: "#000" }}
      >
        <Image
          source={{ uri: job.uri }}
          style={{ width: job.width, height: job.height }}
          resizeMode="cover"
          onLoad={onReady}
          onError={onError}
        />
        <View style={[styles.band, { padding: fontSize * 0.6 }]}>
          {job.lines.map((line, i) => (
            <Text
              key={line}
              style={[
                styles.line,
                { fontSize: i === 0 ? fontSize * 1.05 : fontSize },
                i === 0 && styles.brand,
              ]}
            >
              {line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -99999, top: -99999 },
  band: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  line: { color: "#fff", lineHeight: undefined },
  brand: { fontWeight: "700" },
});
