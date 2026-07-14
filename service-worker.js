/* Empire General Service — offline shell cache (Phase 5C) */
var CACHE_VERSION = '2026-07-14-civil-worker-assign';
var CACHE_NAME = 'empire-egs-' + CACHE_VERSION;

var PRECACHE = [
  './',
  './index.html',
  './cleaning.html',
  './cleaning-dashboard.html',
  './civil-department.html',
  './civil-issue.html',
  './electrical.html',
  './electric-issue.html',
  './fire-issue.html',
  './hse-inspection.html',
  './hse-department.html',
  './config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
  './assets/empire.css',
  './assets/empire-cleaning.css',
  './assets/empire-dept.css',
  './assets/empire-hub.css',
  './assets/empire-api.js',
  './assets/empire-auth.js',
  './assets/empire-core.js',
  './assets/empire-offline-queue.js',
  './assets/empire-civil-worker.css',
  './assets/empire-hub-stats.js',
  './assets/empire-pwa.js',
  './assets/issue-tracker.js',
  './assets/issue-excel-export.js',
  './assets/issue-configs.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key.indexOf('empire-egs-') === 0 && key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isApiRequest(url) {
  return url.hostname.indexOf('script.google.com') !== -1 ||
    url.hostname.indexOf('googleusercontent.com') !== -1 ||
    url.hostname.indexOf('api.imgbb.com') !== -1;
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
      return cached || network;
    })
  );
});
