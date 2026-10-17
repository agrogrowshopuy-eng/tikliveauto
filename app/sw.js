// TIKLIVEauto Celular: permite instalarla como app. Siempre busca la versión nueva en internet.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
