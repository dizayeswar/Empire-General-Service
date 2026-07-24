/* Application — door-to-door app registration checks (RA, WW, WD, ES) */

var APP_DEPT = 'application';
var APP_PROJECTS = ['RA', 'WW', 'WD', 'ES'];
var APP_STATUS_OPTIONS = [
  '',
  'EMPTY',
  'ACTIVE',
  'NEW ACTIVE',
  'PENDING',
  'CHECK AGAIN',
  'TRY TO REACH',
  'HE DOESN\'T WANT THE APP'
];
var APP_SEED_URL = 'assets/application-seed.json?v=2026-07-22-application-v5';
var _appRows = [];
var _appSaving = {};
var _appDetailId = '';
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
  if (!s) return 'app-status-not-visited';
  if (s === 'EMPTY') return 'app-status-empty';
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
  if (!s) return '#d32f2f';
  if (s === 'EMPTY') return '#6d4c41';
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
  if (counts.EMPTY == null) counts.EMPTY = 0;
  return counts;
}

function appSummaryStatusOrder_(a, b, counts) {
  var order = {
    'ACTIVE': 1,
    'NEW ACTIVE': 2,
    'PENDING': 3,
    'CHECK AGAIN': 4,
    'TRY TO REACH': 5,
    'HE DOESN\'T WANT THE APP': 6,
    'EMPTY': 7,
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
  var other = total - active - pending - (counts['Not visited'] || 0) - (counts.EMPTY || 0) - (counts['HE DOESN\'T WANT THE APP'] || 0);
  var segments = [
    { count: active, color: '#2e7d32' },
    { count: pending, color: '#1565c0' },
    { count: counts['Not visited'] || 0, color: '#d32f2f' },
    { count: counts.EMPTY || 0, color: '#6d4c41' },
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
    var label = k === 'Not visited' ? 'NOT VISITED' : k;
    h += '<div class="app-summary-card"><strong>' + counts[k] + '</strong>'
      + '<span class="app-summary-badge ' + cls + '">' + appEsc_(label) + '</span></div>';
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

function appStatusDisplayLabel_(status) {
  var s = String(status || '').trim();
  return s ? s.toUpperCase() : 'NOT VISITED';
}

function appStatusSelectHtml_(id, value) {
  var stClass = appStatusClass_(value);
  var label = appStatusDisplayLabel_(value);
  var h = '<div class="app-status-dd" data-app-id="' + appEsc_(id) + '">'
    + '<button type="button" class="app-status-dd-btn ' + stClass + '" onclick="appStatusDdToggle_(event,this)">'
    + '<span class="app-status-dd-label">' + appEsc_(label) + '</span>'
    + '<span class="app-status-dd-caret" aria-hidden="true"></span>'
    + '</button>'
    + '<div class="app-status-dd-menu" role="listbox">';
  APP_STATUS_OPTIONS.forEach(function (opt) {
    var optClass = appStatusClass_(opt);
    var optLabel = appStatusDisplayLabel_(opt);
    var sel = String(value || '').toUpperCase() === String(opt || '').toUpperCase() ? ' app-status-dd-opt-selected' : '';
    h += '<button type="button" class="app-status-dd-opt ' + optClass + sel + '" data-value="' + appEsc_(opt) + '" onclick="appStatusDdPick_(event,this)">' + appEsc_(optLabel) + '</button>';
  });
  h += '</div>'
    + '<input type="hidden" data-app-field="status" value="' + appEsc_(value || '') + '">'
    + '</div>';
  return h;
}

function appStatusDdPosition_(btn, menu) {
  if (!btn || !menu) return;
  var r = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = r.left + 'px';
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.width = Math.max(r.width, 210) + 'px';
  menu.style.zIndex = '10000';
  menu.style.display = 'flex';
  var mh = menu.offsetHeight || 280;
  if (r.bottom + 4 + mh > window.innerHeight - 8) {
    menu.style.top = Math.max(8, r.top - mh - 4) + 'px';
  }
}

function appStatusDdBindMenu_(menu) {
  if (!menu || menu._appStatusDdBound) return;
  menu._appStatusDdBound = true;
  menu.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
  menu.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
  menu.addEventListener('click', function (e) { e.stopPropagation(); });
}

function appStatusDdCloseAll_() {
  document.querySelectorAll('.app-status-dd-menu-portal').forEach(function (menu) {
    var wrap = menu._appStatusDdWrap;
    menu.classList.remove('app-status-dd-menu-portal');
    menu.style.position = '';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
    menu.style.zIndex = '';
    menu.style.display = '';
    menu._appStatusDdWrap = null;
    if (wrap) {
      wrap.classList.remove('open');
      wrap.appendChild(menu);
    }
  });
  document.querySelectorAll('.app-status-dd.open').forEach(function (el) {
    el.classList.remove('open');
  });
}

function appStatusDdToggle_(ev, btn) {
  if (ev) ev.stopPropagation();
  var wrap = btn.closest('.app-status-dd');
  if (!wrap) return;
  var menu = wrap.querySelector('.app-status-dd-menu');
  var wasOpen = wrap.classList.contains('open');
  appStatusDdCloseAll_();
  if (wasOpen || !menu) return;
  wrap.classList.add('open');
  appStatusDdBindMenu_(menu);
  document.body.appendChild(menu);
  menu.classList.add('app-status-dd-menu-portal');
  menu._appStatusDdWrap = wrap;
  appStatusDdPosition_(btn, menu);
}

function appStatusDdOnOuterScroll_(ev) {
  var menu = document.querySelector('.app-status-dd-menu-portal');
  if (!menu) return;
  if (ev.target && (menu === ev.target || menu.contains(ev.target))) return;
  appStatusDdCloseAll_();
}

function appStatusDdPick_(ev, optBtn) {
  if (ev) ev.stopPropagation();
  var menu = optBtn.closest('.app-status-dd-menu');
  var wrap = (menu && menu._appStatusDdWrap) || optBtn.closest('.app-status-dd');
  if (!wrap) return;
  var value = optBtn.getAttribute('data-value') || '';
  var hidden = wrap.querySelector('[data-app-field="status"]');
  var btn = wrap.querySelector('.app-status-dd-btn');
  var labelEl = wrap.querySelector('.app-status-dd-label');
  if (hidden) hidden.value = value;
  if (btn) btn.className = 'app-status-dd-btn ' + appStatusClass_(value);
  if (labelEl) labelEl.textContent = appStatusDisplayLabel_(value);
  wrap.querySelectorAll('.app-status-dd-opt').forEach(function (el) {
    el.classList.toggle('app-status-dd-opt-selected', el === optBtn);
  });
  appStatusDdCloseAll_();
  appSaveRow_(wrap.getAttribute('data-app-id'), { status: value });
}

function appFormatDateTime_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '—';
  if (s.indexOf('T') !== -1) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var z = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
    }
  }
  return s.length > 16 ? s.slice(0, 16) : s;
}

