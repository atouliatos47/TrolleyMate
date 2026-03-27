// BasketMate Service Worker — network only, no caching
// Unregisters old cache-heavy versions automatically

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    // Always go to network — no caching
    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});

self.addEventListener('push', e => {
    if (!e.data) return;
    const data = e.data.json();
    e.waitUntil(
        self.registration.showNotification(data.title || 'BasketMate', {
            body: data.body || 'Your shopping list was updated',
            icon: '/img/icon-192.png',
            badge: '/img/icon-192.png',
            tag: 'basketmate-update',
            renotify: true,
            data: { url: '/' }
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow('/');
        })
    );
});
