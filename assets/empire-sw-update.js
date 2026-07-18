/* Empire EGS — register service worker; purge caches only when build id changes */
(function () {
  var BUILD = '2026-07-18-worker-fix-v2';
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
      localStorage.setItem(STORAGE_KEY, BUILD);
      purgeEmpireCaches().then(function () {
        if ('serviceWorker' in navigator) {
          return navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          });
        }
      }).finally(function () {
        location.replace(location.pathname.split('?')[0] + '?v=' + encodeURIComponent(BUILD));
      });
      return;
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
