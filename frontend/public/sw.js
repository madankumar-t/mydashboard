// This service worker immediately unregisters itself
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    // Unregister this service worker
    self.registration.unregister()
        .then(function () {
            return self.clients.matchAll();
        })
        .then(function (clients) {
            clients.forEach(client => client.navigate(client.url));
        });
});
