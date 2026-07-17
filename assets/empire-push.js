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
    if (!silent) {
      pauseBackground();
      setBanner('Setting up notifications…', false);
    }
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

  var _lastNotifyKey = '';
  var _lastNotifyTime = 0;
  var _pendingOpenJobId = '';
  var _pendingJobRetry = false;

  function jobUrl_(issueId) {
    var url = './civil-issue.html';
    if (issueId) url += '?job=' + encodeURIComponent(String(issueId));
    return url;
  }

  function jobIdFromUrl_() {
    try {
      var p = new URLSearchParams(window.location.search);
      return String(p.get('job') || p.get('issue') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function clearJobUrlParam_() {
    try {
      var u = new URL(window.location.href);
      if (!u.searchParams.has('job') && !u.searchParams.has('issue')) return;
      u.searchParams.delete('job');
      u.searchParams.delete('issue');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  function setPendingJobId_(issueId) {
    issueId = String(issueId || '').trim();
    if (!issueId) return;
    _pendingOpenJobId = issueId;
    try { sessionStorage.setItem('empire_pending_job', issueId); } catch (e) {}
  }

  function readPendingJobId_() {
    if (_pendingOpenJobId) return _pendingOpenJobId;
    try {
      var s = sessionStorage.getItem('empire_pending_job');
      if (s) return String(s).trim();
    } catch (e) {}
    return jobIdFromUrl_();
  }

  function clearPendingJobId_() {
    _pendingOpenJobId = '';
    _pendingJobRetry = false;
    try { sessionStorage.removeItem('empire_pending_job'); } catch (e) {}
    clearJobUrlParam_();
  }

  window.empirePushCaptureJobFromUrl = function () {
    var id = jobIdFromUrl_();
    if (id) setPendingJobId_(id);
  };

  window.empirePushOpenJob = function (issueId) {
    issueId = String(issueId || '').trim();
    if (!issueId) return;
    setPendingJobId_(issueId);
    if (typeof loadIssues === 'function') loadIssues(true);
    window.empirePushTryOpenPendingJob();
  };

  window.empirePushTryOpenPendingJob = function () {
    if (!isWorkerView()) return;
    var id = readPendingJobId_();
    if (!id) return;
    if (typeof allIssues === 'undefined' || !Array.isArray(allIssues)) return;
    var r = allIssues.find(function (x) { return x && x.id === id; });
    if (!r) {
      if (!_pendingJobRetry && typeof loadIssues === 'function') {
        _pendingJobRetry = true;
        loadIssues(true);
      }
      return;
    }
    if (r.status === 'fixed') {
      clearPendingJobId_();
      return;
    }
    clearPendingJobId_();
    if (typeof openWorkerJob === 'function') openWorkerJob(id);
  };

  function notifyViaServiceWorker(title, body, url, issueId) {
    if (!('serviceWorker' in navigator)) return;
    var send = function (reg) {
      var target = reg.active || reg.waiting || reg.installing;
      if (!target) return;
      target.postMessage({
        type: 'EMPUSH_SHOW',
        title: title,
        body: body,
        url: url || jobUrl_(issueId),
        issueId: issueId || ''
      });
    };
    if (navigator.serviceWorker.controller) {
      send({ active: navigator.serviceWorker.controller });
      return;
    }
    navigator.serviceWorker.ready.then(send).catch(function () {});
  }

  function showAssignNotification(count, body, issueId) {
    var title = count === 1 ? 'New job assigned' : count + ' new jobs assigned';
    var text = body || 'Open the app to view details.';
    var key = title + '|' + text + '|' + (issueId || '');
    var now = Date.now();
    if (key === _lastNotifyKey && now - _lastNotifyTime < 10000) return;
    _lastNotifyKey = key;
    _lastNotifyTime = now;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      notifyViaServiceWorker(title, text, jobUrl_(issueId), issueId);
      return;
    }
    try {
      var n = new Notification(title, {
        body: text,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'empire-job',
        renotify: true
      });
      n.onclick = function () {
        window.focus();
        if (issueId) window.empirePushOpenJob(issueId);
        n.close();
      };
    } catch (e) {}
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
      showAssignNotification(fresh.length, body, r0.id);
      return;
    }
    body = fresh.length + ' new jobs — open the app';
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
        var data = payload && payload.data;
        var title = (data && data.title) || (payload.notification && payload.notification.title) || 'New job assigned';
        var body = (data && data.body) || (payload.notification && payload.notification.body) || '';
        var issueId = data && (data.issueId || data.jobId);
        showAssignNotification(1, body || title, issueId);
        if (issueId) window.empirePushOpenJob(issueId);
      });
    } catch (e) {}
  }

  window.empirePushCaptureJobFromUrl();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'EMPUSH_OPEN_JOB') return;
      var issueId = event.data.issueId || '';
      if (issueId) window.empirePushOpenJob(issueId);
      else if (event.data.url) {
        try {
          var u = new URL(event.data.url, window.location.href);
          var id = u.searchParams.get('job') || u.searchParams.get('issue');
          if (id) window.empirePushOpenJob(id);
        } catch (e) {}
      }
    });
  }
})();
