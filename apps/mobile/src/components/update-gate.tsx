import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { Icon } from "./icon";
import { readUpdateReleaseInfo } from "../lib/update-release-info";

const PRIMARY = "#3b82f6";
const OK = "#16a34a";
const TRACK = "#e5e9f0";

/**
 * Visible OTA updater. expo-updates checks + downloads a new JS bundle on launch
 * (default ON_LOAD). Instead of that happening silently — leaving the user to
 * quit and reopen twice before the new version applies — this shows a real
 * download progress bar (`downloadProgress`, 0→1), the incoming version + "What's
 * new" (read from that update's manifest), then an "Installing…" phase, and
 * reloads into the new bundle in the SAME session.
 *
 * Children stay mounted behind an absolute overlay (no unmount → no refetch
 * flash). It never blocks when there's no update, offline, in dev, or on error,
 * and a stall timeout stops a flaky download from trapping the user on the
 * overlay (the download still finishes in the background and applies next launch).
 */
interface OtaState {
  installing: boolean;
  downloading: boolean;
  version: string | null;
  notes: string[];
  pct: number;
}

/** Drives the OTA overlay: applies a pending bundle, guards against a stalled
 *  download, and derives the installing/downloading phase + version/notes/%. */
function useOtaUpdate(): OtaState {
  const {
    isDownloading,
    isUpdatePending,
    isUpdateAvailable,
    downloadProgress,
    availableUpdate,
    downloadedUpdate,
  } = Updates.useUpdates();
  const [reloadFailed, setReloadFailed] = useState(false);
  const [downloadTimedOut, setDownloadTimedOut] = useState(false);
  const reloadStarted = useRef(false);

  // A new bundle finished downloading → apply it immediately (one-session update).
  // On reload failure, hide the overlay and keep running the current bundle — the
  // pending update applies on the next cold start.
  useEffect(() => {
    if (!isUpdatePending || reloadStarted.current) return;
    if (!Updates.isEnabled || __DEV__) return;
    reloadStarted.current = true;
    void Updates.reloadAsync().catch(() => setReloadFailed(true));
  }, [isUpdatePending]);

  // Don't trap the user if the download stalls on a weak connection.
  useEffect(() => {
    if (!isDownloading) return;
    const t = setTimeout(() => setDownloadTimedOut(true), 20_000);
    return () => clearTimeout(t);
  }, [isDownloading]);

  const active = Updates.isEnabled && !__DEV__;
  // The incoming build's version + notes come from its manifest (we're running
  // the OLD bundle while it downloads). Prefer the downloaded update once present.
  const { version, notes } = readUpdateReleaseInfo(
    downloadedUpdate?.manifest ?? availableUpdate?.manifest,
  );
  return {
    installing: active && isUpdatePending && !reloadFailed,
    downloading: active && isDownloading && isUpdateAvailable && !downloadTimedOut,
    version,
    notes,
    pct: Math.round(Math.min(1, Math.max(0, downloadProgress ?? 0)) * 100),
  };
}

/** The full-screen progress overlay (download → install). Presentational. */
function UpdateOverlay({ installing, version, notes, pct }: Readonly<Omit<OtaState, "downloading">>) {
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

export function UpdateGate({ children }: { readonly children: React.ReactNode }) {
  const { installing, downloading, version, notes, pct } = useOtaUpdate();
  const show = installing || downloading;

  return (
    <View style={styles.root}>
      {children}
      {show ? <UpdateOverlay installing={installing} version={version} notes={notes} pct={pct} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  pill: {
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  pillText: { color: PRIMARY, fontSize: 12, fontWeight: "700" },
  barTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: TRACK,
    overflow: "hidden",
  },
  meta: {
    width: "100%",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  whatsnew: {
    width: "100%",
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
  },
  noteRow: { flexDirection: "row", gap: 8, marginBottom: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY, marginTop: 6 },
});
