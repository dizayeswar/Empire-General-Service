/* Empire EGS — worker job-assignment push notifications (FCM + open-app fallback) */
(function () {
  var _knownJobIds = null;
  var _pollTimer = null;
  var WORKER_ISSUE_POLL_MS = 90000;

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
        var opts = {
          body: body || 'Open the app to view details.',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: 'empire-assign',
          renotify: true
        };
        var n = new Notification(title, opts);
        n.onclick = function () {
          window.focus();
          n.close();
        };
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
          setWorkerPushBanner('Job alerts enabled. <button type="button" class="worker-loc-enable-btn" onclick="empirePushTestAlert()">Send test alert</button>', false);
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
    return navigator.serviceWorker.register('./service-worker.js').then(function () {
      return navigator.serviceWorker.ready;
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
    return getServiceWorkerRegistration()
      .then(function (reg) {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        var messaging = firebase.messaging();
        return messaging.getToken({
          vapidKey: FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: reg
        });
      })
      .then(function (token) {
        if (!token) {
          setWorkerPushBanner('Could not get push token. Reinstall the app and try again.', false);
          return false;
        }
        return saveFcmToken(token);
      })
      .catch(function (err) {
        var msg = (err && err.message) ? err.message : 'unknown error';
        if (/permission|denied/i.test(msg)) {
          setWorkerPushBanner('Notification permission denied.', false);
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
    Notification.requestPermission().then(function (perm) {
      if (perm === 'granted') {
        setWorkerPushBanner('');
        registerFirebaseMessaging().then(function () { startIssuePollFallback(); });
        if (typeof loadIssues === 'function') loadIssues(true);
        return;
      }
      if (perm === 'denied') {
        setWorkerPushBanner('Notifications blocked. Allow them in your phone settings for lock-screen alerts.', false);
        return;
      }
      setWorkerPushBanner('Turn on alerts to get a popup when a job is assigned to you.', true);
    });
  };

  window.empirePushInitWorker = function () {
    if (!isWorkerView()) return;
    stopIssuePollFallback();
    if (!('Notification' in window)) return;
    var perm = Notification.permission;
    if (perm === 'granted') {
      registerFirebaseMessaging().then(function () { startIssuePollFallback(); });
      return;
    }
    if (perm === 'denied') {
      setWorkerPushBanner('Notifications are off. Enable them in phone settings to get job alerts on your lock screen.', false);
      return;
    }
    setWorkerPushBanner('Get a popup when a new job is assigned — even when your phone is locked.', true);
  };

  window.empirePushStopWorker = function () {
    stopIssuePollFallback();
    setWorkerPushBanner('');
  };

  window.empirePushTestAlert = function () {
    if (!window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.testPush) return;
    setWorkerPushBanner('Sending test alert…', false);
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ISSUE_CFG.actions.testPush,
        token: authSessionToken()
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && (d.ok || d.success)) {
          setWorkerPushBanner('Test alert sent — check your lock screen.', false);
          return;
        }
        setWorkerPushBanner('Test failed: ' + ((d && (d.message || d.error)) || 'unknown error'), false);
      })
      .catch(function () {
        setWorkerPushBanner('Test failed: could not reach server.', false);
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
