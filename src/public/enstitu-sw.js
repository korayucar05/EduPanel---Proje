const CACHE_VERSION = "enstitu-push-v38";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Yeni bir bildiriminiz var." };
  }

  const title = String(payload.title || "e-Nstitü");
  const options = {
    body: String(payload.body || "Yeni bir bildiriminiz var."),
    tag: String(payload.tag || "enstitu-notification"),
    renotify: true,
    requireInteraction: false,
    icon: "/enstitu-transparent-192.png?v=38",
    badge: "/enstitu-transparent-192.png?v=38",
    data: {
      url: String(payload.url || "/"),
      role: String(payload.role || ""),
      ...(payload.data && typeof payload.data === "object" ? payload.data : {}),
    },
  };

  event.waitUntil((async () => {
    // Safari/iOS görünmez push bildirimine izin vermez; her push geldiğinde
    // bildirimi hemen kullanıcıya gösteriyoruz.
    await self.registration.showNotification(title, options);
    try {
      if (typeof self.registration.setAppBadge === "function") {
        await self.registration.setAppBadge(Number(payload?.data?.badgeCount || 1));
      }
    } catch {}
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.url || "/");

  event.waitUntil((async () => {
    try {
      if (typeof self.registration.clearAppBadge === "function") {
        await self.registration.clearAppBadge();
      }
    } catch {}

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      try {
        const current = new URL(client.url);
        const target = new URL(targetUrl, self.location.origin);
        if (current.origin === target.origin) {
          if ("navigate" in client) await client.navigate(target.href);
          return client.focus();
        }
      } catch {}
    }
    return self.clients.openWindow(new URL(targetUrl, self.location.origin).href);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_BADGE") {
    event.waitUntil((async () => {
      try {
        if (typeof self.registration.clearAppBadge === "function") {
          await self.registration.clearAppBadge();
        }
      } catch {}
    })());
  }
});
