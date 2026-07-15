/* Empire EGS — worker job-assignment push (one-time setup, hidden from daily UI) */
(function () {
  var API_TIMEOUT_MS = 90000;
  var _knownJobIds = null;
  var _pollTimer = null;
  var _lastSaveError = '';
  var SW_URL = './firebase-messaging-sw.js';

  function pushConfigured() {
    return typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey &&
      typeof FIREBASE_VAPID_KEY !== 'undefined' && FIREBASE_VAPID_KEY;
  }

  function sessionToken() {
    if (typeof issueToken === 'function') return issueToken() || '';
    if (typeof empireGetToken === 'function') return empireGetToken() || '';
    return '';
  }

  function username() {
    if (typeof empireGetUser === 'function') return String(empireGetUser() || '').trim().toLowerCase();
    return '';
  }

  function isWorkerView() {
    return typeof isCivilWorker === 'function' && isCivilWorker();
  }

  function isStandaloneApp() {
    if (window.navigator.standalone === true) return true;
    if (!window.matchMedia) return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches;
  }

  function pushSetupKey() {
    return 'empire_push_ok_' + username();
  }

  function isPushSetupDone() {
    try { return localStorage.getItem(pushSetupKey()) === '1'; } catch (e) { return false; }
  }

  function markPushSetupDone() {
    try { localStorage.setItem(pushSetupKey(), '1'); } catch (e) {}
  }

  function hidePushUi() {
    var bar = document.getElementById('workerPushBar');
    if (bar) {
      bar.style.display = 'none';
      bar.setAttribute('aria-hidden', 'true');
    }
    setBanner('', false);
  }

  function setBanner(text, showBtn) {
    var el = document.getElementById('workerPushBanner');
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'block';
    var html = '<span class="worker-loc-banner-text">' + text + '</span>';
    if (showBtn) {
      html += ' <button type="button" class="worker-loc-enable-btn" onclick="empirePushEnableAlerts()">Allow notifications</button>';
    }
    el.innerHTML = html;
  }

  function showPushSetupPrompt() {
    if (isPushSetupDone()) return;
    setBanner('Get notified when a new job is assigned to you.', true);
  }

  function api(body) {
    if (typeof fetchJSONRetry !== 'function') {
      return Promise.reject(new Error('API helper missing'));
    }
    return fetchJSONRetry(body, 2, API_TIMEOUT_MS);
  }

  function pauseBackground() {
    if (typeof empirePauseWorkerBackgroundRequests === 'function') {
      empirePauseWorkerBackgroundRequests(60000);
    }
    stopIssuePollFallback();
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error((label || 'Step') + ' timed out'));
        }, ms);
      })
    ]);
  }

  function getSwRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('Service worker not supported'));
    return withTimeout(
      navigator.serviceWorker.register(SW_URL, { scope: './', updateViaCache: 'none' }),
      20000,
      'Service worker'
    ).then(function (reg) {
      if (reg.waiting) try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
      if (reg.installing) try { reg.installing.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
      return withTimeout(navigator.serviceWorker.ready, 20000, 'Service worker');
    });
  }

  function getFcmToken() {
    if (!pushConfigured()) return Promise.reject(new Error('Firebase not configured'));
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      return Promise.reject(new Error('Firebase did not load'));
    }
    return getSwRegistration().then(function (reg) {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      return withTimeout(
        firebase.messaging().getToken({ vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg }),
        25000,
        'Firebase token'
      );
    });
  }

  function saveTokenToServer(fcmToken, silent) {
    if (!fcmToken || !window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.savePushToken) {
      return Promise.resolve(false);
    }
    var token = sessionToken();
    if (!token) return Promise.resolve(false);
    pauseBackground();
    if (!silent) setBanner('Setting up notifications…', false);
    return api({
      action: ISSUE_CFG.actions.savePushToken,
      token: token,
      username: username(),
      fcmToken: fcmToken,
      platform: 'web-fcm'
    }).then(function (d) {
      if (d && (d.ok || d.success)) {
        _lastSaveError = '';
        markPushSetupDone();
        hidePushUi();
        startIssuePollFallback();
        return true;
      }
      _lastSaveError = String((d && (d.message || d.error)) || 'server error');
      if (!silent) {
        setBanner('Could not enable alerts. Tap to try again.', true);
      }
      return false;
    }).catch(function (e) {
      _lastSaveError = String((e && e.message) || 'network error');
      if (!silent) setBanner('Could not enable alerts. Tap to try again.', true);
      return false;
    });
  }

  function finishSetupSilently() {
    if (!pushConfigured() || Notification.permission !== 'granted') return;
    getFcmToken()
      .then(function (t) { return t ? saveTokenToServer(t, true) : false; })
      .catch(function () {});
  }

  function notifyViaServiceWorker(title, body) {
    if (!('serviceWorker' in navigator)) return;
    var send = function (reg) {
      var target = reg.active || reg.waiting || reg.installing;
      if (!target) return;
      target.postMessage({
        type: 'EMPUSH_SHOW',
        title: title,
        body: body,
        url: './civil-issue.html'
      });
    };
    if (navigator.serviceWorker.controller) {
      send({ active: navigator.serviceWorker.controller });
      return;
    }
    navigator.serviceWorker.ready.then(send).catch(function () {});
  }

  function showAssignNotification(count, body) {
    var title = count === 1 ? 'New job assigned' : count + ' new jobs assigned';
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        var n = new Notification(title, {
          body: body || 'Open the app to view details.',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: 'empire-assign',
          renotify: true
        });
        n.onclick = function () { window.focus(); n.close(); };
      } catch (e) {}
      notifyViaServiceWorker(title, body);
    }
  }

  function startIssuePollFallback() {
    if (_pollTimer || !isWorkerView()) return;
    _pollTimer = setInterval(function () {
      if (typeof loadIssues === 'function') loadIssues(true);
    }, 90000);
  }

  function stopIssuePollFallback() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
    _knownJobIds = null;
  }

  window.empirePushOnIssuesLoaded = function (issues) {
    if (!isWorkerView()) return;
    var open = (issues || []).filter(function (r) { return r && r.status !== 'fixed'; });
    var idSet = {};
    open.forEach(function (r) { idSet[r.id] = true; });
    if (_knownJobIds === null) {
      _knownJobIds = idSet;
      return;
    }
    var fresh = open.filter(function (r) { return !_knownJobIds[r.id]; });
    _knownJobIds = idSet;
    if (!fresh.length || Notification.permission !== 'granted') return;
    var body;
    if (fresh.length === 1) {
      var r0 = fresh[0];
      var ref = typeof issueRef === 'function' ? '#' + issueRef(r0.num) + ' ' : '';
      body = ref + (r0.issueType || 'Job') + (r0.building ? ' — ' + r0.building : '');
    } else {
      body = fresh.length + ' new jobs — open the app';
    }
    showAssignNotification(fresh.length, body);
  };

  window.empirePushEnableAlerts = function () {
    if (!('Notification' in window)) return;
    if (!isStandaloneApp()) return;
    pauseBackground();
    setBanner('Setting up notifications…', false);
    withTimeout(Notification.requestPermission(), 15000, 'Permission')
      .then(function (perm) {
        if (perm !== 'granted') {
          hidePushUi();
          return;
        }
        return getFcmToken().then(function (token) {
          if (!token) {
            setBanner('Could not enable alerts. Tap to try again.', true);
            return;
          }
          return saveTokenToServer(token, false);
        });
      })
      .catch(function () {
        setBanner('Could not enable alerts. Tap to try again.', true);
      });
  };

  window.empirePushInitWorker = function () {
    if (!isWorkerView()) return;
    stopIssuePollFallback();
    hidePushUi();
    if (!pushConfigured() || !('Notification' in window)) return;

    if (isPushSetupDone()) {
      if (Notification.permission === 'granted') {
        startIssuePollFallback();
        finishSetupSilently();
      }
      return;
    }

    if (Notification.permission === 'granted') {
      finishSetupSilently();
      return;
    }

    if (!isStandaloneApp() || Notification.permission !== 'default') return;
    showPushSetupPrompt();
  };

  window.empirePushStopWorker = function () {
    stopIssuePollFallback();
    hidePushUi();
  };

  window.empirePushTrySaveAfterLogin = function () {
    if (!isWorkerView() || !pushConfigured()) return;
    if (isPushSetupDone() && Notification.permission === 'granted') {
      finishSetupSilently();
      return;
    }
    if (Notification.permission === 'granted') {
      finishSetupSilently();
    }
  };

  if (typeof firebase !== 'undefined' && firebase.messaging && pushConfigured()) {
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      firebase.messaging().onMessage(function (payload) {
        var n = payload && payload.notification;
        if (n) showAssignNotification(1, n.body || '');
      });
    } catch (e) {}
  }
})();
