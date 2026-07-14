/* Empire EGS — worker job-assignment push notifications (FCM + open-app fallback) */
(function () {
  var _knownJobIds = null;
  var _pollTimer = null;
  var WORKER_ISSUE_POLL_MS = 90000;
  var SW_URL = './firebase-messaging-sw.js';

  function pushConfigured() {
    return typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey &&
      typeof FIREBASE_VAPID_KEY !== 'undefined' && FIREBASE_VAPID_KEY;
  }

  function authSessionToken() {
    if (typeof issueToken === 'function') return issueToken() || '';
    if (typeof empireGetToken === 'function') return empireGetToken() || '';
    return '';
  }

  function isWorkerView() {
    return typeof isCivilWorker === 'function' && isCivilWorker();
  }

  function isStandaloneApp() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function setWorkerPushBanner(text, showBtn) {
    var el = document.getElementById('workerPushBanner');
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'block';
    var h = '<span class="worker-loc-banner-text">' + text + '</span>';
    if (showBtn) {
      h += ' <button type="button" class="worker-loc-enable-btn" onclick="empirePushEnableAlerts()">Enable alerts</button>';
    }
    el.innerHTML = h;
  }

  function notifyViaServiceWorker(title, body, url) {
    if (!('serviceWorker' in navigator)) return;
    var send = function (reg) {
      var target = reg.active || reg.waiting || reg.installing;
      if (!target) return;
      target.postMessage({
        type: 'EMPUSH_SHOW',
        title: title,
        body: body,
        url: url || './civil-issue.html'
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

  function saveFcmToken(fcmToken) {
    if (!fcmToken || !window.GOOGLE_SCRIPT_URL || !window.ISSUE_CFG || !ISSUE_CFG.actions) return Promise.resolve(false);
    var act = ISSUE_CFG.actions.savePushToken;
    if (!act) return Promise.resolve(false);
    return fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: act,
        fcmToken: fcmToken,
        platform: 'web-fcm',
        token: authSessionToken()
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && (d.ok || d.success)) {
          var msg = 'Job alerts enabled (installed app). ';
          msg += '<button type="button" class="worker-loc-enable-btn" onclick="empirePushTestAlert()">Send test</button> ';
          msg += '<button type="button" class="worker-loc-enable-btn" onclick="empirePushDebug()">Diagnose</button>';
          setWorkerPushBanner(msg, false);
          return true;
        }
        setWorkerPushBanner('Could not register alerts: ' + ((d && (d.message || d.error)) || 'server error'), false);
        return false;
      })
      .catch(function () {
        setWorkerPushBanner('Could not reach server to register alerts.', false);
        return false;
      });
  }

  function getServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no-sw'));
    return navigator.serviceWorker.register(SW_URL, { scope: './', updateViaCache: 'none' })
      .then(function (reg) {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        if (reg.update) return reg.update().then(function () { return reg; });
        return reg;
      })
      .then(function (reg) {
        return navigator.serviceWorker.ready.then(function () { return reg; });
      });
  }

  function registerFirebaseMessaging() {
    if (!pushConfigured()) {
      setWorkerPushBanner('Firebase is not configured on this site yet.', false);
      return Promise.resolve(false);
    }
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      setWorkerPushBanner('Firebase failed to load. Hard refresh and try again.', false);
      return Promise.resolve(false);
    }
    if (!isStandaloneApp()) {
      setWorkerPushBanner('Lock-screen alerts require the installed app. Add to Home Screen first, then open from the icon.', true);
      return Promise.resolve(false);
    }
    return getServiceWorkerRegistration()
      .then(function (reg) {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        var messaging = firebase.messaging();
        return messaging.deleteToken().catch(function () { return null; }).then(function () {
          return messaging.getToken({
            vapidKey: FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: reg
          });
        });
      })
      .then(function (token) {
        if (!token) {
          setWorkerPushBanner('Could not get push token. Delete the app shortcut, reinstall, and try again.', false);
          return false;
        }
        return saveFcmToken(token);
      })
      .catch(function (err) {
        var msg = (err && err.message) ? err.message : 'unknown error';
        if (/permission|denied/i.test(msg)) {
          setWorkerPushBanner('Notification permission denied.', false);
        } else if (/not authorized|permission-blocked/i.test(msg)) {
          setWorkerPushBanner('Domain not authorized in Firebase. Add dizayeswar.github.io to Firebase authorized domains.', false);
        } else {
          setWorkerPushBanner('Push setup failed: ' + msg, false);
        }
        return false;
      });
  }

  function startIssuePollFallback() {
    if (_pollTimer || !isWorkerView()) return;
    _pollTimer = setInterval(function () {
      if (typeof loadIssues === 'function') loadIssues(false);
    }, WORKER_ISSUE_POLL_MS);
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
    if (!fresh.length) return;
    if (Notification.permission !== 'granted') return;
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
    if (!('Notification' in window)) {
      setWorkerPushBanner('This browser does not support notifications.', false);
      return;
    }
    if (!isStandaloneApp()) {
      setWorkerPushBanner('Add the app to your Home Screen first, then open it from the icon — required for lock-screen alerts.', true);
      return;
    }
    Notification.requestPermission().then(function (perm) {
      if (perm === 'granted') {
        setWorkerPushBanner('Setting up alerts…', false);
        registerFirebaseMessaging().then(function () { startIssuePollFallback(); });
        if (typeof loadIssues === 'function') loadIssues(true);
        return;
      }
      if (perm === 'denied') {
        setWorkerPushBanner('Notifications blocked. In phone Settings, allow notifications for this app on Lock Screen.', false);
        return;
      }
      setWorkerPushBanner('Turn on alerts to get a popup when a job is assigned to you.', true);
    });
  };

  window.empirePushInitWorker = function () {
    if (!isWorkerView()) return;
    stopIssuePollFallback();
    if (!('Notification' in window)) return;
    if (!isStandaloneApp()) {
      setWorkerPushBanner('Install this app to Home Screen for lock-screen job alerts.', true);
      return;
    }
    var perm = Notification.permission;
    if (perm === 'granted') {
      registerFirebaseMessaging().then(function () { startIssuePollFallback(); });
      return;
    }
    if (perm === 'denied') {
      setWorkerPushBanner('Notifications are off. Enable Lock Screen alerts in phone Settings.', false);
      return;
    }
    setWorkerPushBanner('Get a popup when assigned — even when your phone is locked.', true);
  };

  window.empirePushStopWorker = function () {
    stopIssuePollFallback();
    setWorkerPushBanner('');
  };

  window.empirePushTestAlert = function () {
    if (!window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.testPush) return;
    setWorkerPushBanner('Sending test alert… Lock your phone now.', false);
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ISSUE_CFG.actions.testPush, token: authSessionToken() })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && (d.ok || d.success)) {
          setWorkerPushBanner('Server sent test alert. Check lock screen within 10 seconds.', false);
          return;
        }
        setWorkerPushBanner('Test failed: ' + ((d && (d.message || d.error)) || 'unknown error'), false);
      })
      .catch(function () {
        setWorkerPushBanner('Test failed: could not reach server.', false);
      });
  };

  window.empirePushDebug = function () {
    if (!window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.debugPush) return;
    setWorkerPushBanner('Running diagnostics…', false);
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ISSUE_CFG.actions.debugPush, token: authSessionToken() })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.ok === false) {
          setWorkerPushBanner('Diagnose failed: ' + ((d && (d.message || d.error)) || 'unknown'), false);
          return;
        }
        var lines = [];
        lines.push('Installed app: ' + (isStandaloneApp() ? 'yes' : 'NO — install first'));
        lines.push('Notification permission: ' + (Notification.permission || 'unknown'));
        lines.push('Push token saved: ' + (d.hasToken ? 'yes' : 'NO'));
        lines.push('FCM server auth: ' + (d.fcmAuth ? 'OK' : 'FAILED'));
        if (d.fcmSend) lines.push('Last FCM send: ' + d.fcmSend);
        setWorkerPushBanner(lines.join(' · '), false);
      })
      .catch(function () {
        setWorkerPushBanner('Diagnose failed: could not reach server.', false);
      });
  };

  if (typeof firebase !== 'undefined' && firebase.messaging && pushConfigured()) {
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      firebase.messaging().onMessage(function (payload) {
        var n = payload && payload.notification;
        if (!n) return;
        showAssignNotification(1, n.body || '');
      });
    } catch (e) {}
  }
})();
