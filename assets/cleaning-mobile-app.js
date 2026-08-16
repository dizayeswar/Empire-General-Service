/* Cleaning supervisor mobile app */
(function () {
  var TASK_FOLDER = 'cleaning/tasks';
  var MAX_PHOTOS = 3;
  var PROJECT_NAMES = {
    ec: 'Empire Complex',
    es: 'Empire Square',
    wd: 'West Diamond',
    ww: 'West Wing',
    ww2: '(New) West Wing',
    ra: 'Royal Apartment'
  };
  var TASK_MAP = {
    ec: { groups: [
      { labelKey: 'dailyTasks', daily: true, freq: 'daily', tasks: ['Cleaning area', 'Cleaning road', 'Floor mopping', 'Elevator mopping', 'Cleaning basement', 'Ground mopping', 'Around building cleaning (ride-on scrubber dryer)'] },
      { label: 'Once a Week', daily: false, freq: 'weekly', tasks: ['Walk-behind scrubber dryer', 'Rooftops cleaning', 'Floor cleaning (floor scrubber machine)'] }
    ]},
    es: { groups: [
      { labelKey: 'dailyTasks', daily: true, freq: 'daily', tasks: ['Cleaning area', 'Cleaning road', 'Floor mopping', 'Elevator mopping', 'Cleaning balcony', 'Cleaning basement', 'Ground cleaning (ride-on scrubber dryer)', 'Around building cleaning (ride-on scrubber dryer)'] },
      { label: 'Once a Week', daily: false, freq: 'weekly', tasks: ['Walk-behind scrubber dryer', 'Rooftops cleaning'] },
      { label: 'Once Every 2 Weeks', daily: false, freq: 'biweekly', tasks: ['Basement 1 & Basement 2 (ride-on scrubber dryer)'] }
    ]},
    wd: { groups: [
      { labelKey: 'dailyTasks', daily: true, freq: 'daily', tasks: ['Cleaning garden', 'Cleaning area', 'Cleaning road', 'Floor mopping', 'Rooftops cleaning', 'Elevator mopping', 'Cleaning basement', 'Ground cleaning (ride-on scrubber dryer)', 'Around building cleaning (ride-on scrubber dryer)', 'Restaurant floor cleaning (ride-on scrubber dryer)', 'Washing garbage room', 'Cleaning glass'] },
      { label: 'Once a Week', daily: false, freq: 'weekly', tasks: ['Washing all floors'] },
      { label: 'Once or Twice a Week', daily: false, freq: 'weekly2', tasks: ['Washing trash container'] }
    ]},
    ww: { groups: [
      { labelKey: 'dailyTasks', daily: true, freq: 'daily', tasks: ['Elevator mopping', 'Floor mopping', 'Ground mopping and washing', 'Basement mopping and washing', 'Cleaning trash can', 'Cleaning garden', 'Cleaning area', 'Cleaning road', 'Cleaning basement'] },
      { label: 'Once a Week', daily: false, freq: 'weekly', tasks: ['Washing stairs'] },
      { label: 'Once or Twice a Month', daily: false, freq: 'monthly2', tasks: ['Gates between properties', 'Cleaning balcony'] }
    ]},
    ww2: { groups: [
      { labelKey: 'dailyTasks', daily: true, freq: 'daily', tasks: ['Elevator mopping', 'Floor mopping', 'Ground mopping and washing', 'Basement mopping and washing', 'Cleaning trash can', 'Cleaning garden', 'Cleaning area', 'Cleaning road', 'Cleaning basement', 'Ground cleaning (ride-on scrubber dryer)', 'Basement garbage room washing (WW12-WW15)'] },
      { label: 'Once a Week', daily: false, freq: 'weekly', tasks: ['Washing stairs'] },
      { label: 'Once or Twice a Month', daily: false, freq: 'monthly2', tasks: ['Gates between properties', 'Cleaning balcony'] }
    ]},
    ra: { groups: [
      { labelKey: 'dailyTasks', daily: true, freq: 'daily', tasks: ['Cleaning garden', 'Cleaning area', 'Cleaning road', 'Cleaning trash can', 'Cleaning basement', 'Ground mopping', 'Elevator mopping', 'Floor mopping'] },
      { label: 'Once a Week', daily: false, freq: 'weekly', tasks: ['Area washing', 'Washing around building'] },
      { label: 'Once a Month', daily: false, freq: 'monthly', tasks: ['Rooftops cleaning'] }
    ]}
  };

  var state = {
    view: 'projects',
    project: null,
    week: {},
    photos: [],
    pending: {},
    tab: 'tasks',
    lastGps: null,
    gpsWatch: null,
    weekNotifySent: {},
    syncing: false,
    saving: false,
    stickyPhotos: [],
    loginGraceUntil: 0,
    photoLoadTries: 0
  };

  function isSupervisorRole(role) {
    if (typeof empireIsCleaningSupervisorRole === 'function') {
      return empireIsCleaningSupervisorRole(role);
    }
    role = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return role === 'cleaning_supervisor' || role === 'supervisor';
  }

  function t(key, params) {
    return typeof cleaningT === 'function' ? cleaningT(key, params) : key;
  }

  function taskLabel(englishName) {
    return typeof cleaningTaskLabel === 'function' ? cleaningTaskLabel(englishName) : String(englishName || '');
  }

  function groupLabel(g) {
    if (!g) return t('otherTasks');
    if (g.labelKey) return t(g.labelKey);
    if (g.label && typeof cleaningGroupLabel === 'function') return cleaningGroupLabel(g.label);
    return g.label || t('otherTasks');
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function reportMonthOfDate(d) {
    d = String(d || todayStr());
    var yr = parseInt(d.slice(0, 4), 10);
    var mo = parseInt(d.slice(5, 7), 10);
    var dy = parseInt(d.slice(8, 10), 10);
    if (dy >= 26) {
      mo += 1;
      if (mo > 12) { mo = 1; yr += 1; }
    }
    return yr + '-' + String(mo).padStart(2, '0');
  }

  function curMonth() { return reportMonthOfDate(todayStr()); }

  function userProjects() {
    var scoped = typeof empireGetProjects === 'function' ? empireGetProjects() : null;
    if (scoped && scoped.length) {
      return scoped.filter(function (p) { return !!TASK_MAP[p]; });
    }
    // Cleaning supervisors must be assigned projects in Users sheet — never show all.
    if (typeof empireIsCleaningSupervisor === 'function' && empireIsCleaningSupervisor()) {
      return [];
    }
    return Object.keys(TASK_MAP);
  }

  function dailyGroup(p) {
    return (TASK_MAP[p].groups || []).find(function (g) { return g.daily; });
  }

  function photosFor(p, g, task, wk) {
    var period = g.daily ? (curMonth() + '#' + wk) : curMonth();
    var taskName = String(task || '').trim();
    var seen = {};
    var out = [];
    state.photos.forEach(function (x) {
      if (String(x.project).toLowerCase() !== String(p).toLowerCase()) return;
      if (String(x.task || '').trim() !== taskName || x.period !== period) return;
      var img = String(x.image || '');
      var key = x.id ? ('id:' + x.id) : ('img:' + img);
      if (img && seen['img:' + img]) return;
      if (seen[key]) return;
      if (img) seen['img:' + img] = 1;
      seen[key] = 1;
      out.push(x);
    });
    return out;
  }

  function dedupePhotoList(list) {
    var seenId = {};
    var seenImg = {};
    var out = [];
    (list || []).forEach(function (x) {
      if (!x) return;
      var id = String(x.id || '');
      var img = String(x.image || '');
      var isOffline = id.indexOf('offline-') === 0 || !!x._offline;
      if (!isOffline && id && seenId[id]) return;
      if (img && seenImg[img]) return;
      if (!isOffline && id) seenId[id] = 1;
      if (img) seenImg[img] = 1;
      out.push(x);
    });
    return out;
  }

  function dailyCovered(p, wk) {
    var dg = dailyGroup(p);
    if (!dg) return 0;
    return dg.tasks.filter(function (task) { return photosFor(p, dg, task, wk).length > 0; }).length;
  }

  function dailyComplete(p, wk) {
    var dg = dailyGroup(p);
    return dg && dailyCovered(p, wk) === dg.tasks.length;
  }

  function weekAccessible(p, wk) {
    return wk === 1 || dailyComplete(p, wk - 1);
  }

  function firstIncompleteWeek(p) {
    for (var w = 1; w <= 4; w++) {
      if (!dailyComplete(p, w)) return w;
    }
    return 4;
  }

  function selectedWeek(p) {
    if (!state.week[p] || !weekAccessible(p, state.week[p])) {
      state.week[p] = firstIncompleteWeek(p);
    }
    return state.week[p];
  }

  function pendingSlot(p, gi) {
    var g = TASK_MAP[p] && TASK_MAP[p].groups && TASK_MAP[p].groups[gi];
    if (!g) return 'x';
    return g.daily ? String(selectedWeek(p)) : 'm';
  }

  function pendingKey(p, gi, ti, slot) {
    if (slot == null) slot = pendingSlot(p, gi);
    return p + '|' + gi + '|' + ti + '|' + slot;
  }

  function parsePendingKey(key) {
    var parts = String(key || '').split('|');
    return {
      p: parts[0],
      gi: Number(parts[1]),
      ti: Number(parts[2]),
      slot: parts[3] != null ? parts[3] : '1'
    };
  }

  function ensurePending(key) {
    if (!state.pending[key]) state.pending[key] = [];
    return state.pending[key];
  }

  function taskGroup(p, gi) {
    return TASK_MAP[p] && TASK_MAP[p].groups ? TASK_MAP[p].groups[gi] : null;
  }

  function setMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
  }

  function showView(id) {
    var login = document.getElementById('cmLogin');
    var app = document.getElementById('cmApp');
    if (id === 'login') {
      if (login) login.classList.add('show');
      if (app) app.classList.remove('show');
    } else {
      if (login) login.classList.remove('show');
      if (app) app.classList.add('show');
    }
  }

  function applyLangUi() {
    if (typeof cleaningApplyI18n === 'function') cleaningApplyI18n(document);
    var toggle = document.getElementById('cmLangBtn');
    if (toggle) toggle.textContent = t('langToggle');
    renderAll();
  }

  function toggleLang() {
    var next = (typeof cleaningGetLang === 'function' && cleaningGetLang() === 'ckb') ? 'en' : 'ckb';
    if (typeof cleaningSetLang === 'function') cleaningSetLang(next);
    applyLangUi();
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem('empire_theme', cur); } catch (e) {}
  }

  function bootTheme() {
    try {
      var th = localStorage.getItem('empire_theme');
      if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th);
    } catch (e) {}
  }

  async function api(body, tries) {
    return fetchJSONRetry(Object.assign({ token: empireGetToken() || '' }, body), tries == null ? 2 : tries);
  }

  /** Mutating writes must not retry — a timeout after success would duplicate rows. */
  async function apiWrite(body) {
    return api(body, 1);
  }

  var _photosRefreshTimer = null;
  var _photosRefreshing = false;
  var _lastPhotosSyncAt = 0;

  async function loadPhotos(force) {
    if (!empireGetToken()) return;
    if (state.saving || state.syncing) return;
    if (_photosRefreshing) return;
    var now = Date.now();
    // Soft debounce background polls; force/refresh always runs.
    if (!force && now - _lastPhotosSyncAt < 12000) return;
    _photosRefreshing = true;
    var mv = curMonth();
    try {
      var d = await api({ action: 'getTaskPhotos', periodPrefix: mv, force: true });
      if (d && d.ok === false) {
        // Never auto-kick supervisors from the mobile app — show error and keep session.
        console.warn('getTaskPhotos rejected', d);
        var err = String(d.error || '').toLowerCase();
        var bar = document.getElementById('cmOfflineBanner');
        if (bar) {
          bar.style.display = 'flex';
          if (err === 'password_changed' || err === 'invalid token' || err === 'token expired' || err === 'no token' || err === 'not authenticated') {
            bar.innerHTML = '<span>Server auth error: ' + String(d.message || d.error || 'unknown') +
              ' — Logout and Sign in again.</span>' +
              '<button type="button" class="cm-btn" id="cmReLoginBtn" style="padding:8px 12px;font-size:12px;">Sign in again</button>';
            var rb = document.getElementById('cmReLoginBtn');
            if (rb) {
              rb.onclick = function () {
                if (typeof empireClearSession === 'function') empireClearSession();
                showView('login');
                setMsg(document.getElementById('cmLoginMsg'), 'Sign in again to refresh your session.', true);
              };
            }
          } else {
            bar.innerHTML = '<span>Could not refresh tasks: ' +
              String(d.message || d.error || 'server error') +
              '. Pull refresh to retry.</span>';
          }
        }
        return;
      }
      // If a save started while we were fetching, keep current UI.
      if (state.saving || state.syncing) return;
      state.photoLoadTries = 0;
      _lastPhotosSyncAt = Date.now();
      var list = Array.isArray(d) ? d : [];
      var allowed = userProjects();
      // Prefer server truth, but keep recently-saved photos so they don't flicker away.
      var fromServer = list.filter(function (x) {
        return !allowed.length || allowed.indexOf(String(x.project || '').toLowerCase()) !== -1;
      });
      state.photos = dedupePhotoList(mergeStickyIntoPhotos(fromServer));
      await restoreOfflinePlaceholders();
      state.photos = dedupePhotoList(state.photos);
      await refreshOfflineBanner();
      renderAll();
    } catch (e) {
      console.warn(e);
    } finally {
      _photosRefreshing = false;
    }
  }

  function startPhotosAutoSync() {
    if (_photosRefreshTimer) return;
    var tick = function () {
      if (document.visibilityState !== 'visible') return;
      if (state.view === 'login') return;
      if (!empireGetToken()) return;
      if (state.saving || state.syncing) return;
      loadPhotos(false);
    };
    _photosRefreshTimer = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') loadPhotos(true);
    });
    window.addEventListener('focus', function () {
      if (!state.saving && !state.syncing) loadPhotos(true);
    });
  }

  function normalizeSource(v) {
    return String(v || 'camera').toLowerCase() === 'gallery' ? 'gallery' : 'camera';
  }

  function rememberStickyPhotos(rows) {
    var now = Date.now();
    state.stickyPhotos = (state.stickyPhotos || []).filter(function (x) {
      return x && x.image && (now - (x._stickyAt || 0) < 120000);
    });
    (rows || []).forEach(function (row) {
      if (!row || !row.image) return;
      var exists = state.stickyPhotos.some(function (x) { return x.image === row.image; });
      if (exists) return;
      state.stickyPhotos.push(Object.assign({}, row, { _stickyAt: now }));
    });
  }

  function mergeStickyIntoPhotos(list) {
    var out = (list || []).slice();
    var now = Date.now();
    var serverImgs = {};
    out.forEach(function (x) {
      if (x && x.image) serverImgs[String(x.image)] = 1;
    });
    state.stickyPhotos = (state.stickyPhotos || []).filter(function (x) {
      if (!x || !x.image) return false;
      var age = now - (x._stickyAt || 0);
      if (age >= 120000) return false;
      // Already confirmed on server.
      if (serverImgs[String(x.image)]) return false;
      // If server omitted it after a short grace, treat as deleted on portal.
      if (age > 25000) return false;
      return true;
    });
    state.stickyPhotos.forEach(function (sticky) {
      if (out.some(function (x) { return String(x.image || '') === String(sticky.image || ''); })) return;
      out.push({
        id: sticky.id || ('sticky-' + sticky.image),
        project: sticky.project,
        freq: sticky.freq,
        task: sticky.task,
        date: sticky.date,
        period: sticky.period,
        image: sticky.image,
        source: sticky.source || 'camera'
      });
    });
    return out;
  }

  function compressPreview(file, source) {
    return new Promise(function (resolve) {
      if (!file) return resolve(null);
      var reader = new FileReader();
      reader.onerror = function () { resolve(null); };
      reader.onload = function (e) {
        var img = new Image();
        img.onerror = function () { resolve(null); };
        img.onload = function () {
          var maxSize = 1600;
          var s = Math.min(1, maxSize / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s);
          c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (blob) {
            if (!blob) return resolve(null);
            resolve({
              preview: URL.createObjectURL(blob),
              blob: blob,
              remote: null,
              source: normalizeSource(source),
              gps: state.lastGps ? Object.assign({}, state.lastGps) : null
            });
          }, 'image/jpeg', 0.85);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadBlob(blob) {
    if (typeof empireUploadPhotoAsync === 'function') {
      return empireUploadPhotoAsync(blob, TASK_FOLDER);
    }
    return null;
  }

  function updateGpsChip() {
    var el = document.getElementById('cmGpsChip');
    if (!el) return;
    if (state.lastGps) {
      el.className = 'cm-chip ok';
      el.textContent = t('gpsOn');
    } else {
      el.className = 'cm-chip warn';
      el.textContent = t('gpsOff');
    }
  }

  function startGps() {
    if (!navigator.geolocation) return;
    var onPos = function (pos) {
      state.lastGps = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
      updateGpsChip();
      reportLiveGps(false);
    };
    var onErr = function () {
      state.lastGps = null;
      updateGpsChip();
    };
    navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    if (state.gpsWatch != null) {
      try { navigator.geolocation.clearWatch(state.gpsWatch); } catch (e) {}
    }
    state.gpsWatch = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 15000
    });
  }

  var _lastLiveGpsAt = 0;
  function reportLiveGps(force) {
    if (!state.lastGps || !empireGetToken()) return;
    var now = Date.now();
    if (!force && now - _lastLiveGpsAt < 45000) return;
    _lastLiveGpsAt = now;
    api({
      action: 'reportWorkerLocation',
      lat: state.lastGps.lat,
      lng: state.lastGps.lng,
      accuracy: state.lastGps.accuracy
    }).catch(function () {});
  }

  function localNotify(title, body) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: 'icons/icon-192.png' });
      }
    } catch (e) {}
  }

  function maybeNotifyWeekUnlock(p, completedWeek) {
    if (completedWeek < 1 || completedWeek >= 4) return;
    var next = completedWeek + 1;
    var key = p + '|' + curMonth() + '|' + next;
    if (state.weekNotifySent[key]) return;
    state.weekNotifySent[key] = 1;
    try { localStorage.setItem('cm_week_notify_' + key, '1'); } catch (e) {}
    localNotify(t('weekUnlockedPush', { n: next }), PROJECT_NAMES[p] || p);
    api({
      action: 'notifyCleaningWeekUnlock',
      week: next,
      project: p
    }).catch(function () {});
  }

  function checkWeekCompletionAfterSave(p) {
    for (var w = 1; w <= 4; w++) {
      if (dailyComplete(p, w)) maybeNotifyWeekUnlock(p, w);
    }
  }

  async function enqueueOffline(p, freq, task, period, date, items) {
    var id = 'oq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var imageDataUrls = [];
    var remoteUrls = [];
    var photoGps = [];
    var photoSources = [];
    for (var i = 0; i < items.length; i++) {
      photoGps.push(items[i].gps || null);
      photoSources.push(normalizeSource(items[i].source));
      if (items[i].remote) remoteUrls.push(items[i].remote);
      else if (items[i].blob && typeof empireOfflineBlobToDataUrl === 'function') {
        imageDataUrls.push(await empireOfflineBlobToDataUrl(items[i].blob));
      } else if (items[i].preview && String(items[i].preview).indexOf('data:') === 0) {
        imageDataUrls.push(items[i].preview);
      }
    }
    await empireOfflineQueuePut({
      id: id,
      type: 'cleaning_task_photos',
      createdAt: Date.now(),
      project: p,
      freq: freq,
      task: task,
      date: date,
      period: period,
      imageDataUrls: imageDataUrls,
      remoteUrls: remoteUrls,
      photoGps: photoGps,
      photoSources: photoSources
    });
    items.forEach(function (it, idx) {
      state.photos.push({
        id: 'offline-' + id + '-' + idx,
        project: p,
        freq: freq,
        task: task,
        date: date,
        period: period,
        image: it.preview || it.remote,
        source: normalizeSource(it.source),
        _offline: true,
        _queueId: id
      });
    });
    await refreshOfflineBanner();
  }

  async function restoreOfflinePlaceholders() {
    if (typeof empireOfflineQueueAll !== 'function') return;
    var rows = await empireOfflineQueueAll();
    var serverImgs = {};
    state.photos.forEach(function (x) {
      if (x && x.image && !x._offline) serverImgs[String(x.image)] = 1;
    });
    for (var qi = 0; qi < rows.length; qi++) {
      var item = rows[qi];
      if (!item || item.type !== 'cleaning_task_photos') continue;
      var remotes = item.remoteUrls || [];
      var datas = item.imageDataUrls || [];
      // Drop queue entries that are already fully on the server (prevents 3→6 flicker).
      if (remotes.length && remotes.every(function (u) { return serverImgs[String(u)]; }) && !datas.length) {
        try { await empireOfflineQueueDelete(item.id); } catch (eDel) {}
        continue;
      }
      if (state.photos.some(function (x) { return x._queueId === item.id; })) continue;
      var idx = 0;
      datas.forEach(function (dataUrl) {
        if (!dataUrl) return;
        state.photos.push({
          id: 'offline-' + item.id + '-' + (idx),
          project: item.project,
          freq: item.freq,
          task: item.task,
          date: item.date,
          period: item.period,
          image: dataUrl,
          source: normalizeSource((item.photoSources || [])[idx]),
          _offline: true,
          _queueId: item.id
        });
        idx++;
      });
      remotes.forEach(function (url) {
        if (!url || serverImgs[String(url)]) return;
        state.photos.push({
          id: 'offline-' + item.id + '-' + (idx),
          project: item.project,
          freq: item.freq,
          task: item.task,
          date: item.date,
          period: item.period,
          image: url,
          source: normalizeSource((item.photoSources || [])[idx]),
          _offline: true,
          _queueId: item.id
        });
        idx++;
      });
    }
  }

  async function refreshOfflineBanner() {
    var bar = document.getElementById('cmOfflineBanner');
    if (!bar || typeof empireOfflineQueueCount !== 'function') return;
    var n = await empireOfflineQueueCount();
    if (!n) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    bar.style.display = 'flex';
    bar.innerHTML = '<span>' + t('offlineWaiting', { count: n }) + '</span>' +
      '<button type="button" class="cm-btn" id="cmSyncBtn" style="padding:8px 12px;font-size:12px;">Sync</button>';
    var btn = document.getElementById('cmSyncBtn');
    if (btn) btn.onclick = function () { syncOffline(false); };
  }

  async function syncOffline(silent) {
    if (state.syncing || state.saving) return;
    if (!navigator.onLine) {
      if (!silent) alert(t('noConnection'));
      return;
    }
    if (typeof empireOfflineQueueAll !== 'function') return;
    state.syncing = true;
    try {
      var rows = await empireOfflineQueueAll();
      var items = rows.filter(function (r) { return r.type === 'cleaning_task_photos'; });
      var synced = 0;
      for (var qi = 0; qi < items.length; qi++) {
        var item = items[qi];
        try {
          var remoteUrls = [];
          var photoSources = [];
          var seenUrl = {};
          var queuedSources = item.photoSources || [];
          (item.remoteUrls || []).forEach(function (u, ui) {
            u = String(u || '');
            if (!u || seenUrl[u]) return;
            seenUrl[u] = 1;
            remoteUrls.push(u);
            photoSources.push(normalizeSource(queuedSources[ui]));
          });
          var dataUrls = item.imageDataUrls || [];
          for (var bi = 0; bi < dataUrls.length; bi++) {
            var blob = empireOfflineDataUrlToBlob(dataUrls[bi]);
            if (!blob) throw new Error('Invalid saved image');
            var url = await uploadBlob(blob);
            if (!url) throw new Error('Photo upload failed');
            if (seenUrl[url]) continue;
            seenUrl[url] = 1;
            remoteUrls.push(url);
            photoSources.push(normalizeSource(queuedSources[(item.remoteUrls || []).length + bi]));
          }
          if (!remoteUrls.length) throw new Error('No photos');
          if (remoteUrls.length > MAX_PHOTOS) {
            remoteUrls = remoteUrls.slice(0, MAX_PHOTOS);
            photoSources = photoSources.slice(0, MAX_PHOTOS);
          }
          var batch = await apiWrite({
            action: 'addTaskPhotos',
            project: item.project,
            freq: item.freq,
            task: item.task,
            date: item.date,
            period: item.period,
            images: remoteUrls,
            photoGps: item.photoGps || [],
            photoSources: photoSources
          });
          if (batch && batch.ok === false) throw new Error(batch.message || batch.error || 'save failed');
          rememberStickyPhotos(remoteUrls.map(function (u, i) {
            return {
              id: (batch.items && batch.items[i] && batch.items[i].id) || ('tmp-' + Date.now() + '-' + i),
              project: item.project,
              freq: item.freq,
              task: item.task,
              date: item.date,
              period: item.period,
              image: u,
              source: photoSources[i] || 'camera'
            };
          }));
          state.photos = state.photos.filter(function (x) { return x._queueId !== item.id; });
          await empireOfflineQueueDelete(item.id);
          synced++;
          checkWeekCompletionAfterSave(item.project);
        } catch (e) {
          console.warn('offline sync failed', e);
        }
      }
      if (synced) {
        state.syncing = false;
        await loadPhotos(true);
        localNotify(t('synced', { count: synced }), '');
        if (!silent) alert(t('synced', { count: synced }));
      }
      await refreshOfflineBanner();
    } finally {
      state.syncing = false;
    }
  }

  async function confirmSave(p, gi, ti) {
    var g = taskGroup(p, gi);
    if (!g || !g.tasks || !g.tasks[ti]) return;
    var key = pendingKey(p, gi, ti);
    var items = ensurePending(key);
    if (!items.length || state.saving) return;
    var task = g.tasks[ti];
    var freq = g.daily ? 'daily' : (g.freq || 'weekly');
    var wk = selectedWeek(p);
    var period = g.daily ? (curMonth() + '#' + wk) : curMonth();
    var date = todayStr();
    var btn = document.querySelector('[data-confirm="' + key + '"]');
    if (btn) { btn.disabled = true; btn.textContent = t('saving'); }
    state.saving = true;

    if (!navigator.onLine) {
      try {
        await enqueueOffline(p, freq, task, period, date, items);
        delete state.pending[key];
        renderTasks();
        alert(t('savedOffline'));
      } catch (e) {
        alert(e.message || String(e));
      }
      state.saving = false;
      if (btn) { btn.disabled = false; btn.textContent = t('confirmSave'); }
      return;
    }

    var serverSaved = false;
    try {
      var remoteUrls = [];
      var photoGps = [];
      var photoSources = [];
      var seenUrl = {};
      for (var i = 0; i < items.length; i++) {
        if (btn) btn.textContent = t('uploading') + ' ' + (i + 1) + '/' + items.length;
        var url = items[i].remote;
        if (!url) {
          url = await uploadBlob(items[i].blob);
          if (!url) throw new Error('Upload failed');
          items[i].remote = url;
        }
        if (seenUrl[url]) continue;
        seenUrl[url] = 1;
        remoteUrls.push(url);
        photoGps.push(items[i].gps || state.lastGps || null);
        photoSources.push(normalizeSource(items[i].source));
      }
      if (!remoteUrls.length) throw new Error('No photos');
      if (remoteUrls.length > MAX_PHOTOS) {
        remoteUrls = remoteUrls.slice(0, MAX_PHOTOS);
        photoGps = photoGps.slice(0, MAX_PHOTOS);
        photoSources = photoSources.slice(0, MAX_PHOTOS);
      }
      var batch = await apiWrite({
        action: 'addTaskPhotos',
        project: p,
        freq: freq,
        task: task,
        date: date,
        period: period,
        images: remoteUrls,
        photoGps: photoGps,
        photoSources: photoSources
      });
      if (batch && batch.ok === false) throw new Error(batch.message || batch.error || 'Save failed');
      serverSaved = true;
      var stickyRows = remoteUrls.map(function (u, idx) {
        var row = (batch && batch.items && batch.items[idx]) || {};
        return {
          id: row.id || ('tmp-' + Date.now() + '-' + idx),
          project: p,
          freq: freq,
          task: task,
          date: date,
          period: period,
          image: row.image || u,
          source: row.source || photoSources[idx] || 'camera'
        };
      });
      rememberStickyPhotos(stickyRows);
      stickyRows.forEach(function (row) {
        if (!state.photos.some(function (x) { return String(x.image || '') === String(row.image || ''); })) {
          state.photos.push(row);
        }
      });
      items.forEach(function (it) {
        if (it.preview && String(it.preview).indexOf('blob:') === 0) {
          try { URL.revokeObjectURL(it.preview); } catch (e) {}
        }
      });
      delete state.pending[key];
      checkWeekCompletionAfterSave(p);
      state.photos = dedupePhotoList(state.photos);
      renderTasks();
      state.saving = false;
      try { await loadPhotos(true); } catch (eLoad) {}
      renderTasks();
    } catch (e) {
      if (!serverSaved) {
        try {
          await enqueueOffline(p, freq, task, period, date, items);
          delete state.pending[key];
          renderTasks();
          alert(t('savedOffline'));
        } catch (err) {
          alert(e.message || String(e));
        }
      } else {
        delete state.pending[key];
        try { await loadPhotos(true); } catch (e2) {}
        renderTasks();
      }
    } finally {
      state.saving = false;
      if (btn) { btn.disabled = false; btn.textContent = t('confirmSave'); }
    }
  }

  async function onPhotoFiles(p, gi, ti, files, source) {
    if (!files || !files.length) return;
    var g = taskGroup(p, gi);
    if (!g || !g.tasks || !g.tasks[ti]) return;
    var key = pendingKey(p, gi, ti);
    var list = ensurePending(key);
    var existing = photosFor(p, g, g.tasks[ti], selectedWeek(p)).length;
    var room = MAX_PHOTOS - existing - list.length;
    if (room <= 0) {
      alert(t('photoMax'));
      return;
    }
    var arr = Array.prototype.slice.call(files, 0, room);
    for (var i = 0; i < arr.length; i++) {
      var item = await compressPreview(arr[i], source);
      if (item) list.push(item);
    }
    renderTasks();
  }

  function sourceBadgeHtml(source) {
    if (normalizeSource(source) === 'gallery') {
      return '<span class="photo-source-badge photo-source-gallery">' + t('sourceUploaded') + '</span>';
    }
    return '<span class="photo-source-badge photo-source-camera">' + t('sourceTaken') + '</span>';
  }

  function photoInputId(kind, p, gi, ti, slot) {
    return 'cm' + kind + '-' + p + '-' + gi + '-' + ti + '-' + slot;
  }

  function openPhotoPicker(p, gi, ti) {
    var slot = pendingSlot(p, gi);
    var cam = document.getElementById(photoInputId('Cam', p, gi, ti, slot));
    var gal = document.getElementById(photoInputId('Gal', p, gi, ti, slot));
    if (typeof empireWorkerShowPhotoChoice === 'function') {
      empireWorkerShowPhotoChoice({
        title: t('addPhoto'),
        onCamera: function () {
          if (typeof empireWorkerClickFileInput === 'function') empireWorkerClickFileInput(cam);
          else if (cam) cam.click();
        },
        onGallery: function () {
          if (typeof empireWorkerClickFileInput === 'function') empireWorkerClickFileInput(gal);
          else if (gal) gal.click();
        }
      });
      return;
    }
    if (cam) cam.click();
  }

  function removePending(p, gi, ti, idx) {
    var key = pendingKey(p, gi, ti);
    var list = ensurePending(key);
    var it = list[idx];
    if (it && it.preview && String(it.preview).indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(it.preview); } catch (e) {}
    }
    list.splice(idx, 1);
    renderTasks();
  }

  function openModal(src) {
    var m = document.getElementById('cmModal');
    var img = document.getElementById('cmModalImg');
    if (!m || !img) return;
    img.src = src;
    m.classList.add('show');
  }

  function closeModal() {
    var m = document.getElementById('cmModal');
    if (m) m.classList.remove('show');
  }

  function renderProjects() {
    var host = document.getElementById('cmProjects');
    if (!host) return;
    var list = userProjects();
    if (!list.length) {
      host.innerHTML = '<div class="cm-empty">' + t('noProjects') + '</div>';
      return;
    }
    host.innerHTML = list.map(function (p) {
      var dg = dailyGroup(p);
      var wk = selectedWeek(p);
      var done = dg ? dailyCovered(p, wk) : 0;
      var total = dg ? dg.tasks.length : 0;
      var active = state.project === p ? ' active' : '';
      return '<button type="button" class="cm-project-btn' + active + '" data-project="' + p + '">' +
        '<strong>' + (PROJECT_NAMES[p] || p) + '</strong>' +
        '<span>' + t('progress') + ': ' + t('weekProgress', { done: done, total: total }) + ' · ' + t('week', { n: wk }) + '</span>' +
        '</button>';
    }).join('');
    host.querySelectorAll('[data-project]').forEach(function (btn) {
      btn.onclick = function () {
        state.project = btn.getAttribute('data-project');
        state.view = 'tasks';
        state.tab = 'tasks';
        renderAll();
      };
    });
  }

  function renderTaskCard(p, gi, ti) {
    var g = taskGroup(p, gi);
    if (!g || !g.tasks || !g.tasks[ti]) return '';
    var task = g.tasks[ti];
    var wk = selectedWeek(p);
    var saved = photosFor(p, g, task, wk);
    var slot = pendingSlot(p, gi);
    var key = pendingKey(p, gi, ti, slot);
    var pending = ensurePending(key);
    var done = saved.length > 0;
    var offlineOnly = done && saved.every(function (x) {
      return !!x._offline || String(x.id || '').indexOf('offline-') === 0 || String(x.id || '').indexOf('sticky-') === 0;
    });
    var html = '<div class="cm-task" data-project="' + p + '" data-gi="' + gi + '" data-ti="' + ti + '" data-slot="' + slot + '">' +
      '<div class="cm-task-top">' +
        '<div><div class="cm-task-title">' + taskLabel(task) + '</div>' +
        '<div class="cm-task-meta">' + (done
          ? (offlineOnly ? ('⏳ ' + t('photosCount', { count: saved.length }) + ' · sync') : t('photosCount', { count: saved.length }))
          : t('noPhotosYet')) + '</div></div>' +
        '<div class="cm-done-dot' + (done ? ' on' : '') + (offlineOnly ? ' pending' : '') + '"></div>' +
      '</div>';
    if (saved.length || pending.length) {
      html += '<div class="cm-thumbs">';
      saved.forEach(function (ph) {
        html += '<div class="cm-thumb"><img src="' + ph.image + '" alt="" data-open="' + encodeURIComponent(ph.image) + '">' +
          sourceBadgeHtml(ph.source) + '</div>';
      });
      pending.forEach(function (it, idx) {
        html += '<div class="cm-thumb"><img src="' + it.preview + '" alt="">' +
          sourceBadgeHtml(it.source) +
          '<button type="button" data-rm="' + key + '" data-idx="' + idx + '" aria-label="' + t('removePhoto') + '">×</button></div>';
      });
      html += '</div>';
    }
    var room = MAX_PHOTOS - saved.length - pending.length;
    html += '<div class="cm-actions">';
    if (room > 0) {
      var camId = photoInputId('Cam', p, gi, ti, slot);
      var galId = photoInputId('Gal', p, gi, ti, slot);
      html += '<button type="button" class="cm-btn cm-btn-soft" data-addphoto="' + key + '">' + t('addPhoto') + '</button>';
      html += '<input id="' + camId + '" class="cm-file" type="file" accept="image/*" capture="environment" data-cam="' + key + '" data-source="camera">';
      html += '<input id="' + galId + '" class="cm-file" type="file" accept="image/*" data-cam="' + key + '" data-source="gallery" multiple>';
    }
    if (pending.length) {
      html += '<button type="button" class="cm-btn" data-confirm="' + key + '">' + t('confirmSave') + '</button>';
    }
    html += '</div><div class="cm-task-meta">' + t('cameraOrUpload') + '</div></div>';
    return html;
  }

  function renderTasks() {
    var host = document.getElementById('cmTaskPane');
    if (!host) return;
    var p = state.project;
    if (!p || !TASK_MAP[p]) {
      host.innerHTML = '<div class="cm-empty">' + t('myProjects') + '</div>';
      return;
    }
    var dg = dailyGroup(p);
    var wk = selectedWeek(p);
    var html = '<div class="cm-card"><button type="button" class="cm-btn cm-btn-ghost" id="cmBackProjects">' + t('back') + '</button>' +
      '<h2 style="margin:12px 0 4px;font-size:1.15rem;">' + (PROJECT_NAMES[p] || p) + '</h2>' +
      '<p class="cm-hint">' + t('taskDoneHint') + '</p>';

    html += '<div class="cm-week-row">';
    for (var w = 1; w <= 4; w++) {
      var acc = weekAccessible(p, w);
      var sel = wk === w;
      var cnt = dg ? dailyCovered(p, w) : 0;
      var total = dg ? dg.tasks.length : 0;
      html += '<button type="button" class="cm-week' + (sel ? ' active' : '') + (acc ? '' : ' locked') + '" data-week="' + w + '"' + (acc ? '' : ' disabled') + '>' +
        (acc ? '' : '🔒 ') + t('week', { n: w }) + ' ' + t('weekProgress', { done: cnt, total: total }) +
        '</button>';
    }
    html += '</div>';
    if (dg && dailyComplete(p, wk)) {
      html += '<p class="cm-hint" style="color:var(--cm-ok);">' + t('weekComplete') + '</p>';
    }

    (TASK_MAP[p].groups || []).forEach(function (g, gi) {
      if (g.daily) {
        html += '<h3 style="margin:16px 0 8px;font-size:0.95rem;">' + t('dailyTasks') + ' — ' + t('week', { n: wk }) + '</h3>';
        g.tasks.forEach(function (_task, ti) { html += renderTaskCard(p, gi, ti); });
      } else {
        html += '<h3 style="margin:16px 0 8px;font-size:0.95rem;">' + groupLabel(g) + '</h3>';
        g.tasks.forEach(function (_task, ti) { html += renderTaskCard(p, gi, ti); });
      }
    });
    html += '</div>';
    host.innerHTML = html;

    var back = document.getElementById('cmBackProjects');
    if (back) back.onclick = function () { state.project = null; state.view = 'projects'; renderAll(); };

    host.querySelectorAll('[data-week]').forEach(function (btn) {
      btn.onclick = function () {
        var w = Number(btn.getAttribute('data-week'));
        if (!weekAccessible(p, w)) return;
        state.week[p] = w;
        renderTasks();
      };
    });
    host.querySelectorAll('[data-addphoto]').forEach(function (btn) {
      btn.onclick = function () {
        var pk = parsePendingKey(btn.getAttribute('data-addphoto'));
        openPhotoPicker(pk.p, pk.gi, pk.ti);
      };
    });
    host.querySelectorAll('[data-cam]').forEach(function (inp) {
      inp.onchange = function () {
        var pk = parsePendingKey(inp.getAttribute('data-cam'));
        onPhotoFiles(pk.p, pk.gi, pk.ti, inp.files, inp.getAttribute('data-source') || 'camera');
        inp.value = '';
      };
    });
    host.querySelectorAll('[data-confirm]').forEach(function (btn) {
      btn.onclick = function () {
        var pk = parsePendingKey(btn.getAttribute('data-confirm'));
        confirmSave(pk.p, pk.gi, pk.ti);
      };
    });
    host.querySelectorAll('[data-rm]').forEach(function (btn) {
      btn.onclick = function () {
        var pk = parsePendingKey(btn.getAttribute('data-rm'));
        removePending(pk.p, pk.gi, pk.ti, Number(btn.getAttribute('data-idx')));
      };
    });
    host.querySelectorAll('[data-open]').forEach(function (img) {
      img.onclick = function () { openModal(decodeURIComponent(img.getAttribute('data-open'))); };
    });
  }

  function nonDailyCovered(p, g) {
    if (!g || !g.tasks) return 0;
    return g.tasks.filter(function (task) { return photosFor(p, g, task, 1).length > 0; }).length;
  }

  function renderAnalytics() {
    var host = document.getElementById('cmAnalytics');
    if (!host) return;
    var list = userProjects();
    var html = '<div class="cm-card"><h2 style="margin:0 0 10px;font-size:1.1rem;">' + t('analytics') + ' — ' + curMonth() + '</h2>';
    if (!list.length) {
      html += '<div class="cm-empty">' + t('noProjects') + '</div></div>';
      host.innerHTML = html;
      return;
    }
    list.forEach(function (p) {
      var dg = dailyGroup(p);
      html += '<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--cm-border);">' +
        '<strong>' + (PROJECT_NAMES[p] || p) + '</strong>';
      for (var w = 1; w <= 4; w++) {
        var done = dg ? dailyCovered(p, w) : 0;
        var total = dg ? dg.tasks.length : 0;
        html += '<div class="cm-task-meta">' + t('week', { n: w }) + ': ' + t('weekProgress', { done: done, total: total }) +
          (weekAccessible(p, w) ? '' : ' 🔒') + '</div>';
      }
      (TASK_MAP[p].groups || []).forEach(function (g) {
        if (g.daily) return;
        var nDone = nonDailyCovered(p, g);
        html += '<div class="cm-task-meta">' + groupLabel(g) + ': ' +
          t('weekProgress', { done: nDone, total: g.tasks.length }) + '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function renderMonthlyTaskRow(p, g, task, wk) {
    var ph = photosFor(p, g, task, wk);
    var html = '<div class="cm-task"><div class="cm-task-title">' + taskLabel(task) +
      (g.daily ? (' <span class="cm-task-meta">· ' + t('week', { n: wk }) + '</span>') : '') +
      '</div>' +
      '<div class="cm-task-meta">' + (ph.length ? t('photosCount', { count: ph.length }) : t('noPhotosYet')) + '</div>';
    if (ph.length) {
      html += '<div class="cm-thumbs">';
      ph.forEach(function (x) {
        html += '<div class="cm-thumb"><img src="' + x.image + '" data-open="' + encodeURIComponent(x.image) + '" alt="">' +
          sourceBadgeHtml(x.source) + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderMonthly() {
    var host = document.getElementById('cmMonthly');
    if (!host) return;
    var list = userProjects();
    var html = '<div class="cm-card"><h2 style="margin:0 0 10px;font-size:1.1rem;">' + t('monthly') + ' — ' + curMonth() + '</h2>';
    if (!list.length) {
      html += '<div class="cm-empty">' + t('noProjects') + '</div></div>';
      host.innerHTML = html;
      return;
    }
    list.forEach(function (p) {
      var groups = TASK_MAP[p].groups || [];
      html += '<h3 style="margin:14px 0 8px;">' + (PROJECT_NAMES[p] || p) + '</h3>';
      groups.forEach(function (g) {
        html += '<div class="cm-task-meta" style="margin-bottom:6px;font-weight:600;">' +
          groupLabel(g) + '</div>';
        if (g.daily) {
          for (var w = 1; w <= 4; w++) {
            html += '<div class="cm-task-meta" style="margin:8px 0 4px;">' + t('week', { n: w }) +
              ' — ' + t('weekProgress', { done: dailyCovered(p, w), total: g.tasks.length }) + '</div>';
            g.tasks.forEach(function (task) {
              html += renderMonthlyTaskRow(p, g, task, w);
            });
          }
        } else {
          g.tasks.forEach(function (task) {
            html += renderMonthlyTaskRow(p, g, task, 1);
          });
        }
      });
    });
    html += '</div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-open]').forEach(function (img) {
      img.onclick = function () { openModal(decodeURIComponent(img.getAttribute('data-open'))); };
    });
  }

  function renderAll() {
    var userEl = document.getElementById('cmUserLabel');
    if (userEl) userEl.textContent = (empireGetUser() || '') + ' · ' + t('appSub');

    document.querySelectorAll('.cm-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === state.tab);
    });

    var proj = document.getElementById('cmProjectsWrap');
    var tasks = document.getElementById('cmTasksWrap');
    var analytics = document.getElementById('cmAnalyticsWrap');
    var monthly = document.getElementById('cmMonthlyWrap');
    if (proj) proj.style.display = state.tab === 'tasks' && !state.project ? '' : 'none';
    if (tasks) tasks.style.display = state.tab === 'tasks' && state.project ? '' : 'none';
    if (analytics) analytics.style.display = state.tab === 'analytics' ? '' : 'none';
    if (monthly) monthly.style.display = state.tab === 'monthly' ? '' : 'none';

    if (state.tab === 'tasks') {
      if (state.project) renderTasks();
      else renderProjects();
    } else if (state.tab === 'analytics') renderAnalytics();
    else if (state.tab === 'monthly') renderMonthly();

    updateGpsChip();
    refreshOfflineBanner();
  }

  function setupPush() {
    var chip = document.getElementById('cmPushChip');
    var btn = document.getElementById('cmPushBtn');
    function markReady() {
      if (chip) { chip.className = 'cm-chip ok'; chip.textContent = t('pushReady'); chip.style.display = ''; }
      if (btn) btn.style.display = 'none';
    }
    function markNeed() {
      if (chip) { chip.className = 'cm-chip warn'; chip.textContent = t('pushHint'); chip.style.display = ''; }
      if (btn) btn.style.display = '';
    }
    try {
      if (localStorage.getItem('empire_push_ok_' + String(empireGetUser() || '').toLowerCase()) === '1') {
        markReady();
        return;
      }
    } catch (e) {}
    markNeed();
    if (!btn) return;
    btn.onclick = function () {
      enableCleaningPush().then(markReady).catch(function () { alert(t('pushHint')); });
    };
  }

  function enableCleaningPush() {
    if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG.apiKey) {
      return Promise.reject(new Error('Firebase not configured'));
    }
    if (!('Notification' in window)) return Promise.reject(new Error('No Notification API'));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('denied');
      if (typeof firebase === 'undefined') throw new Error('firebase missing');
      return navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './', updateViaCache: 'none' })
        .then(function () { return navigator.serviceWorker.ready; })
        .then(function (reg) {
          if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
          return firebase.messaging().getToken({ vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
        })
        .then(function (fcmToken) {
          return api({
            action: 'saveWorkerPushToken',
            username: empireGetUser(),
            fcmToken: fcmToken,
            platform: 'web-fcm'
          }).then(function (d) {
            if (d && (d.ok || d.success)) {
              try { localStorage.setItem('empire_push_ok_' + String(empireGetUser() || '').toLowerCase(), '1'); } catch (e) {}
              scheduleDailyLocalReminder();
              return true;
            }
            throw new Error((d && d.message) || 'save failed');
          });
        });
    });
  }

  function scheduleDailyLocalReminder() {
    try {
      var key = 'cm_daily_' + todayStr() + '_' + String(empireGetUser() || '').toLowerCase();
      if (localStorage.getItem(key) === '1') return;
      if (Notification.permission === 'granted') {
        // Soft daily nudge when app opens in the morning hours
        var h = new Date().getHours();
        if (h >= 7 && h <= 11) {
          localNotify(t('appTitle'), "Don't forget today's cleaning tasks.");
          localStorage.setItem(key, '1');
        }
      }
    } catch (e) {}
  }

  function canUseCleaningMobile(d) {
    // Dedicated supervisor page: any successful login stays in.
    return !!(d && (d.ok || d.success) && d.token);
  }

  function enterApp() {
    document.body.classList.add('cleaning-supervisor-mode');
    showView('app');
    if (typeof cleaningSetLang === 'function') cleaningSetLang(cleaningGetLang());
    applyLangUi();
    setupPush();
    scheduleDailyLocalReminder();
    loadPhotos(true);
    syncOffline(true);
    startPhotosAutoSync();
    setTimeout(function () { startGps(); }, 2500);
  }

  function handleLogin(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    var msg = document.getElementById('cmLoginMsg');
    var btn = document.getElementById('cmLoginBtn');
    var userEl = document.getElementById('cmUsername');
    var passEl = document.getElementById('cmPassword');
    var username = userEl ? String(userEl.value || '').trim() : '';
    var password = passEl ? String(passEl.value || '') : '';
    if (!username || !password) {
      setMsg(msg, 'Enter username and password.', true);
      return false;
    }
    if (btn) btn.disabled = true;
    setMsg(msg, t('signingIn'), false);
    empireLogin({
      username: username,
      password: password,
      dept: 'cleaning',
      messageEl: msg
    }).then(function (d) {
      if (!canUseCleaningMobile(d)) {
        setMsg(msg, t('notSupervisor') + ' (role: ' + String((d && d.role) || 'none') + ')', true);
        if (btn) btn.disabled = false;
        return;
      }
      empireSetSession(username, d);
      empireClearLegacyKeys();
      if (typeof empireAuthSet === 'function') {
        empireAuthSet('role', 'cleaning_supervisor');
        if (d.perms) empireAuthSet('perms', JSON.stringify(d.perms));
      }
      state.loginGraceUntil = Date.now() + 15000;
      state.photoLoadTries = 0;
      enterApp();
      if (btn) btn.disabled = false;
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      setMsg(msg, '❌ ' + ((err && err.message) || 'Login failed'), true);
    });
    return false;
  }

  function boot() {
    bootTheme();
    if (typeof cleaningSetLang === 'function') cleaningSetLang(cleaningGetLang());
    empireMigrateSession();

    var btn = document.getElementById('cmLoginBtn');
    if (btn) btn.onclick = function (ev) { handleLogin(ev); return false; };
    var passEl = document.getElementById('cmPassword');
    if (passEl) {
      passEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          handleLogin(ev);
        }
      });
    }
    var userEl = document.getElementById('cmUsername');
    if (userEl) {
      userEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          var p = document.getElementById('cmPassword');
          if (p) p.focus();
        }
      });
    }
    var langBtn = document.getElementById('cmLangBtn');
    if (langBtn) langBtn.onclick = toggleLang;
    var langBtn2 = document.getElementById('cmLangBtn2');
    if (langBtn2) langBtn2.onclick = toggleLang;
    var themeBtn = document.getElementById('cmThemeBtn');
    if (themeBtn) themeBtn.onclick = toggleTheme;
    var logoutBtn = document.getElementById('cmLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        empireAuthWorkerLogout({
          beforeLogout: function () {
            if (state.gpsWatch != null) {
              try { navigator.geolocation.clearWatch(state.gpsWatch); } catch (e) {}
            }
          },
          redirect: 'cleaning-mobile.html',
          reload: false
        });
      };
    }
    var refreshBtn = document.getElementById('cmRefreshBtn');
    if (refreshBtn) refreshBtn.onclick = function () { loadPhotos(true); syncOffline(true); reportLiveGps(true); };
    document.querySelectorAll('.cm-tab').forEach(function (tabBtn) {
      tabBtn.onclick = function () {
        state.tab = tabBtn.getAttribute('data-tab');
        if (state.tab !== 'tasks') state.project = null;
        renderAll();
      };
    });
    var modal = document.getElementById('cmModal');
    if (modal) modal.onclick = closeModal;

    window.addEventListener('online', function () { syncOffline(true); });

    // Dedicated page: any existing token stays logged in (no role gate that sends you back).
    if (empireGetToken()) {
      if (typeof empireAuthSet === 'function') empireAuthSet('role', 'cleaning_supervisor');
      state.loginGraceUntil = Date.now() + 15000;
      enterApp();
      return;
    }
    showView('login');
    applyLangUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