function appHistoryFieldLabel_(field) {
  return String(field || '').toLowerCase() === 'phone' ? 'Phone number' : 'Account status';
}

function appHistoryValueLabel_(field, value) {
  if (String(field || '').toLowerCase() === 'status') return appStatusDisplayLabel_(value);
  var p = String(value || '').replace(/\D/g, '');
  return p || '(empty)';
}

function appDetailHtml_(record, history) {
  var stClass = appStatusClass_(record.status);
  var h = '<div class="app-detail-grid">'
    + '<div class="app-detail-card"><label>Project</label><strong>' + appEsc_(record.project) + '</strong></div>'
    + '<div class="app-detail-card"><label>Property</label><strong>' + appEsc_(record.propertyId) + '</strong></div>'
    + '<div class="app-detail-card"><label>Phone</label><strong>' + appEsc_(record.phone || '—') + '</strong></div>'
    + '<div class="app-detail-card"><label>Account status</label><span class="app-detail-status ' + stClass + '">' + appEsc_(appStatusDisplayLabel_(record.status)) + '</span></div>'
    + '<div class="app-detail-card"><label>Last updated</label><span>' + appEsc_(appFormatDateTime_(record.updatedAt)) + '</span></div>'
    + '<div class="app-detail-card"><label>Updated by</label><span>' + appEsc_(record.updatedBy || '—') + '</span></div>'
    + '</div>';
  h += '<h3 class="app-detail-history-title">Change history</h3>';
  if (!history || !history.length) {
    h += '<div class="app-detail-history"><p class="app-detail-empty">No phone or status changes recorded yet.</p></div>';
    return h;
  }
  h += '<div class="app-detail-history">';
  history.forEach(function (item) {
    var oldL = appHistoryValueLabel_(item.field, item.oldValue);
    var newL = appHistoryValueLabel_(item.field, item.newValue);
    h += '<div class="app-detail-history-item">'
      + '<div class="app-detail-history-when">' + appEsc_(appFormatDateTime_(item.changedAt)) + '<br>' + appEsc_(item.changedBy || '—') + '</div>'
      + '<div class="app-detail-history-what"><strong>' + appEsc_(appHistoryFieldLabel_(item.field)) + '</strong>'
      + '<div class="app-detail-history-change">' + appEsc_(oldL) + ' → ' + appEsc_(newL) + '</div></div>'
      + '</div>';
  });
  h += '</div>';
  return h;
}

