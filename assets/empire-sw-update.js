/* Empire EGS — force service worker + asset cache refresh on version bump */
(function () {
  var BUILD = '2026-07-15-push16';
  var STORAGE_KEY = 'empire_build_id';

  function purgeEmpireCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf('empire-egs-') === 0; }).map(function (k) { return caches.delete(k); })
      );
    });
  }

  function reloadOnce() {
    try {
      if (sessionStorage.getItem('empire_sw_reload') === BUILD) return;
      sessionStorage.setItem('empire_sw_reload', BUILD);
    } catch (e) {}
    location.reload();
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
      }).finally(reloadOnce);
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
    if (reg.waiting) {
      try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
    }
    reg.addEventListener('updatefound', function () {
      var worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
      });
    });
  }).catch(function () {});

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
})();
