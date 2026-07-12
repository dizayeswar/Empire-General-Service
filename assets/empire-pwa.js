/* Empire General Service — PWA install + service worker (Phase 5C) */

(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js').catch(function () {});
  });

  var deferredPrompt = null;

  function dismissInstallBanner() {
    var bar = document.getElementById('pwa-install-banner');
    if (bar) bar.remove();
    try { sessionStorage.setItem('pwa_install_dismissed', '1'); } catch (e) {}
  }

  function showInstallBanner() {
    if (deferredPrompt === null) return;
    if (document.getElementById('pwa-install-banner')) return;
    try { if (sessionStorage.getItem('pwa_install_dismissed') === '1') return; } catch (e) {}
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;

    var bar = document.createElement('div');
    bar.id = 'pwa-install-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Install app');
    bar.innerHTML =
      '<div class="pwa-install-inner">' +
        '<div class="pwa-install-text">' +
          '<strong>Install Empire EGS</strong>' +
          '<span>Add to your home screen for quick access on site.</span>' +
        '</div>' +
        '<div class="pwa-install-actions">' +
          '<button type="button" class="pwa-install-btn" id="pwaInstallBtn">Install</button>' +
          '<button type="button" class="pwa-install-dismiss" id="pwaInstallDismiss" aria-label="Dismiss">×</button>' +
        '</div>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent =
      '#pwa-install-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:5000;}' +
      '#pwa-install-banner .pwa-install-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;' +
        'background:var(--panel,#fff);color:var(--text,#222);border:2px solid var(--card-border,#e8d8e4);' +
        'border-radius:18px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.18);}' +
      '#pwa-install-banner .pwa-install-text{display:flex;flex-direction:column;gap:2px;font-size:13px;}' +
      '#pwa-install-banner .pwa-install-text strong{font-size:15px;}' +
      '#pwa-install-banner .pwa-install-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}' +
      '#pwa-install-banner .pwa-install-btn{background:#8d015d;color:#fff;border:none;border-radius:999px;' +
        'padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;}' +
      '#pwa-install-banner .pwa-install-dismiss{background:transparent;border:none;color:var(--text-soft,#666);' +
        'font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;}';
    document.head.appendChild(style);
    document.body.appendChild(bar);

    document.getElementById('pwaInstallDismiss').onclick = dismissInstallBanner;
    document.getElementById('pwaInstallBtn').onclick = function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        dismissInstallBanner();
      });
    };
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    dismissInstallBanner();
  });
})();
