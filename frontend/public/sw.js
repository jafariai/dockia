// Dockia — service worker (offline shell + static caching).
// API requests are intentionally never cached: data is private and auth-bound,
// so it must always hit the network.
const CACHE = "dockia-v1";
const APP_SHELL = ["/dashboard", "/login", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

// --- Web Push: show a notification even when the tab is closed --------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore malformed payloads */
  }
  const title = data.title || "Dockia";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag, // matches the in-app Notification → no duplicate
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever navigate to an in-app, same-origin path — never trust an absolute
  // or cross-origin URL from the push payload.
  const raw = event.notification.data && event.notification.data.url;
  const target =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            // Await the navigation so the SW isn't torn down mid-navigate; it
            // can reject for an uncontrolled client, so still focus regardless.
            try {
              if ("navigate" in client) await client.navigate(target);
            } catch {
              /* navigation not allowed for this client — fall through to focus */
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin GETs; never touch the API (auth/data must be live).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // Page navigations: network-first, fall back to cache when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(req)) ||
            (await caches.match("/dashboard")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // Hashed static assets + icons: cache-first (immutable, safe to serve stale).
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      })()
    );
  }
});