function appOpenDetail_(id) {
  if (!id) return;
  _appDetailId = String(id);
  var modal = document.getElementById('appDetailModal');
  var body = document.getElementById('appDetailBody');
  var title = document.getElementById('appDetailTitle');
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (title) title.textContent = row ? (row.project + ' · ' + row.propertyId) : 'Apartment';
  if (body) body.innerHTML = '<p>Loading apartment info…</p>';
  if (modal) modal.classList.add('show');
  fetchJSONRetry({ action: 'getApplicationCheckDetail', token: appToken_(), id: id }, 1, 45000).then(function (d) {
    if (!_appDetailId || String(_appDetailId) !== String(id)) return;
    if (!d || d.ok === false) {
      if (body) body.innerHTML = '<p class="worker-empty">' + appEsc_((d && (d.message || d.error)) || 'Could not load details') + '</p>';
      return;
    }
    if (title && d.record) title.textContent = d.record.project + ' · ' + d.record.propertyId;
    if (body) body.innerHTML = appDetailHtml_(d.record || {}, d.history || []);
  }).catch(function (e) {
    if (body) body.innerHTML = '<p class="worker-empty">' + appEsc_(String((e && e.message) || e || 'Load failed')) + '</p>';
  });
}

function appCloseDetail_() {
  _appDetailId = '';
  var modal = document.getElementById('appDetailModal');
  if (modal) modal.classList.remove('show');
}

function appRefreshDetailIfOpen_(id, history) {
  if (!_appDetailId || String(_appDetailId) !== String(id)) return;
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (!row) return;
  var body = document.getElementById('appDetailBody');
  var title = document.getElementById('appDetailTitle');
  if (title) title.textContent = row.project + ' · ' + row.propertyId;
  if (body) body.innerHTML = appDetailHtml_(row, history || []);
}

function appRowClick_(ev) {
  if (ev.target.closest('input, button, .app-status-dd, .app-status-dd-menu-portal')) return;
  var tr = ev.currentTarget;
  appOpenDetail_(tr ? tr.getAttribute('data-app-id') : '');
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
    + '<th>Property</th><th>Phone</th><th>Account status</th><th>Updated</th>'
    + '</tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr class="app-row-clickable" data-app-id="' + appEsc_(r.id) + '" onclick="appRowClick_(event)">'
      + '<td><strong class="app-property-link">' + appEsc_(r.propertyId) + '</strong></td>'
      + '<td><input type="text" class="app-phone-input" inputmode="numeric" data-app-id="' + appEsc_(r.id) + '" data-app-field="phone" value="' + appEsc_(r.phone || '') + '" onchange="appSaveRow_(this.getAttribute(\'data-app-id\'))"></td>'
      + '<td>' + appStatusSelectHtml_(r.id, r.status) + '</td>'
      + '<td class="app-updated-cell">' + (r.updatedAt ? appEsc_(r.updatedAt.slice(0, 10)) : '—') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<p style="margin-top:10px;font-size:13px;color:var(--text-soft);">' + rows.length + ' shown</p>';
  host.innerHTML = h;
}

