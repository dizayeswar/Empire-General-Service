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
    if (window.navigator.standalone === true) return true;
    if (!window.matchMedia) return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches;
  }

  function setWorkerPushStatus(text) {
    var el = document.getElementById('workerPushStatus');
    if (el && text) el.textContent = text;
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

  function pingScriptVersion() {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      var timer = setTimeout(function () {
        try { xhr.abort(); } catch (e) {}
        resolve(null);
      }, 12000);
      xhr.open('GET', GOOGLE_SCRIPT_URL, true);
      xhr.onload = function () {
        clearTimeout(timer);
        try { resolve(JSON.parse(xhr.responseText || '{}')); }
        catch (e) { resolve(null); }
      };
      xhr.onerror = function () {
        clearTimeout(timer);
        resolve(null);
      };
      xhr.send();
    });
  }

  function postToScript(body, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    var url = GOOGLE_SCRIPT_URL;
    var payload = JSON.stringify(body);
    var request = new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.onload = function () {
        try {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } catch (e) {
          reject(new Error('Invalid server response — redeploy Apps Script'));
        }
      };
      xhr.onerror = function () {
        reject(new Error('Network error reaching Google server'));
      };
      xhr.send(payload);
    });
    return withTimeout(request, timeoutMs, 'Server save');
  }

  function apiUsername() {
    if (typeof empireGetUser === 'function') return String(empireGetUser() || '').trim().toLowerCase();
    return '';
  }

  function callBackend(body, timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    if (typeof fetchJSONRetry === 'function') {
      return fetchJSONRetry(body, 1, timeoutMs);
    }
    return postToScript(body, timeoutMs);
  }

  function saveFcmToken(fcmToken) {
    if (!fcmToken || !window.GOOGLE_SCRIPT_URL || !window.ISSUE_CFG || !ISSUE_CFG.actions) {
      return Promise.resolve(false);
    }
    var act = ISSUE_CFG.actions.savePushToken;
    if (!act) return Promise.resolve(false);
    var session = authSessionToken();
    var username = apiUsername();
    if (!session) {
      setWorkerPushStatus('Not logged in — log out and sign in again.');
      return Promise.resolve(false);
    }
    if (!username) {
      setWorkerPushStatus('No username — log out and sign in again.');
      return Promise.resolve(false);
    }
    setWorkerPushStatus('Saving token to server…');
    return callBackend({
      action: act,
      fcmToken: fcmToken,
      platform: 'web-fcm',
      token: session,
      username: username
    }, 30000)
      .then(function (d) {
        if (d && (d.ok || d.success)) {
          setWorkerPushStatus('Alerts enabled. Tap Send test, then lock your phone.');
          setWorkerPushBanner('', false);
          return true;
        }
        if (d && d.error === 'session_expired') {
          setWorkerPushStatus('Session expired — log out, log in, Enable alerts again.');
          return false;
        }
        if (d && d.error === 'Unknown action') {
          setWorkerPushStatus('Backend old — paste Code.gs + Deploy New version (need push14).');
          return false;
        }
        var err = 'Save failed: ' + ((d && (d.message || d.error)) || 'server error');
        setWorkerPushStatus(err);
        setWorkerPushBanner(err, false);
        return false;
      })
      .catch(function (e) {
        var err = 'Save failed: ' + ((e && e.message) || 'network error');
        setWorkerPushStatus(err);
        setWorkerPushBanner(err, false);
        return false;
      });
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error((label || 'Step') + ' timed out — close app, reopen from Home Screen'));
        }, ms);
      })
    ]);
  }

  function waitForServiceWorkerActive(reg, ms) {
    if (reg.active) return Promise.resolve(reg);
    return withTimeout(
      new Promise(function (resolve) {
        function check(worker) {
          if (!worker) return;
          if (worker.state === 'activated' || reg.active) {
            resolve(reg);
            return;
          }
          worker.addEventListener('statechange', function () {
            if (worker.state === 'activated' || reg.active) resolve(reg);
          });
        }
        check(reg.installing);
        check(reg.waiting);
        navigator.serviceWorker.ready.then(function () { resolve(reg); }).catch(function () { resolve(reg); });
      }),
      ms || 20000,
      'Service worker'
    );
  }

  function getServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no-sw'));
    setWorkerPushStatus('Registering background worker…');
    return withTimeout(
      navigator.serviceWorker.register(SW_URL, { scope: './', updateViaCache: 'none' }),
      15000,
      'Worker register'
    )
      .then(function (reg) {
        var waiting = reg.waiting;
        var installing = reg.installing;
        if (waiting) {
          try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
        if (installing) {
          try { installing.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
        setWorkerPushStatus('Activating background worker…');
        return waitForServiceWorkerActive(reg, 20000);
      });
  }

  function obtainFcmToken(forceRefresh) {
    if (!pushConfigured()) return Promise.reject(new Error('Firebase not configured'));
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      return Promise.reject(new Error('Firebase did not load'));
    }
    return getServiceWorkerRegistration()
      .then(function (reg) {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        var messaging = firebase.messaging();
        setWorkerPushStatus('Requesting push token from Firebase…');
        var tokenPromise = messaging.getToken({
          vapidKey: FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: reg
        });
        if (forceRefresh) {
          tokenPromise = messaging.deleteToken().catch(function () { return null; }).then(function () {
            return messaging.getToken({
              vapidKey: FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: reg
            });
          });
        }
        return withTimeout(tokenPromise, 25000, 'Firebase token');
      });
  }

  function registerFirebaseMessaging(forceRefresh) {
    if (!pushConfigured()) {
      setWorkerPushStatus('Firebase not configured on server.');
      return Promise.resolve(false);
    }
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      setWorkerPushStatus('Firebase did not load — pull down to refresh.');
      return Promise.resolve(false);
    }
    if (!isStandaloneApp()) {
      setWorkerPushStatus('Warning: open from Home Screen icon for lock-screen alerts.');
    }
    setWorkerPushStatus('Getting push token…');
    return obtainFcmToken(!!forceRefresh)
      .then(function (token) {
        if (!token) {
          setWorkerPushStatus('No push token — tap Enable alerts again or reinstall from Home Screen.');
          return false;
        }
        setWorkerPushStatus('Saving token to server…');
        return saveFcmToken(token);
      })
      .catch(function (err) {
        var msg = (err && err.message) ? err.message : 'unknown error';
        if (/permission|denied/i.test(msg)) {
          setWorkerPushStatus('Notification permission denied.');
        } else if (/not authorized|permission-blocked/i.test(msg)) {
          setWorkerPushStatus('Add dizayeswar.github.io to Firebase Authorized domains.');
        } else {
          setWorkerPushStatus('Push failed: ' + msg);
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
      setWorkerPushStatus('This browser does not support notifications.');
      return;
    }
    if (!isStandaloneApp()) {
      setWorkerPushStatus('Install to Home Screen first, then open from the icon.');
      return;
    }
    setWorkerPushStatus('Checking notification permission…');
    withTimeout(Notification.requestPermission(), 10000, 'Permission')
      .then(function (perm) {
        if (perm === 'granted') {
          return registerFirebaseMessaging(true).then(function (ok) {
            if (ok) startIssuePollFallback();
          });
        }
        if (perm === 'denied') {
          setWorkerPushStatus('Blocked — allow notifications in phone Settings → Lock Screen.');
          return;
        }
        setWorkerPushStatus('Tap Enable alerts and choose Allow.');
      })
      .catch(function (err) {
        setWorkerPushStatus('Push failed: ' + ((err && err.message) || 'permission error'));
      });
  };

  window.empirePushInitWorker = function () {
    if (!isWorkerView()) return;
    stopIssuePollFallback();
    var ver = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'unknown';
    var mode = isStandaloneApp() ? 'Installed app' : 'Browser tab — install to Home Screen';
    if (!('Notification' in window)) {
      setWorkerPushStatus('Notifications not supported here. v' + ver);
      return;
    }
    setWorkerPushStatus(mode + ' · v' + ver + ' · Tap Enable alerts');
    var perm = Notification.permission;
    if (perm === 'denied') {
      setWorkerPushStatus('Notifications off — enable in phone Settings. v' + ver);
    }
  };

  window.empirePushStopWorker = function () {
    stopIssuePollFallback();
    setWorkerPushBanner('');
  };

  window.empirePushTestAlert = function () {
    if (!window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.testPush) {
      setWorkerPushStatus('Test not available — update app (hard refresh).');
      return;
    }
    setWorkerPushStatus('Sending test… lock your phone now.');
    callBackend({ action: ISSUE_CFG.actions.testPush, token: authSessionToken(), username: apiUsername() }, 30000)
      .then(function (d) {
        if (d && (d.ok || d.success)) {
          setWorkerPushStatus('Server sent test — check lock screen in 10 sec.');
          return;
        }
        setWorkerPushStatus('Test failed: ' + ((d && (d.message || d.error)) || 'unknown'));
      })
      .catch(function () {
        setWorkerPushStatus('Test failed: no server — redeploy Apps Script?');
      });
  };

  window.empirePushDebug = function () {
    if (!window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.debugPush) {
      setWorkerPushStatus('Diagnose not available — update app + redeploy backend.');
      return;
    }
    setWorkerPushStatus('Running diagnose…');
    var localPart = 'Local:?';
    var savePart = 'Save:?';
    var localChain = (Notification.permission === 'granted' && pushConfigured())
      ? obtainFcmToken(false).then(function (t) {
          localPart = 'Local:' + (t ? 'yes' : 'NO');
          if (!t) return false;
          return saveFcmToken(t).then(function (ok) {
            savePart = 'Save:' + (ok ? 'OK' : 'FAIL');
            return ok;
          });
        }).catch(function (e) {
          localPart = 'Local:FAIL ' + ((e && e.message) || '');
          savePart = 'Save:FAIL';
          return false;
        })
      : Promise.resolve(false);

    localChain.then(function () {
      return callBackend({
        action: ISSUE_CFG.actions.debugPush,
        token: authSessionToken(),
        username: apiUsername()
      }, 30000)
        .then(function (d) {
          if (!d || d.ok === false) {
            setWorkerPushStatus('Diagnose failed: ' + ((d && (d.message || d.error)) || 'unknown'));
            return;
          }
          var msg = 'App:' + (isStandaloneApp() ? 'installed' : 'BROWSER') +
            ' · Perm:' + (Notification.permission || '?') +
            ' · ' + localPart +
            ' · ' + savePart +
            ' · Server:' + (d.hasToken ? 'yes' : 'NO') +
            ' · FCM:' + (d.fcmAuth ? 'OK' : 'FAIL') +
            ' · Send:' + (d.fcmSend || '?');
          setWorkerPushStatus(msg);
        });
    }).catch(function () {
      setWorkerPushStatus('Diagnose failed: server unreachable.');
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
