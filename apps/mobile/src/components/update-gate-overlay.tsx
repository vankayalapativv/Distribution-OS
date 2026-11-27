import { ActivityIndicator, Text, View } from "react-native";
import { Icon } from "./icon";
import { OK, PRIMARY, styles } from "./update-gate-styles";
import type { OtaState } from "./update-gate-hook";

/** The full-screen progress overlay (download → install). Presentational. */
export function UpdateOverlay({ installing, version, notes, pct }: Readonly<Omit<OtaState, "downloading">>) {
  const accent = installing ? OK : PRIMARY;
  return (
    <View style={styles.overlay} className="bg-secondary">
      {/* Brand badge: download arrow while fetching, spinner while installing. */}
      <View style={[styles.badge, { backgroundColor: accent }]}>
        {installing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Icon name="cloud-download-outline" size={34} color="#ffffff" />
        )}
      </View>

      <Text className="text-lg font-bold text-foreground">
        {installing ? "Installing update" : "Downloading update"}
      </Text>

      {version ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>Updating to v{version}</Text>
        </View>
      ) : (
        <View style={{ height: 14 }} />
      )}

      {/* Progress bar: real % while downloading, full green while installing. */}
      <View style={styles.barTrack}>
        <View
          style={{
            height: "100%",
            borderRadius: 999,
            width: installing ? "100%" : `${pct}%`,
            backgroundColor: accent,
          }}
        />
      </View>
      <View style={styles.meta}>
        <Text className="text-xs text-muted-foreground">
          {installing ? "Applying the new version…" : "Downloading…"}
        </Text>
        {installing ? null : (
          <Text className="text-sm font-semibold text-foreground">{pct}%</Text>
        )}
      </View>

      {notes.length > 0 ? (
        <View style={styles.whatsnew} className="border-border bg-card">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            What&apos;s new
          </Text>
          {notes.slice(0, 4).map((n) => (
            <View key={n} style={styles.noteRow}>
              <View style={styles.dot} />
              <Text className="flex-1 text-[13px] text-foreground">{n}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text className="mt-5 text-center text-xs text-muted-foreground">
        {installing
          ? "Almost done — the app will restart itself."
          : "Keep the app open — this only takes a moment."}
      </Text>
    </View>
  );
}