function appFindTableRow_(id) {
  var want = String(id || '');
  var rows = document.querySelectorAll('tr[data-app-id]');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].getAttribute('data-app-id') || '') === want) return rows[i];
  }
  return null;
}

function appMarkRowSaving_(id, saving) {
  var tr = appFindTableRow_(id);
  if (!tr) return;
  tr.classList.toggle('app-row-saving', !!saving);
  var cell = tr.querySelector('.app-updated-cell');
  if (cell && saving) cell.textContent = 'Saving…';
}

function appSaveRow_(id, patch) {
  patch = patch || {};
  if (_appSaving[id]) return;
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (!row) return;
  var tr = appFindTableRow_(id);
  var phoneEl = tr ? tr.querySelector('[data-app-field="phone"]') : null;
  var statusEl = tr ? tr.querySelector('[data-app-field="status"]') : null;
  var phone = patch.phone != null ? String(patch.phone || '').replace(/\D/g, '') : (phoneEl ? String(phoneEl.value || '').replace(/\D/g, '') : String(row.phone || ''));
  var status = patch.status != null ? String(patch.status || '') : (statusEl ? String(statusEl.value || '') : String(row.status || ''));
  _appSaving[id] = true;
  appMarkRowSaving_(id, true);
  fetchJSONRetry({
    action: 'updateApplicationCheck',
    token: appToken_(),
    id: id,
    project: row.project,
    propertyId: row.propertyId,
    phone: phone,
    status: status
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      row.phone = d.phone != null ? d.phone : phone;
      row.status = d.status != null ? d.status : status;
      row.updatedAt = d.updatedAt || row.updatedAt;
      row.updatedBy = d.updatedBy || row.updatedBy;
      appRenderTable_();
      appRefreshDetailIfOpen_(id, d.history);
    } else if (d && d.ok === false) {
      alert(d.message || d.error || 'Could not save');
      appRenderTable_();
    }
  }).catch(function (e) {
    alert(String((e && e.message) || e || 'Save failed'));
    appRenderTable_();
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

function appRefreshIcons_() {
  return [
    document.getElementById('navRefreshIcon'),
    document.getElementById('listRefreshIcon')
  ].filter(Boolean);
}

function appSetRefreshSpinning_(on) {
  appRefreshIcons_().forEach(function (el) {
    if (on) el.classList.add('spinning');
    else el.classList.remove('spinning');
  });
}

function appLoad_(force) {
  var host = document.getElementById('appTableHost');
  if (host) host.innerHTML = '<p>Loading all projects (RA, WW, WD, ES)…</p>';
  appSetRefreshSpinning_(true);
  return Promise.all(APP_PROJECTS.map(function (p) {
    return appFetchProjectRows_(p, force);
  })).then(function (parts) {
    _appRows = [];
    parts.forEach(function (rows) {
      _appRows = _appRows.concat(rows);
    });
    _appRows = appSortRows_(_appRows);
    appRenderTable_();
    appRenderSummary_();
  }).catch(function (e) {
    if (host) host.innerHTML = '<p class="worker-empty">Could not load data. ' + appEsc_((e && e.message) || e) + '</p>';
  }).finally(function () {
    appSetRefreshSpinning_(false);
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

function appEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  appPopulateFilters_();
  appEnsureSeedMeta_();
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
  if (!document.body._appStatusDdBound) {
    document.body._appStatusDdBound = true;
    document.addEventListener('click', appStatusDdCloseAll_);
    document.addEventListener('scroll', appStatusDdOnOuterScroll_, true);
    window.addEventListener('resize', appStatusDdCloseAll_);
  }
  if (!empireAuthPageBoot({
    dept: APP_DEPT,
    sendToHomeLogin: false,
    onEnter: appEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', appInit_);
