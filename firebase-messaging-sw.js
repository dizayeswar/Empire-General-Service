/* Empire EGS — service worker (cache + Firebase background push) */
var CACHE_VERSION = '2026-07-18-field-reports-v1';
var CACHE_NAME = 'empire-egs-' + CACHE_VERSION;
var NOTIFY_ICON = 'https://dizayeswar.github.io/Empire-General-Service/icons/icon-192.png';
var NOTIFY_BASE = 'https://dizayeswar.github.io/Empire-General-Service/civil-issue.html';

function notifyUrlForData_(data) {
  var issueId = data && (data.issueId || data.jobId);
  if (issueId) return NOTIFY_BASE + '?job=' + encodeURIComponent(String(issueId));
  return NOTIFY_BASE;
}

importScripts('./assets/firebase-sw-config.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

if (typeof FIREBASE_SW_CONFIG !== 'undefined' && FIREBASE_SW_CONFIG && FIREBASE_SW_CONFIG.apiKey) {
  firebase.initializeApp(FIREBASE_SW_CONFIG);
  firebase.messaging().onBackgroundMessage(function (payload) {
    var data = payload && payload.data;
    var title = (data && data.title) || 'New job assigned';
    var body = (data && data.body) || '';
    var issueId = (data && (data.issueId || data.jobId)) || '';
    var url = notifyUrlForData_(data || {});
    return self.registration.showNotification(title, {
      body: body,
      icon: NOTIFY_ICON,
      badge: NOTIFY_ICON,
      data: { url: url, issueId: issueId },
      tag: 'empire-job',
      renotify: true
    });
  });
}

var PRECACHE = [
  './',
  './index.html',
  './civil-issue.html',
  './electric-issue.html',
  './config.js',
  './firebase-messaging-sw.js',
  './service-worker.js',
  './assets/firebase-sw-config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './assets/empire-sw-update.js',
  './assets/empire-push.js',
  './assets/issue-tracker.js',
  './assets/issue-configs.js'
];

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var nd = event.notification.data || {};
  var url = nd.url || NOTIFY_BASE;
  var issueId = nd.issueId || '';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) {
          try {
            list[i].postMessage({ type: 'EMPUSH_OPEN_JOB', issueId: issueId, url: url });
          } catch (e) {}
          if ('navigate' in list[i]) {
            return list[i].navigate(url).then(function () { return list[i].focus(); });
          }
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data.type !== 'EMPUSH_SHOW') return;
  event.waitUntil(self.registration.showNotification(event.data.title || 'Empire EGS', {
    body: event.data.body || '',
    icon: NOTIFY_ICON,
    badge: NOTIFY_ICON,
    data: {
      url: event.data.url || NOTIFY_BASE,
      issueId: event.data.issueId || ''
    },
    tag: 'empire-job',
    renotify: true
  }));
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
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

function isLiveConfigAsset(pathname) {
  return /config\.js$/i.test(pathname) ||
    /empire-push\.js$/i.test(pathname) ||
    /empire-sw-update\.js$/i.test(pathname) ||
    /empire-auth\.js$/i.test(pathname) ||
    /issue-tracker\.js$/i.test(pathname) ||
    /issue-configs\.js$/i.test(pathname);
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (isLiveConfigAsset(url.pathname)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
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
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      });
      return cached || network;
    })
  );
});
