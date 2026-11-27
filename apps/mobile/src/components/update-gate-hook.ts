import { useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import { readUpdateReleaseInfo } from "../lib/update-release-info";

export interface OtaState {
  installing: boolean;
  downloading: boolean;
  version: string | null;
  notes: string[];
  pct: number;
}

/** Drives the OTA overlay: applies a pending bundle, guards against a stalled
 *  download, and derives the installing/downloading phase + version/notes/%. */
export function useOtaUpdate(): OtaState {
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
