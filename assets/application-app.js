/* Application — door-to-door app registration checks (RA, WW, WD, ES) */

var APP_DEPT = 'application';
var APP_PROJECTS = ['RA', 'WW', 'WD', 'ES'];
var APP_STATUS_OPTIONS = [
  '',
  'ACTIVE',
  'NEW ACTIVE',
  'NEW ACTIVE REMOVED OLD',
  'PENDING',
  'CHECK AGAIN',
  'TRY TO REACH',
  'COME BACK LATER',
  'HE DOESN\'T WANT THE APP'
];
var APP_SEED_URL = 'assets/application-seed.json?v=2026-07-22-application-v4';
var _appRows = [];
var _appSaving = {};
var _appExpectedTotal = 0;
var _appExpectedByProject = {};
var _appSeedItems = null;

function appToken_() { return empireGetToken() || ''; }
function appEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function appPropertySortKey_(propertyId) {
  return String(propertyId || '').toUpperCase().split('-').map(function (part) {
    if (part === 'G') return '0';
    var m = part.match(/^([A-Z]*)(\d+)$/);
    if (m) return m[1] + ('00000' + m[2]).slice(-5);
    if (/^\d+$/.test(part)) return ('00000' + part).slice(-5);
    return part;
  }).join('\u0000');
}

function appSortRows_(rows) {
  return rows.slice().sort(function (a, b) {
    var ka = appPropertySortKey_(a.propertyId);
    var kb = appPropertySortKey_(b.propertyId);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return String(a.propertyId || '').localeCompare(String(b.propertyId || ''));
  });
}

function appStatusClass_(status) {
  var s = String(status || '').trim().toUpperCase();
  if (!s) return 'app-status-empty';
  if (s.indexOf('WANT') !== -1) return 'app-status-refused';
  if (s.indexOf('NEW ACTIVE') !== -1) return 'app-status-new-active';
  if (s === 'ACTIVE') return 'app-status-active';
  if (s === 'PENDING') return 'app-status-pending';
  if (s === 'CHECK AGAIN') return 'app-status-check-again';
  if (s === 'TRY TO REACH') return 'app-status-try-reach';
  return 'app-status-follow';
}

function appCountByProject_(rows) {
  var out = {};
  rows.forEach(function (r) {
    var p = String(r.project || '').toUpperCase();
    if (!p) return;
    out[p] = (out[p] || 0) + 1;
  });
  return out;
}

