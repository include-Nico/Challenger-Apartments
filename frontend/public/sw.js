// Service worker "spazzino". Serve solo a disattivare una vecchia versione della PWA che
// potesse essere rimasta attiva su qualche dispositivo, e a liberarne la cache. Non mette
// in cache nulla lui stesso, e appena finito il suo lavoro si disinstalla.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});