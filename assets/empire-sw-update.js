/* Empire EGS — register service worker; purge caches only when build id changes */
(function () {
  var BUILD = '2026-07-19-android-stable-v3';
  var STORAGE_KEY = 'empire_build_id';

  function purgeEmpireCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf('empire-egs-') === 0; }).map(function (k) { return caches.delete(k); })
      );
    });
  }

  try {
    var prev = localStorage.getItem(STORAGE_KEY);
    if (prev && prev !== BUILD) {
      purgeEmpireCaches();
    }
    localStorage.setItem(STORAGE_KEY, BUILD);
  } catch (e) {}

  if (!('serviceWorker' in navigator)) return;
  if (window.__empireSwRegistering) return;
  window.__empireSwRegistering = true;

  navigator.serviceWorker.register('./firebase-messaging-sw.js?v=' + BUILD, {
    scope: './',
    updateViaCache: 'none'
  }).then(function (reg) {
    reg.update();
  }).catch(function () {});
})();
