/* Empire EGS — worker push notifications (clean rewrite, push-v2) */
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

  function setStatus(text) {
    var el = document.getElementById('workerPushStatus');
    if (el && text) el.textContent = text;
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
      html += ' <button type="button" class="worker-loc-enable-btn" onclick="empirePushEnableAlerts()">Enable alerts</button>';
    }
    el.innerHTML = html;
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

  function saveTokenToServer(fcmToken) {
    if (!fcmToken || !window.ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.savePushToken) {
      return Promise.resolve(false);
    }
    var token = sessionToken();
    if (!token) {
      setStatus('Not logged in — log out and sign in again.');
      return Promise.resolve(false);
    }
    pauseBackground();
    var elapsed = 0;
    var ticker = setInterval(function () {
      elapsed += 3;
      setStatus('Saving to server… (' + elapsed + 's, can take up to 90s)');
    }, 3000);
    setStatus('Saving to server…');
    return api({
      action: ISSUE_CFG.actions.savePushToken,
      token: token,
      username: username(),
      fcmToken: fcmToken,
      platform: 'web-fcm'
    }).then(function (d) {
      if (d && (d.ok || d.success)) {
        _lastSaveError = '';
        setStatus('Alerts enabled — tap Send test, then lock your phone.');
        setBanner('', false);
        return true;
      }
      _lastSaveError = String((d && (d.message || d.error)) || 'server error');
      if (d && d.error === 'Invalid token') {
        setStatus('Session expired — log out, log in, then Enable alerts.');
      } else if (d && d.error === 'Unknown action') {
        setStatus('Backend old — redeploy Apps Script (version push-v2).');
      } else {
        setStatus('Save failed: ' + _lastSaveError);
      }
      return false;
    }).catch(function (e) {
      _lastSaveError = String((e && e.message) || 'network error');
      setStatus('Save failed: ' + _lastSaveError);
      return false;
    }).finally(function () {
      clearInterval(ticker);
    });
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
    if (!('Notification' in window)) {
      setStatus('Notifications not supported in this browser.');
      return;
    }
    if (!isStandaloneApp()) {
      setStatus('Install to Home Screen first, then open from the icon.');
      return;
    }
    pauseBackground();
    setStatus('Requesting permission…');
    withTimeout(Notification.requestPermission(), 15000, 'Permission')
      .then(function (perm) {
        if (perm !== 'granted') {
          setStatus(perm === 'denied' ? 'Blocked — allow notifications in phone Settings.' : 'Tap Allow when prompted.');
          return;
        }
        setStatus('Getting push token…');
        return getFcmToken().then(function (token) {
          if (!token) {
            setStatus('No push token — try again or reinstall from Home Screen.');
            return;
          }
          return saveTokenToServer(token).then(function (ok) {
            if (ok) startIssuePollFallback();
          });
        });
      })
      .catch(function (e) {
        setStatus('Failed: ' + ((e && e.message) || 'unknown error'));
      });
  };

  window.empirePushInitWorker = function () {
    if (!isWorkerView()) return;
    stopIssuePollFallback();
    var ver = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '?';
    var mode = isStandaloneApp() ? 'Installed app' : 'Browser — install to Home Screen';
    setStatus(mode + ' · v' + ver + ' · Tap Enable alerts');
    if (Notification.permission === 'granted') startIssuePollFallback();
  };

  window.empirePushStopWorker = function () {
    stopIssuePollFallback();
    setBanner('');
  };

  window.empirePushTestAlert = function () {
    if (!ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.testPush) {
      setStatus('Update app — test not available.');
      return;
    }
    pauseBackground();
    setStatus('Sending test… lock your phone now.');
    api({ action: ISSUE_CFG.actions.testPush, token: sessionToken(), username: username() })
      .then(function (d) {
        if (d && (d.ok || d.success)) {
          setStatus('Test sent — check lock screen in ~10 sec.');
          return;
        }
        setStatus('Test failed: ' + ((d && (d.message || d.error)) || 'unknown'));
      })
      .catch(function (e) {
        setStatus('Test failed: ' + ((e && e.message) || 'network'));
      });
  };

  window.empirePushDebug = function () {
    if (!ISSUE_CFG || !ISSUE_CFG.actions || !ISSUE_CFG.actions.debugPush) {
      setStatus('Update app + redeploy backend (push-v2).');
      return;
    }
    pauseBackground();
    setStatus('Diagnose running…');
    var localPart = 'Local:?';
    var savePart = 'Save:?';
    var chain = Promise.resolve();
    if (Notification.permission === 'granted' && pushConfigured()) {
      chain = getFcmToken()
        .then(function (t) {
          localPart = 'Local:' + (t ? 'yes' : 'NO');
          if (!t) return false;
          return saveTokenToServer(t).then(function (ok) {
            savePart = 'Save:' + (ok ? 'OK' : ('FAIL ' + (_lastSaveError || '?')));
            return ok;
          });
        })
        .catch(function (e) {
          localPart = 'Local:FAIL';
          savePart = 'Save:FAIL ' + ((e && e.message) || '');
          return false;
        });
    }
    chain.then(function () {
      return api({ action: ISSUE_CFG.actions.debugPush, token: sessionToken(), username: username() });
    }).then(function (d) {
      if (!d || d.ok === false) {
        setStatus('Diagnose failed: ' + ((d && (d.message || d.error)) || 'unknown'));
        return;
      }
      setStatus(
        'App:' + (isStandaloneApp() ? 'installed' : 'BROWSER') +
        ' · Perm:' + (Notification.permission || '?') +
        ' · ' + localPart +
        ' · ' + savePart +
        ' · Server:' + (d.hasToken ? 'yes' : 'NO') +
        ' · FCM:' + (d.fcmAuth ? 'OK' : 'FAIL') +
        ' · Send:' + (d.fcmSend || '?') +
        ' · Backend:' + (d.version || '?')
      );
    }).catch(function (e) {
      setStatus('Diagnose failed: ' + ((e && e.message) || 'server unreachable'));
    });
  };

  /** Call after login if permission already granted — saves token without extra UI step. */
  window.empirePushTrySaveAfterLogin = function () {
    if (!isWorkerView() || Notification.permission !== 'granted' || !pushConfigured()) return;
    getFcmToken().then(function (t) {
      if (t) saveTokenToServer(t);
    }).catch(function () {});
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
