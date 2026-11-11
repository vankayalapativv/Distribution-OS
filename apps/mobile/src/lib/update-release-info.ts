/**
 * Pure manifest parsing for the OTA update screen — no native imports, so it is
 * unit-testable. Reads the version label + release notes of an INCOMING update
 * from its manifest (`extra.expoClient.extra`), the copy of app.json
 * `expo.extra` baked into that update at publish time. The update screen runs on
 * the OLD bundle, so this is the only way it can show the version/notes of the
 * build being downloaded.
 */
export interface UpdateReleaseInfo {
  /** The incoming build's OTA label, e.g. "1.1.2.1", or null if the manifest omits it. */
  version: string | null;
  /** The incoming build's "What's new" bullets (may be empty). */
  notes: string[];
}

export function readUpdateReleaseInfo(manifest: unknown): UpdateReleaseInfo {
  const extra = (manifest as { extra?: { expoClient?: { extra?: Record<string, unknown> } } })
    ?.extra?.expoClient?.extra;
  const version = typeof extra?.otaBuild === "string" ? extra.otaBuild : null;
  const raw = extra?.releaseNotes;
  const notes = Array.isArray(raw) ? raw.filter((n): n is string => typeof n === "string") : [];
  return { version, notes };
}
