// Service worker minimo: serve solo a mostrare la notifica del timer come una
// vera notifica di sistema (persistente, con il tap che riporta all'app).
// Nessuna cache: l'app continua a funzionare solo online.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const target = windows[0];
      if (target) {
        await target.focus();
        target.postMessage({ type: 'kuma-timer-stop' });
        return;
      }

      await self.clients.openWindow('/');
    })()
  );
});
