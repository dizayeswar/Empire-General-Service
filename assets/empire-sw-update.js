/* Empire EGS — register service worker; drop a broken cached stylesheet immediately.
   BUILD follows config.js APP_VERSION so phones never mix old/new assets. */
(function () {
  var BUILD = (typeof APP_VERSION === 'string' && APP_VERSION) ? APP_VERSION : '2026-10-18-css-heal';
  var STORAGE_KEY = 'empire_build_id';

  function purgeEmpireCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    });
  }

  function empireCssBroken_() {
    var expects = false;
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].href || '').indexOf('empire.css') !== -1) expects = true;
    }
    if (!expects || !document.body) return false;
    try {
      if (getComputedStyle(document.body).marginTop !== '0px') return true;
    } catch (e) { return false; }
    var login = document.querySelector('.login-page.show');
    if (login) {
      try {
        var box = getComputedStyle(login);
        if (box.position !== 'fixed' || box.display !== 'flex') return true;
      } catch (e2) {}
      return false;
    }
    return false;
  }

  function healBrokenStyles_() {
    var mark = 'empire_css_heal_' + BUILD;
    try {
      if (sessionStorage.getItem(mark) === '1') return false;
      sessionStorage.setItem(mark, '1');
    } catch (e) {
      return false;
    }
    var finished = false;
    var done = function () {
      if (finished) return;
      finished = true;
      location.reload();
    };
    setTimeout(done, 3000);
    purgeEmpireCaches().then(function () {
      if (!('serviceWorker' in navigator)) return;
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      });
    }).then(done, done);
    return true;
  }

  if (empireCssBroken_() && healBrokenStyles_()) return;

  try {
    var prev = localStorage.getItem(STORAGE_KEY);
    if (prev && prev !== BUILD) purgeEmpireCaches();
    localStorage.setItem(STORAGE_KEY, BUILD);
  } catch (e) {}

  if (!('serviceWorker' in navigator)) return;
  if (window.__empireSwRegistering) return;
  window.__empireSwRegistering = true;

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (window.__empireSwReloading) return;
    window.__empireSwReloading = true;
    try {
      var mark = 'empire_sw_reload_' + BUILD;
      if (sessionStorage.getItem(mark) === '1') return;
      sessionStorage.setItem(mark, '1');
    } catch (e) {
      return;
    }
    location.reload();
  });

  navigator.serviceWorker.register('./firebase-messaging-sw.js?v=' + BUILD, {
    scope: './',
    updateViaCache: 'none'
  }).then(function (reg) {
    function kick(worker) {
      if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
    }
    function watch() {
      kick(reg.waiting);
      reg.update();
    }
    kick(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed') kick(w);
      });
    });
    watch();
    setInterval(watch, 45000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') watch();
    });
  }).catch(function () {});
})();
