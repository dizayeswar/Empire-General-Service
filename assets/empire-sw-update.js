/* Empire EGS — register service worker; purge caches only when build id changes.
   BUILD follows config.js APP_VERSION so phones never mix old/new assets. */
(function () {
  var BUILD = (typeof APP_VERSION === 'string' && APP_VERSION) ? APP_VERSION : '2026-08-19-wh-layout-restore';
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
