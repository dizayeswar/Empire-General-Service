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
    return state.photos.filter(function (x) {
      return String(x.project).toLowerCase() === String(p).toLowerCase() &&
        x.task === task && x.period === period;
    });
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

  function pendingKey(p, gi, ti) { return p + '|' + gi + '|' + ti; }

  function ensurePending(key) {
    if (!state.pending[key]) state.pending[key] = [];
    return state.pending[key];
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

  async function api(body) {
    return fetchJSONRetry(Object.assign({ token: empireGetToken() || '' }, body), 2);
  }

  async function loadPhotos(force) {
    var mv = curMonth();
    try {
      var d = await api({ action: 'getTaskPhotos', periodPrefix: mv });
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
      state.photoLoadTries = 0;
      var list = Array.isArray(d) ? d : [];
      var allowed = userProjects();
      state.photos = list.filter(function (x) {
        return !allowed.length || allowed.indexOf(String(x.project || '').toLowerCase()) !== -1;
      });
      await restoreOfflinePlaceholders();
      renderAll();
    } catch (e) {
      console.warn(e);
    }
  }

  function compressPreview(file) {
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
    for (var i = 0; i < items.length; i++) {
      photoGps.push(items[i].gps || null);
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
      photoGps: photoGps
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
        _offline: true,
        _queueId: id
      });
    });
    await refreshOfflineBanner();
  }

  async function restoreOfflinePlaceholders() {
    if (typeof empireOfflineQueueAll !== 'function') return;
    var rows = await empireOfflineQueueAll();
    rows.filter(function (r) { return r.type === 'cleaning_task_photos'; }).forEach(function (item) {
      if (state.photos.some(function (x) { return x._queueId === item.id; })) return;
      var idx = 0;
      (item.imageDataUrls || []).forEach(function (dataUrl) {
        state.photos.push({
          id: 'offline-' + item.id + '-' + (idx++),
          project: item.project,
          freq: item.freq,
          task: item.task,
          date: item.date,
          period: item.period,
          image: dataUrl,
          _offline: true,
          _queueId: item.id
        });
      });
      (item.remoteUrls || []).forEach(function (url) {
        state.photos.push({
          id: 'offline-' + item.id + '-' + (idx++),
          project: item.project,
          freq: item.freq,
          task: item.task,
          date: item.date,
          period: item.period,
          image: url,
          _offline: true,
          _queueId: item.id
        });
      });
    });
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
    if (state.syncing) return;
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
          var remoteUrls = (item.remoteUrls || []).slice();
          var dataUrls = item.imageDataUrls || [];
          for (var bi = 0; bi < dataUrls.length; bi++) {
            var blob = empireOfflineDataUrlToBlob(dataUrls[bi]);
            if (!blob) throw new Error('Invalid saved image');
            var url = await uploadBlob(blob);
            if (!url) throw new Error('Photo upload failed');
            remoteUrls.push(url);
          }
          if (!remoteUrls.length) throw new Error('No photos');
          var batch = await api({
            action: 'addTaskPhotos',
            project: item.project,
            freq: item.freq,
            task: item.task,
            date: item.date,
            period: item.period,
            images: remoteUrls,
            photoGps: item.photoGps || []
          });
          if (batch && batch.ok === false) throw new Error(batch.message || batch.error || 'save failed');
          state.photos = state.photos.filter(function (x) { return x._queueId !== item.id; });
          await empireOfflineQueueDelete(item.id);
          synced++;
          checkWeekCompletionAfterSave(item.project);
        } catch (e) {
          console.warn('offline sync failed', e);
        }
      }
      if (synced) {
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
    var key = pendingKey(p, gi, ti);
    var items = ensurePending(key);
    if (!items.length) return;
    var g = TASK_MAP[p].groups[gi];
    var task = g.tasks[ti];
    var freq = g.daily ? 'daily' : g.freq;
    var wk = selectedWeek(p);
    var period = g.daily ? (curMonth() + '#' + wk) : curMonth();
    var date = todayStr();
    var btn = document.querySelector('[data-confirm="' + key + '"]');
    if (btn) { btn.disabled = true; btn.textContent = t('saving'); }

    if (!navigator.onLine) {
      try {
        await enqueueOffline(p, freq, task, period, date, items);
        delete state.pending[key];
        renderTasks();
        alert(t('savedOffline'));
      } catch (e) {
        alert(e.message || String(e));
      }
      if (btn) { btn.disabled = false; btn.textContent = t('confirmSave'); }
      return;
    }

    try {
      var remoteUrls = [];
      var photoGps = [];
      for (var i = 0; i < items.length; i++) {
        if (btn) btn.textContent = t('uploading') + ' ' + (i + 1) + '/' + items.length;
        var url = items[i].remote;
        if (!url) {
          url = await uploadBlob(items[i].blob);
          if (!url) throw new Error('Upload failed');
        }
        remoteUrls.push(url);
        photoGps.push(items[i].gps || state.lastGps || null);
      }
      var batch = await api({
        action: 'addTaskPhotos',
        project: p,
        freq: freq,
        task: task,
        date: date,
        period: period,
        images: remoteUrls,
        photoGps: photoGps
      });
      if (batch && batch.ok === false) throw new Error(batch.message || batch.error || 'Save failed');
      var saved = (batch && batch.items) || remoteUrls.map(function (u, idx) { return { id: 'tmp' + Date.now() + idx, image: u }; });
      saved.forEach(function (row, idx) {
        state.photos.push({
          id: row.id,
          project: p,
          freq: freq,
          task: task,
          date: date,
          period: period,
          image: row.image || remoteUrls[idx]
        });
      });
      items.forEach(function (it) {
        if (it.preview && String(it.preview).indexOf('blob:') === 0) {
          try { URL.revokeObjectURL(it.preview); } catch (e) {}
        }
      });
      delete state.pending[key];
      checkWeekCompletionAfterSave(p);
      renderTasks();
    } catch (e) {
      try {
        await enqueueOffline(p, freq, task, period, date, items);
        delete state.pending[key];
        renderTasks();
        alert(t('savedOffline'));
      } catch (err) {
        alert(e.message || String(e));
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = t('confirmSave'); }
    }
  }

  async function onCameraFiles(p, gi, ti, files) {
    if (!files || !files.length) return;
    var key = pendingKey(p, gi, ti);
    var list = ensurePending(key);
    var existing = photosFor(p, TASK_MAP[p].groups[gi], TASK_MAP[p].groups[gi].tasks[ti], selectedWeek(p)).length;
    var room = MAX_PHOTOS - existing - list.length;
    if (room <= 0) {
      alert(t('photoMax'));
      return;
    }
    var arr = Array.prototype.slice.call(files, 0, room);
    for (var i = 0; i < arr.length; i++) {
      var item = await compressPreview(arr[i]);
      if (item) list.push(item);
    }
    renderTasks();
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
    var g = TASK_MAP[p].groups[gi];
    var task = g.tasks[ti];
    var wk = selectedWeek(p);
    var saved = photosFor(p, g, task, wk);
    var key = pendingKey(p, gi, ti);
    var pending = ensurePending(key);
    var done = saved.length > 0;
    var html = '<div class="cm-task">' +
      '<div class="cm-task-top">' +
        '<div><div class="cm-task-title">' + task + '</div>' +
        '<div class="cm-task-meta">' + (done ? ('✓ ' + saved.length + ' photo') : t('noPhotosYet')) + '</div></div>' +
        '<div class="cm-done-dot' + (done ? ' on' : '') + '"></div>' +
      '</div>';
    if (saved.length || pending.length) {
      html += '<div class="cm-thumbs">';
      saved.forEach(function (ph) {
        html += '<div class="cm-thumb"><img src="' + ph.image + '" alt="" data-open="' + encodeURIComponent(ph.image) + '"></div>';
      });
      pending.forEach(function (it, idx) {
        html += '<div class="cm-thumb"><img src="' + it.preview + '" alt="">' +
          '<button type="button" data-rm="' + key + '" data-idx="' + idx + '" aria-label="' + t('removePhoto') + '">×</button></div>';
      });
      html += '</div>';
    }
    var room = MAX_PHOTOS - saved.length - pending.length;
    html += '<div class="cm-actions">';
    if (room > 0) {
      html += '<label class="cm-btn cm-btn-soft" style="display:inline-flex;align-items:center;">' + t('takePhoto') +
        '<input class="cm-file" type="file" accept="image/*" capture="environment" data-cam="' + key + '"></label>';
    }
    if (pending.length) {
      html += '<button type="button" class="cm-btn" data-confirm="' + key + '">' + t('confirmSave') + '</button>';
    }
    html += '</div><div class="cm-task-meta">' + t('cameraOnly') + '</div></div>';
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
        html += '<h3 style="margin:16px 0 8px;font-size:0.95rem;">' + (g.label || t('otherTasks')) + '</h3>';
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
    host.querySelectorAll('[data-cam]').forEach(function (inp) {
      inp.onchange = function () {
        var parts = inp.getAttribute('data-cam').split('|');
        onCameraFiles(parts[0], Number(parts[1]), Number(parts[2]), inp.files);
        inp.value = '';
      };
    });
    host.querySelectorAll('[data-confirm]').forEach(function (btn) {
      btn.onclick = function () {
        var parts = btn.getAttribute('data-confirm').split('|');
        confirmSave(parts[0], Number(parts[1]), Number(parts[2]));
      };
    });
    host.querySelectorAll('[data-rm]').forEach(function (btn) {
      btn.onclick = function () {
        var parts = btn.getAttribute('data-rm').split('|');
        removePending(parts[0], Number(parts[1]), Number(parts[2]), Number(btn.getAttribute('data-idx')));
      };
    });
    host.querySelectorAll('[data-open]').forEach(function (img) {
      img.onclick = function () { openModal(decodeURIComponent(img.getAttribute('data-open'))); };
    });
  }

  function renderAnalytics() {
    var host = document.getElementById('cmAnalytics');
    if (!host) return;
    var list = userProjects();
    var html = '<div class="cm-card"><h2 style="margin:0 0 10px;font-size:1.1rem;">' + t('analytics') + ' — ' + curMonth() + '</h2>';
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
      html += '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function renderMonthly() {
    var host = document.getElementById('cmMonthly');
    if (!host) return;
    var list = userProjects();
    var html = '<div class="cm-card"><h2 style="margin:0 0 10px;font-size:1.1rem;">' + t('monthly') + ' — ' + curMonth() + '</h2>';
    list.forEach(function (p) {
      var groups = TASK_MAP[p].groups || [];
      html += '<h3 style="margin:14px 0 8px;">' + (PROJECT_NAMES[p] || p) + '</h3>';
      groups.forEach(function (g) {
        html += '<div class="cm-task-meta" style="margin-bottom:6px;">' + (g.labelKey ? t(g.labelKey) : g.label) + '</div>';
        g.tasks.forEach(function (task) {
          var wk = g.daily ? selectedWeek(p) : 1;
          var ph = photosFor(p, g, task, wk);
          html += '<div class="cm-task"><div class="cm-task-title">' + task + '</div>' +
            '<div class="cm-task-meta">' + (ph.length ? (ph.length + ' photo') : t('noPhotosYet')) + '</div>';
          if (ph.length) {
            html += '<div class="cm-thumbs">';
            ph.forEach(function (x) {
              html += '<div class="cm-thumb"><img src="' + x.image + '" data-open="' + encodeURIComponent(x.image) + '" alt=""></div>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
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