function appFilteredRows_() {
  var project = String((document.getElementById('appFilterProject') || {}).value || '').trim().toUpperCase();
  var status = String((document.getElementById('appFilterStatus') || {}).value || '').trim().toUpperCase();
  var q = String((document.getElementById('appFilterSearch') || {}).value || '').trim().toLowerCase();
  return _appRows.filter(function (r) {
    if (project && String(r.project || '').toUpperCase() !== project) return false;
    var st = String(r.status || '').toUpperCase();
    if (status === '__EMPTY__') {
      if (st) return false;
    } else if (status && st !== status) return false;
    if (q) {
      var blob = (r.propertyId + ' ' + r.phone + ' ' + r.status).toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function appStatusColor_(status) {
  var s = String(status || '').trim().toUpperCase();
  if (!s) return '#b71c1c';
  if (s.indexOf('WANT') !== -1) return '#9e9e9e';
  if (s.indexOf('NEW ACTIVE') !== -1) return '#95b825';
  if (s === 'ACTIVE') return '#2e7d32';
  if (s === 'PENDING') return '#29b6f6';
  if (s === 'CHECK AGAIN') return '#f9a825';
  if (s === 'TRY TO REACH') return '#1565c0';
  return '#e65100';
}

function appStatusLabel_(status) {
  var s = String(status || '').trim().toUpperCase();
  return s || 'Not visited';
}

function appSummaryFilteredRows_() {
  var project = String((document.getElementById('appSummaryProject') || {}).value || '').trim().toUpperCase();
  if (!project) return _appRows.slice();
  return _appRows.filter(function (r) {
    return String(r.project || '').toUpperCase() === project;
  });
}

function appStatusCounts_(rows) {
  var counts = {};
  rows.forEach(function (r) {
    var key = appStatusLabel_(r.status);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function appSummaryStatusOrder_(a, b, counts) {
  var order = {
    'ACTIVE': 1,
    'NEW ACTIVE': 2,
    'NEW ACTIVE REMOVED OLD': 3,
    'PENDING': 4,
    'CHECK AGAIN': 5,
    'TRY TO REACH': 6,
    'COME BACK LATER': 7,
    'HE DOESN\'T WANT THE APP': 8,
    'Not visited': 9
  };
  var oa = order[a] || 50;
  var ob = order[b] || 50;
  if (oa !== ob) return oa - ob;
  return counts[b] - counts[a];
}

function appDonutHtml_(segments, total) {
  if (!total) return '<p class="worker-empty">No apartments for this project yet.</p>';
  var offset = 25;
  var circles = '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="5"></circle>';
  segments.forEach(function (seg) {
    if (!seg.count) return;
    var pct = seg.count / total * 100;
    circles += '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + appEsc_(seg.color) + '" stroke-width="5" stroke-dasharray="' + pct + ' ' + (100 - pct) + '" stroke-dashoffset="' + offset + '"></circle>';
    offset -= pct;
  });
  var legend = segments.map(function (seg) {
    if (!seg.count) return '';
    var pct = Math.round(seg.count / total * 100);
    return '<div class="app-donut-legend-item">'
      + '<span class="app-donut-swatch" style="background:' + appEsc_(seg.color) + '"></span>'
      + '<span class="app-donut-legend-label">' + appEsc_(seg.label) + '</span>'
      + '<strong>' + seg.count + '</strong>'
      + '<span class="app-donut-legend-pct">' + pct + '%</span>'
      + '</div>';
  }).join('');
  return '<div class="app-donut-board">'
    + '<svg class="app-donut-chart" width="220" height="220" viewBox="0 0 42 42" aria-hidden="true">' + circles
    + '<text x="21" y="20.2" text-anchor="middle" class="app-donut-total">' + total + '</text>'
    + '<text x="21" y="26.2" text-anchor="middle" class="app-donut-sub">apartments</text></svg>'
    + '<div class="app-donut-legend">' + legend + '</div></div>';
}

function appMiniDonutHtml_(label, rows) {
  var counts = appStatusCounts_(rows);
  var total = rows.length;
  var active = (counts.ACTIVE || 0) + (counts['NEW ACTIVE'] || 0) + (counts['NEW ACTIVE REMOVED OLD'] || 0);
  var pending = (counts.PENDING || 0) + (counts['CHECK AGAIN'] || 0) + (counts['TRY TO REACH'] || 0) + (counts['COME BACK LATER'] || 0);
  var other = total - active - pending - (counts['Not visited'] || 0);
  var segments = [
    { count: active, color: '#2e7d32' },
    { count: pending, color: '#1565c0' },
    { count: counts['Not visited'] || 0, color: '#b71c1c' },
    { count: other, color: '#9e9e9e' }
  ].filter(function (s) { return s.count > 0; });
  var offset = 25;
  var circles = '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="6"></circle>';
  if (total) {
    segments.forEach(function (seg) {
      var pct = seg.count / total * 100;
      circles += '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + seg.color + '" stroke-width="6" stroke-dasharray="' + pct + ' ' + (100 - pct) + '" stroke-dashoffset="' + offset + '"></circle>';
      offset -= pct;
    });
  }
  return '<div class="app-mini-donut"><svg width="96" height="96" viewBox="0 0 42 42">' + circles
    + '<text x="21" y="24" text-anchor="middle" class="app-mini-donut-num">' + total + '</text></svg>'
    + '<div class="app-mini-donut-label">' + appEsc_(label) + '</div></div>';
}

function appSummaryHtml_(rows) {
  var counts = appStatusCounts_(rows);
  var keys = Object.keys(counts).sort(function (a, b) {
    return appSummaryStatusOrder_(a, b, counts);
  });
  var total = rows.length;
  var segments = keys.map(function (k) {
    return { label: k, count: counts[k], color: appStatusColor_(k === 'Not visited' ? '' : k) };
  });
  var h = '<div class="app-summary-top"><strong>' + total + ' apartments</strong></div>';
  h += appDonutHtml_(segments, total);
  h += '<div class="app-summary-grid">';
  keys.forEach(function (k) {
    var cls = appStatusClass_(k === 'Not visited' ? '' : k);
    h += '<div class="app-summary-card"><strong>' + counts[k] + '</strong>'
      + '<span class="app-status-badge ' + cls + '">' + appEsc_(k) + '</span></div>';
  });
  h += '</div>';
  var projSel = String((document.getElementById('appSummaryProject') || {}).value || '');
  if (!projSel) {
    h += '<h3 class="app-summary-subhead">By project</h3><div class="app-mini-donut-row">';
    APP_PROJECTS.forEach(function (p) {
      var proRows = _appRows.filter(function (r) { return String(r.project || '').toUpperCase() === p; });
      h += appMiniDonutHtml_(p, proRows);
    });
    h += '</div>';
  }
  return h;
}

function appRenderSummary_() {
  var host = document.getElementById('appSummaryHost');
  if (!host) return;
  appPopulateSummaryFilters_();
  host.innerHTML = appSummaryHtml_(appSummaryFilteredRows_());
}

function appPopulateSummaryFilters_() {
  var sp = document.getElementById('appSummaryProject');
  if (sp && sp.options.length <= 1) {
    sp.innerHTML = '<option value="">All projects</option>'
      + APP_PROJECTS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
}

function appOnSummaryProjectChange_() {
  var sp = document.getElementById('appSummaryProject');
  var fp = document.getElementById('appFilterProject');
  if (sp && fp) fp.value = sp.value;
  appRenderTable_();
  appRenderSummary_();
}

function appStatusSelectHtml_(id, value) {
  var h = '<select data-app-id="' + appEsc_(id) + '" data-app-field="status" onchange="appSaveRow_(this.getAttribute(\'data-app-id\'))">';
  APP_STATUS_OPTIONS.forEach(function (opt) {
    var sel = String(value || '').toUpperCase() === String(opt || '').toUpperCase() ? ' selected' : '';
    var label = opt || 'Not visited';
    h += '<option value="' + appEsc_(opt) + '"' + sel + '>' + appEsc_(label) + '</option>';
  });
  h += '</select>';
  return h;
}

function appCountsHtml_() {
  var loaded = appCountByProject_(_appRows);
  var parts = APP_PROJECTS.map(function (p) {
    var have = loaded[p] || 0;
    var want = _appExpectedByProject[p] || 0;
    var cls = want && have < want ? ' app-count-warn' : '';
    return '<span class="app-count-chip' + cls + '">' + p + ': ' + have + (want ? (' / ' + want) : '') + '</span>';
  });
  var total = _appRows.length;
  var expected = _appExpectedTotal || 0;
  var head = '<div class="app-counts-bar">';
  head += '<strong>' + total + (expected ? (' / ' + expected) : '') + ' apartments loaded</strong>';
  head += '<div class="app-count-chips">' + parts.join('') + '</div>';
  head += '</div>';
  return head;
}

function appRenderTable_() {
  var host = document.getElementById('appTableHost');
  if (!host) return;
  var rows = appFilteredRows_();
  if (!rows.length) {
    host.innerHTML = appCountsHtml_() + '<p class="worker-empty">No properties match your filters.</p>';
    return;
  }
  var h = appCountsHtml_();
  h += '<div class="app-table-wrap"><table class="app-table"><thead><tr>'
    + '<th>Property</th><th>Project</th><th>Phone</th><th>Account status</th><th>Updated</th>'
    + '</tr></thead><tbody>';
  rows.forEach(function (r) {
    var stClass = appStatusClass_(r.status);
    h += '<tr data-app-id="' + appEsc_(r.id) + '">'
      + '<td><strong>' + appEsc_(r.propertyId) + '</strong></td>'
      + '<td>' + appEsc_(r.project) + '</td>'
      + '<td><input type="text" inputmode="numeric" data-app-id="' + appEsc_(r.id) + '" data-app-field="phone" value="' + appEsc_(r.phone || '') + '" onchange="appSaveRow_(this.getAttribute(\'data-app-id\'))"></td>'
      + '<td>' + appStatusSelectHtml_(r.id, r.status) + '</td>'
      + '<td><span class="app-status-badge ' + stClass + '">' + appEsc_(r.status || 'Not visited') + '</span>'
      + (r.updatedAt ? ('<div style="font-size:11px;color:var(--text-faint);margin-top:4px;">' + appEsc_(r.updatedAt.slice(0, 10)) + '</div>') : '')
      + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<p style="margin-top:10px;font-size:13px;color:var(--text-soft);">' + rows.length + ' shown</p>';
  host.innerHTML = h;
}

function appSaveRow_(id) {
  if (_appSaving[id]) return;
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (!row) return;
  var tr = document.querySelector('tr[data-app-id="' + id + '"]');
  var phoneEl = tr ? tr.querySelector('[data-app-field="phone"]') : null;
  var statusEl = tr ? tr.querySelector('[data-app-field="status"]') : null;
  var phone = phoneEl ? String(phoneEl.value || '').replace(/\D/g, '') : String(row.phone || '');
  var status = statusEl ? String(statusEl.value || '') : String(row.status || '');
  _appSaving[id] = true;
  fetchJSONRetry({
    action: 'updateApplicationCheck',
    token: appToken_(),
    id: id,
    phone: phone,
    status: status
  }, 1, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      row.phone = d.phone != null ? d.phone : phone;
      row.status = d.status != null ? d.status : status;
      row.updatedAt = d.updatedAt || row.updatedAt;
      row.updatedBy = d.updatedBy || row.updatedBy;
      appRenderTable_();
    } else if (d && d.ok === false) {
      alert(d.message || d.error || 'Could not save');
    }
  }).catch(function (e) {
    alert(String((e && e.message) || e || 'Save failed'));
  }).finally(function () {
    delete _appSaving[id];
  });
}

function appPopulateFilters_() {
  var proj = document.getElementById('appFilterProject');
  if (proj && proj.options.length <= 1) {
    proj.innerHTML = '<option value="">All projects</option>'
      + APP_PROJECTS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
  appPopulateSummaryFilters_();
  var st = document.getElementById('appFilterStatus');
  if (st && st.options.length <= 1) {
    var opts = '<option value="">All statuses</option><option value="__EMPTY__">Not visited</option>';
    APP_STATUS_OPTIONS.forEach(function (s) {
      if (!s) return;
      opts += '<option value="' + appEsc_(s) + '">' + appEsc_(s) + '</option>';
    });
    st.innerHTML = opts;
  }
}

function appFetchProjectRows_(project, force) {
  return fetchJSONRetry({
    action: 'getApplicationChecks',
    token: appToken_(),
    project: project
  }, force ? 2 : 1, 120000).then(function (d) {
    return Array.isArray(d) ? d : [];
  });
}

function appLoad_(force) {
  var host = document.getElementById('appTableHost');
  if (host) host.innerHTML = '<p>Loading all projects (RA, WW, WD, ES)…</p>';
  return Promise.all(APP_PROJECTS.map(function (p) {
    return appFetchProjectRows_(p, force);
  })).then(function (parts) {
    _appRows = [];
    parts.forEach(function (rows) {
      _appRows = _appRows.concat(rows);
    });
    _appRows = appSortRows_(_appRows);
    appToggleImportBar_();
    appRenderTable_();
    appRenderSummary_();
  }).catch(function (e) {
    if (host) host.innerHTML = '<p class="worker-empty">Could not load data. ' + appEsc_((e && e.message) || e) + '</p>';
  });
}

function appSeedMetaFromItems_(items) {
  _appExpectedTotal = items.length;
  _appExpectedByProject = {};
  items.forEach(function (it) {
    var p = String(it.project || '').toUpperCase();
    if (!p) return;
    _appExpectedByProject[p] = (_appExpectedByProject[p] || 0) + 1;
  });
}

function appEnsureSeedMeta_() {
  if (_appSeedItems && _appSeedItems.length) {
    appSeedMetaFromItems_(_appSeedItems);
    return Promise.resolve(_appSeedItems);
  }
  return fetch(APP_SEED_URL).then(function (r) { return r.json(); }).then(function (items) {
    if (!Array.isArray(items)) throw new Error('Seed file invalid');
    _appSeedItems = items;
    appSeedMetaFromItems_(items);
    return items;
  });
}

function appToggleImportBar_() {
  var bar = document.getElementById('appImportBar');
  if (!bar) return;
  var isAdmin = String(empireGetRole() || '').toLowerCase() === 'admin';
  if (!isAdmin) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  var msg = document.getElementById('appImportMsg');
  var btn = document.getElementById('appImportBtn');
  if (!msg) return;
  var expected = _appExpectedTotal || 4199;
  var loaded = _appRows.length;
  if (loaded >= expected) {
    msg.textContent = 'All ' + expected + ' apartments loaded. Click sync to refresh from Excel seed.';
    if (btn) btn.textContent = 'Re-sync from Excel';
  } else {
    msg.textContent = loaded + ' / ' + expected + ' apartments loaded — sync to load all RA, WW, WD, ES sheets.';
    if (btn) btn.textContent = 'Sync all apartments from Excel';
  }
}

function appImportBatch_(slice, tries) {
  return fetchJSONRetry({ action: 'importApplicationChecks', token: appToken_(), items: slice }, tries || 3, 180000)
    .then(function (d) {
      if (d && (d.ok || d.success)) return d;
      throw new Error((d && (d.message || d.error)) || 'Import failed');
    });
}

function appImportSeed_(clearFirst) {
  var msg = document.getElementById('appImportMsg');
  var btn = document.getElementById('appImportBtn');
  var clearBtn = document.getElementById('appClearBtn');
  if (btn) btn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
  if (msg) msg.textContent = clearFirst ? 'Clearing old data…' : 'Loading seed file…';

  function runImport() {
    return appEnsureSeedMeta_().then(function (items) {
      if (!items.length) throw new Error('Seed file is empty');
      var chunk = 150;
      var i = 0;
      var inserted = 0;
      var updated = 0;
      function nextBatch() {
        var slice = items.slice(i, i + chunk);
        if (!slice.length) {
          if (msg) msg.textContent = 'Import complete — ' + inserted + ' new, ' + updated + ' updated. Reloading…';
          return appLoad_(true).then(function () {
            if (msg) msg.textContent = 'Sync complete — ' + _appRows.length + ' / ' + _appExpectedTotal + ' apartments loaded.';
            if (btn) btn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
          });
        }
        if (msg) msg.textContent = 'Syncing ' + Math.min(i + chunk, items.length) + ' / ' + items.length + ' apartments…';
        return appImportBatch_(slice, 3).then(function (d) {
          inserted += Number(d.inserted || 0);
          updated += Number(d.updated || 0);
          i += chunk;
          return nextBatch();
        }).catch(function (err) {
          if (msg) msg.textContent = 'Retrying batch at ' + (i + 1) + '… (' + String((err && err.message) || err) + ')';
          return appImportBatch_(slice, 2).then(function (d) {
            inserted += Number(d.inserted || 0);
            updated += Number(d.updated || 0);
            i += chunk;
            return nextBatch();
          });
        });
      }
      return nextBatch();
    });
  }

  var chain = Promise.resolve();
  if (clearFirst) {
    chain = fetchJSONRetry({ action: 'clearApplicationChecks', token: appToken_() }, 2, 60000).then(function (d) {
      if (!d || !(d.ok || d.success)) throw new Error((d && (d.message || d.error)) || 'Could not clear data');
      _appRows = [];
    });
  }
  chain.then(runImport).catch(function (e) {
    if (msg) msg.textContent = 'Sync failed: ' + String((e && e.message) || e);
    if (btn) btn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  });
}

function appClearAndResync_() {
  var expected = _appExpectedTotal || 4199;
  var ok = confirm('Delete all ' + _appRows.length + ' door check records and re-import all ' + expected + ' apartments from Excel?\n\nThis fixes mixed-up data.');
  if (!ok) return;
  appImportSeed_(true);
}

function appEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  appPopulateFilters_();
  appEnsureSeedMeta_().finally(function () {
    appToggleImportBar_();
  });
  appLoad_(true);
}

function appHandleLogin_(e) {
  empireAuthLogin(e, APP_DEPT, {
    onSuccess: function () {
      appEnterApp_();
    }
  });
}

function appLogout_() {
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function appInit_() {
  appPopulateFilters_();
  if (!empireAuthPageBoot({
    dept: APP_DEPT,
    sendToHomeLogin: false,
    onEnter: appEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', appInit_);
