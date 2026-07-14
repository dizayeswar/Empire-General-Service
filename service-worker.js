/* Empire General Service — offline shell cache + worker push (Phase 5C) */
var CACHE_VERSION = '2026-07-14-push2';
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
  './assets/firebase-sw-config.js',
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
  './assets/empire-push.js',
  './assets/issue-tracker.js',
  './assets/issue-excel-export.js',
  './assets/issue-configs.js',
  './assets/issue-recycle-bin.js'
];

try {
  importScripts('./config.js');
  importScripts('./assets/firebase-sw-config.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  if (typeof FIREBASE_SW_CONFIG !== 'undefined' && FIREBASE_SW_CONFIG && FIREBASE_SW_CONFIG.apiKey) {
    firebase.initializeApp(FIREBASE_SW_CONFIG);
    firebase.messaging().onBackgroundMessage(function (payload) {
      var note = payload && payload.notification;
      var title = (note && note.title) || 'New job assigned';
      var body = (note && note.body) || '';
      return self.registration.showNotification(title, {
        body: body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        data: { url: './civil-issue.html' },
        tag: 'empire-job',
        renotify: true
      });
    });
  }
} catch (e) {}

self.addEventListener('push', function (event) {
  if (!event.data) return;
  try {
    var data = event.data.json();
    var title = data.title || (data.notification && data.notification.title) || 'New job assigned';
    var body = data.body || (data.notification && data.notification.body) || '';
    event.waitUntil(self.registration.showNotification(title, {
      body: body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: (data.url || './civil-issue.html') },
      tag: 'empire-job',
      renotify: true
    }));
  } catch (err) {}
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './civil-issue.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) {
          list[i].navigate(url);
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data || event.data.type !== 'EMPUSH_SHOW') return;
  event.waitUntil(self.registration.showNotification(event.data.title || 'Empire EGS', {
    body: event.data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: event.data.url || './civil-issue.html' },
    tag: 'empire-job-local',
    renotify: true
  }));
});

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
