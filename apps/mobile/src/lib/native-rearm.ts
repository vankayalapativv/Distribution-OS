/**
 * Fire-and-forget: hand the fresh "signed in" state to the native GPS uploader
 * so background pings keep authenticating without waiting for the next app-open.
 * Best-effort — a failure here must never affect the signed-in session. The
 * dynamic import of ./gps keeps this off the auth module's import cycle.
 */
export async function rearmNativeTracking(): Promise<void> {
  try {
    const gps = await import("./gps");
    await gps.setNativeSignedIn(true);
  } catch {
    // never surface a native re-arm failure to the caller
  }
}
