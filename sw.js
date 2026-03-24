const CACHE_NAME = 'basketmate-v11';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/style.css',
    '/js/utils.js',
    '/js/api.js',
    '/js/ui.js',
    '/js/app.js',
    '/js/stores.js',
    '/js/shopping.js',
    '/js/settings.js',
    '/img/icon-192.png',
    '/img/icon-512.png',
    '/img/atstudios-logo.jpg'
    '/js/i18n/core.js',
    '/js/i18n/lang-en.js',
    '/js/i18n/lang-pl.js',
    '/js/i18n/lang-ro.js',
    '/js/i18n/lang-el.js',
    '/js/i18n/lang-ur.js',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => { })))
        )
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Always network for API/SSE
    if (url.includes('/events') || url.includes('/items') || url.includes('/aisles') ||
        url.includes('/push') || url.includes('/households') ||
        url.includes('/favourites') || url.includes('/stores')) {
        return;
    }

    // Network-first for JS and HTML — always gets fresh code on deploy
    if (e.request.destination === 'script' || e.request.destination === 'document') {
        e.respondWith(
            fetch(e.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return response;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Cache-first for CSS and images
    if (e.request.destination === 'style' || e.request.destination === 'image') {
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
