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
var _appRows = [];
var _appSaving = {};

function appToken_() { return empireGetToken() || ''; }
function appEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function appStatusClass_(status) {
  var s = String(status || '').toUpperCase();
  if (!s) return 'app-status-empty';
  if (s.indexOf('ACTIVE') !== -1) return 'app-status-active';
  if (s === 'PENDING') return 'app-status-pending';
  if (s.indexOf('WANT') !== -1) return 'app-status-refused';
  return 'app-status-follow';
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

function appSummaryHtml_(rows) {
  var counts = {};
  rows.forEach(function (r) {
    var key = String(r.status || '').trim().toUpperCase() || 'Not visited';
    counts[key] = (counts[key] || 0) + 1;
  });
  var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  return keys.slice(0, 8).map(function (k) {
    return '<div class="app-summary-card"><strong>' + counts[k] + '</strong><span>' + appEsc_(k) + '</span></div>';
  }).join('');
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

function appRenderTable_() {
  var host = document.getElementById('appTableHost');
  var summary = document.getElementById('appSummaryHost');
  if (!host) return;
  var rows = appFilteredRows_();
  if (summary) summary.innerHTML = appSummaryHtml_(rows);
  if (!rows.length) {
    host.innerHTML = '<p class="worker-empty">No properties match your filters.</p>';
    return;
  }
  var h = '<div class="app-table-wrap"><table class="app-table"><thead><tr>'
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
  if (proj && !proj.options.length) {
    proj.innerHTML = '<option value="">All projects</option>'
      + APP_PROJECTS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
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

function appLoad_(force) {
  var host = document.getElementById('appTableHost');
  if (host) host.innerHTML = '<p>Loading…</p>';
  return fetchJSONRetry({ action: 'getApplicationChecks', token: appToken_() }, force ? 2 : 1, 120000)
    .then(function (d) {
      _appRows = Array.isArray(d) ? d : [];
      appToggleImportBar_();
      appRenderTable_();
    })
    .catch(function (e) {
      if (host) host.innerHTML = '<p class="worker-empty">Could not load data. ' + appEsc_((e && e.message) || e) + '</p>';
    });
}

function appToggleImportBar_() {
  var bar = document.getElementById('appImportBar');
  if (!bar) return;
  var isAdmin = String(empireGetRole() || '').toLowerCase() === 'admin';
  bar.style.display = (isAdmin && !_appRows.length) ? 'flex' : 'none';
}

function appImportSeed_() {
  var msg = document.getElementById('appImportMsg');
  var btn = document.getElementById('appImportBtn');
  if (btn) btn.disabled = true;
  if (msg) msg.textContent = 'Loading seed file…';
  fetch('assets/application-seed.json?v=2026-07-22-application-v1')
    .then(function (r) { return r.json(); })
    .then(function (items) {
      if (!Array.isArray(items) || !items.length) throw new Error('Seed file is empty');
      var chunk = 250;
      var i = 0;
      var inserted = 0;
      var updated = 0;
      function nextBatch() {
        var slice = items.slice(i, i + chunk);
        if (!slice.length) {
          if (msg) msg.textContent = 'Import complete — ' + inserted + ' new, ' + updated + ' updated.';
          return appLoad_(true);
        }
        if (msg) msg.textContent = 'Importing ' + Math.min(i + chunk, items.length) + ' / ' + items.length + '…';
        return fetchJSONRetry({ action: 'importApplicationChecks', token: appToken_(), items: slice }, 2, 120000)
          .then(function (d) {
            if (d && (d.ok || d.success)) {
              inserted += Number(d.inserted || 0);
              updated += Number(d.updated || 0);
              i += chunk;
              return nextBatch();
            }
            throw new Error((d && (d.message || d.error)) || 'Import failed');
          });
      }
      return nextBatch();
    })
    .catch(function (e) {
      if (msg) msg.textContent = 'Import failed: ' + String((e && e.message) || e);
      if (btn) btn.disabled = false;
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
