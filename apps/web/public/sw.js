// Service worker: recebe o push do servidor e mostra a notificação, mesmo com a aba do jogo fechada.
// Clicar na notificação traz a aba do jogo para frente (ou abre uma nova).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Grand Trade Idle', body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Grand Trade Idle', {
    body: data.body || '',
    tag: data.tag || 'grand-trade-idle',
    renotify: true,
    requireInteraction: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
