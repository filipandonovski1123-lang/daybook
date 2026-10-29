/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// Offline support: precache the built app shell. No runtime caching of anything external — the app makes no network requests.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Photos for the optional colour themes aren't precached; keep each one after its first view.
registerRoute(({ url }) => url.origin === self.location.origin && /\/images\/(midnight|forest|athletic)\//.test(url.pathname), new CacheFirst({ cacheName: 'theme-photos' }));

// New versions take over immediately. All user data lives in IndexedDB, so an update never loses anything.
void self.skipWaiting();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Clicking a reminder focuses an open window or opens the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
