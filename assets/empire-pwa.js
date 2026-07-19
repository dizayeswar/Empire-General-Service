/* Empire General Service — PWA install + service worker (Phase 5C) */

(function () {
  if (!('serviceWorker' in navigator)) return;

  var deferredPrompt = null;

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
  }

  function dismissInstallBanner() {
    var bar = document.getElementById('pwa-install-banner');
    if (bar) bar.remove();
    try { sessionStorage.setItem('pwa_install_dismissed', '1'); } catch (e) {}
  }

  function ensurePwaStyles() {
    if (document.getElementById('pwa-install-styles')) return;
    var style = document.createElement('style');
    style.id = 'pwa-install-styles';
    style.textContent =
      '#pwa-install-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:5000;}' +
      '#pwa-install-banner .pwa-install-inner{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;' +
        'background:var(--panel,#fff);color:var(--text,#222);border:2px solid var(--card-border,#e8d8e4);' +
        'border-radius:18px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.18);}' +
      '#pwa-install-banner .pwa-install-text{display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.4;}' +
      '#pwa-install-banner .pwa-install-text strong{font-size:15px;}' +
      '#pwa-install-banner .pwa-install-note{font-size:12px;color:var(--text-soft,#666);}' +
      '#pwa-install-banner .pwa-install-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;}' +
      '#pwa-install-banner .pwa-install-btn{background:#8d015d;color:#fff;border:none;border-radius:999px;' +
        'padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;}' +
      '#pwa-install-banner .pwa-install-help{background:transparent;color:#8d015d;border:2px solid #8d015d;border-radius:999px;' +
        'padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;}' +
      '#pwa-install-banner .pwa-install-dismiss{background:transparent;border:none;color:var(--text-soft,#666);' +
        'font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;}' +
      '#pwa-android-help{position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;}' +
      '#pwa-android-help .pwa-help-box{background:var(--panel,#fff);color:var(--text,#222);border-radius:18px;max-width:420px;width:100%;' +
        'padding:20px;border:2px solid var(--card-border,#e8d8e4);box-shadow:0 12px 40px rgba(0,0,0,.25);max-height:90vh;overflow:auto;}' +
      '#pwa-android-help h3{margin:0 0 10px;font-size:18px;}' +
      '#pwa-android-help ol{margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.55;}' +
      '#pwa-android-help li{margin-bottom:8px;}' +
      '#pwa-android-help .pwa-help-warn{background:#fff8e6;border:1px solid #e6c200;border-radius:12px;padding:10px 12px;' +
        'font-size:13px;line-height:1.45;margin-bottom:14px;}' +
      '#pwa-android-help .pwa-help-actions{display:flex;gap:10px;flex-wrap:wrap;}' +
      '#pwa-android-help .pwa-help-actions button{border:none;border-radius:999px;padding:12px 18px;font-weight:700;font-size:14px;cursor:pointer;}' +
      '#pwa-android-help .pwa-help-install{background:#8d015d;color:#fff;}' +
      '#pwa-android-help .pwa-help-close{background:var(--btn-bg,#f4f4f4);color:var(--text,#222);border:2px solid var(--card-border,#ddd);}';
    document.head.appendChild(style);
  }

  function closeAndroidHelp() {
    var el = document.getElementById('pwa-android-help');
    if (el) el.remove();
  }

  function runInstallPrompt() {
    if (!deferredPrompt) {
      showAndroidHelp(true);
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      dismissInstallBanner();
    });
  }

  function showAndroidHelp(fromInstallClick) {
    ensurePwaStyles();
    closeAndroidHelp();
    var wrap = document.createElement('div');
    wrap.id = 'pwa-android-help';
    wrap.onclick = function (e) { if (e.target === wrap) closeAndroidHelp(); };
    wrap.innerHTML =
      '<div class="pwa-help-box" role="dialog" aria-labelledby="pwaHelpTitle">' +
        '<h3 id="pwaHelpTitle">Install Empire EGS on Android</h3>' +
        '<div class="pwa-help-warn"><strong>If you see &ldquo;Unsafe app blocked&rdquo;</strong><br>' +
          'This is a Google safety screen for web apps. Tap <strong>Install anyway</strong> (small link above OK), then tap <strong>OK</strong>. The app is safe — it is your Empire dashboard.</div>' +
        '<ol>' +
          '<li>Use <strong>Google Chrome</strong> (latest version).</li>' +
          '<li>Tap <strong>Install</strong> on the banner, or Chrome menu <strong>&#8942;</strong> &rarr; <strong>Install app</strong> / <strong>Add to Home screen</strong>.</li>' +
          '<li>On the Play Protect screen, tap <strong>Install anyway</strong>, then <strong>OK</strong>.</li>' +
          '<li>Open <strong>Empire EGS</strong> from your home screen.</li>' +
        '</ol>' +
        '<div class="pwa-help-actions">' +
          (deferredPrompt ? '<button type="button" class="pwa-help-install" id="pwaHelpInstallBtn">Try install now</button>' : '') +
          '<button type="button" class="pwa-help-close" id="pwaHelpCloseBtn">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    var closeBtn = document.getElementById('pwaHelpCloseBtn');
    if (closeBtn) closeBtn.onclick = closeAndroidHelp;
    var installBtn = document.getElementById('pwaHelpInstallBtn');
    if (installBtn) installBtn.onclick = function () { closeAndroidHelp(); runInstallPrompt(); };
    if (fromInstallClick && !deferredPrompt) return;
  }

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    try { if (sessionStorage.getItem('pwa_install_dismissed') === '1') return; } catch (e) {}
    if (isStandalone()) return;

    ensurePwaStyles();

    var android = isAndroid();
    var canPrompt = deferredPrompt !== null;
    var note = android
      ? 'On Android: if Play Protect appears, tap Install anyway.'
      : 'Add to your home screen for quick access on site.';

    var bar = document.createElement('div');
    bar.id = 'pwa-install-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Install app');
    bar.innerHTML =
      '<div class="pwa-install-inner">' +
        '<div class="pwa-install-text">' +
          '<strong>Install Empire EGS</strong>' +
          '<span class="pwa-install-note">' + note + '</span>' +
        '</div>' +
        '<div class="pwa-install-actions">' +
          (canPrompt ? '<button type="button" class="pwa-install-btn" id="pwaInstallBtn">Install</button>' : '') +
          (android ? '<button type="button" class="pwa-install-help" id="pwaInstallHelpBtn">How to install</button>' : '') +
          '<button type="button" class="pwa-install-dismiss" id="pwaInstallDismiss" aria-label="Dismiss">&times;</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(bar);

    document.getElementById('pwaInstallDismiss').onclick = dismissInstallBanner;
    var helpBtn = document.getElementById('pwaInstallHelpBtn');
    if (helpBtn) helpBtn.onclick = function () { showAndroidHelp(false); };
    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.onclick = function () { runInstallPrompt(); };
    }
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    dismissInstallBanner();
    closeAndroidHelp();
  });

  window.addEventListener('load', function () {
    if (!isAndroid() || isStandalone()) return;
    setTimeout(function () {
      try { if (sessionStorage.getItem('pwa_install_dismissed') === '1') return; } catch (e) {}
      if (!document.getElementById('pwa-install-banner')) showInstallBanner();
    }, 1500);
  });
})();
