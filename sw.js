const CACHE_NAME = 'basketmate-v8';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/style.css',
    '/js/app.js',
    '/js/api.js',
    '/js/ui.js',
    '/js/utils.js',
    '/img/logo.png',
    '/img/icon-192.png',
    '/img/icon-512.png'
];

// Install — cache all static assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — remove old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Skip SSE and API calls — always network
    if (url.includes('/events') ||
        url.includes('/items') ||
        url.includes('/aisles') ||
        url.includes('/push') ||
        url.includes('/households') ||
        url.includes('/favourites') ||
        url.includes('/stores')) {
        return;
    }

    // Cache-first for static assets
    if (e.request.destination === 'style' ||
        e.request.destination === 'script' ||
        e.request.destination === 'image') {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request))
        );
        return;
    }

    // Network-first for everything else
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

// ===== PUSH NOTIFICATIONS =====
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

// Open app when notification tapped
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow('/');
        })
    );
});
