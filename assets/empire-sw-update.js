/* Empire EGS — register service worker; purge caches only when build id changes */
(function () {
  var BUILD = '2026-07-19-android-stable-v2';
  var STORAGE_KEY = 'empire_build_id';
  var RELOAD_GUARD = 'empire_build_reload_' + BUILD;

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
      localStorage.setItem(STORAGE_KEY, BUILD);
      var alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD) === '1'; } catch (e) {}
      if (!alreadyReloaded) {
        try { sessionStorage.setItem(RELOAD_GUARD, '1'); } catch (e2) {}
        purgeEmpireCaches().finally(function () {
          var base = location.pathname.split('?')[0];
          location.replace(base + '?v=' + encodeURIComponent(BUILD));
        });
        return;
      }
    }
    localStorage.setItem(STORAGE_KEY, BUILD);
  } catch (e) {}

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./firebase-messaging-sw.js?v=' + BUILD, {
    scope: './',
    updateViaCache: 'none'
  }).then(function (reg) {
    reg.update();
  }).catch(function () {});
})();
