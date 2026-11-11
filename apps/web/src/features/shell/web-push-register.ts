"use client";

/**
 * Browser Web Push registration — pairs with the in-tab SoundNotifier. Registers
 * the service worker, subscribes with the server's VAPID public key, and stores
 * the subscription so the server can push order/collection/visit alerts even
 * when no tab is open. Gated by Notification permission (the SoundNotifier asks
 * for it). All failures are non-fatal — the in-tab sound/flash still work.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

let busy = false;

/** Ensure a push subscription exists and is stored server-side. Idempotent. */
export async function enableWebPush(): Promise<void> {
  if (!supported() || Notification.permission !== "granted" || busy) return;
  busy = true;
  try {
    const res = await fetch("/api/web-push/public-key", { cache: "no-store" });
    const { publicKey } = (await res.json()) as { publicKey: string | null };
    if (!publicKey) return; // Web Push not configured on the server
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await fetch("/api/web-push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch {
    // SW/push registration can fail (private mode, unsupported, blocked) — ignore.
  } finally {
    busy = false;
  }
}

/** Remove the subscription (server + browser) — called when sound is disabled. */
export async function disableWebPush(): Promise<void> {
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/web-push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {
    // ignore
  }
}
