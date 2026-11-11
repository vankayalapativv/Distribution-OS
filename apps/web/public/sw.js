/* Distribution OS service worker — Web Push for browser-closed notifications.
 * Receives encrypted push messages and shows an OS notification even when no
 * tab is open. Clicking focuses an existing dashboard tab or opens one. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Distribution OS";
  const options = {
    body: data.body || "",
    tag: data.tag || "beyond",
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes(target) && "focus" in client) return client.focus();
        }
        for (const client of clientsArr) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});

// Activate immediately on first install so pushes work without a reload.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
