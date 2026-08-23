/* UPS — monthly checklist (Wing, Square, Diamond, Tower, Complex) */

var UPS_DEPT = 'ups';
var UPS_SEED_URL = 'assets/ups-seed.json?v=2026-08-23-ups';
var UPS_GROUPS = [
  { id: '', label: 'All groups' },
  { id: 'wing1', label: 'Wing W1–W11' },
  { id: 'wing2', label: 'Wing W12–W15' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'tower', label: 'Tower' },
  { id: 'complex', label: 'Complex C1–C3' }
];
var UPS_STATUS_OPTS = ['Normal', 'Faulty'];
var UPS_AC_OPTS = ['Good', 'Poor', 'Faulty', 'Unavailable'];
var UPS_YESNO_OPTS = ['Yes', 'No'];

var _upsRows = [];
var _upsDetailId = '';
var _upsSaving = false;

function upsToken_() { return empireGetToken() || ''; }
function upsEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function upsGroupLabel_(id) {
  var g = UPS_GROUPS.find(function (x) { return x.id === id; });
  return g ? g.label : id || '—';
}

function upsBadgeClass_(field, value) {
  var v = String(value || '').trim().toLowerCase();
  if (field === 'upsStatus' || field === 'batteryStatus') {
    if (v === 'normal') return 'ups-badge-normal';
    if (v === 'faulty') return 'ups-badge-faulty';
  }
  if (field === 'acStatus') {
    if (v === 'good') return 'ups-badge-good';
    if (v === 'poor') return 'ups-badge-poor';
    if (v === 'faulty') return 'ups-badge-faulty';
    if (v === 'unavailable') return 'ups-badge-unavailable';
  }
  if (field === 'roomClean') {
    if (v === 'yes') return 'ups-badge-yes';
    if (v === 'no') return 'ups-badge-no';
  }
  return '';
}

function upsBadge_(field, value) {
  var cls = upsBadgeClass_(field, value);
  var label = String(value || '').trim() || '—';
  if (!cls) return upsEsc_(label);
  return '<span class="ups-badge ' + cls + '">' + upsEsc_(label) + '</span>';
}

function upsNormalizeRow_(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    id: String(r.id || ''),
    group: String(r.group || r.ups_group || ''),
    no: Number(r.no || 0) || 0,
    apartment: String(r.apartment || ''),
    floor: String(r.floor || ''),
    room: String(r.room || ''),
    kks: String(r.kks || ''),
    brand: String(r.brand || ''),
    capacity: String(r.capacity || ''),
    upsStatus: String(r.upsStatus || r.ups_status || ''),
    batteryStatus: String(r.batteryStatus || r.battery_status || ''),
    roomClean: String(r.roomClean || r.room_clean || ''),
    acStatus: String(r.acStatus || r.ac_status || ''),
    alarmFault: String(r.alarmFault || r.alarm_fault || '')
  };
}

function upsFetchRows_() {
  return fetchJSONRetry({ action: 'getUpsChecks', token: upsToken_() }, 1, 60000).then(function (d) {
    if (Array.isArray(d)) return d.map(upsNormalizeRow_).filter(Boolean);
    if (d && Array.isArray(d.rows)) return d.rows.map(upsNormalizeRow_).filter(Boolean);
    return [];
  });
}

function upsFilteredRows_() {
  var group = String((document.getElementById('upsFilterGroup') || {}).value || '').trim();
  var q = String((document.getElementById('upsFilterSearch') || {}).value || '').trim().toLowerCase();
  return _upsRows.filter(function (r) {
    if (group && String(r.group || '') !== group) return false;
    if (q) {
      var blob = [
        r.apartment, r.floor, r.room, r.kks, r.brand, r.capacity,
        r.upsStatus, r.batteryStatus, r.acStatus, r.alarmFault, upsGroupLabel_(r.group)
      ].join(' ').toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(function (a, b) {
    var ga = String(a.group || '');
    var gb = String(b.group || '');
    if (ga !== gb) return ga < gb ? -1 : 1;
    return (Number(a.no) || 0) - (Number(b.no) || 0);
  });
}

function upsRenderTable_() {
  var host = document.getElementById('upsTableHost');
  var summary = document.getElementById('upsSummary');
  if (!host) return;
  var rows = upsFilteredRows_();
  if (summary) {
    summary.textContent = rows.length + ' UPS unit' + (rows.length === 1 ? '' : 's') +
      ' shown · ' + _upsRows.length + ' total in register';
  }
  if (!rows.length) {
    host.innerHTML = '<p class="worker-empty">No UPS records match these filters.</p>';
    return;
  }
  var h = '<div class="ups-table-wrap"><table class="ups-table"><thead><tr>'
    + '<th>#</th><th>Group</th><th>Apartment</th><th>Floor</th><th>Room</th><th>UPS KKS</th>'
    + '<th>Brand</th><th>Capacity</th><th>UPS status</th><th>Battery</th><th>Room clean</th>'
    + '<th>A.C</th><th>Alarm / fault</th><th></th></tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr>'
      + '<td>' + upsEsc_(r.no) + '</td>'
      + '<td>' + upsEsc_(upsGroupLabel_(r.group)) + '</td>'
      + '<td><strong>' + upsEsc_(r.apartment) + '</strong></td>'
      + '<td>' + upsEsc_(r.floor) + '</td>'
      + '<td>' + upsEsc_(r.room) + '</td>'
      + '<td>' + upsEsc_(r.kks) + '</td>'
      + '<td>' + upsEsc_(r.brand) + '</td>'
      + '<td>' + upsEsc_(r.capacity) + '</td>'
      + '<td>' + upsBadge_('upsStatus', r.upsStatus) + '</td>'
      + '<td>' + upsBadge_('batteryStatus', r.batteryStatus) + '</td>'
      + '<td>' + upsBadge_('roomClean', r.roomClean) + '</td>'
      + '<td>' + upsBadge_('acStatus', r.acStatus) + '</td>'
      + '<td class="ups-fault">' + upsEsc_(r.alarmFault || '—') + '</td>'
      + '<td><button type="button" onclick="upsOpenDetail_(' + JSON.stringify(r.id) + ')">Edit</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}

function upsPopulateFilters_() {
  var groupSel = document.getElementById('upsFilterGroup');
  if (!groupSel || groupSel.options.length > 1) return;
  UPS_GROUPS.forEach(function (g) {
    var opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.label;
    groupSel.appendChild(opt);
  });
}

function upsFindRow_(id) {
  return _upsRows.find(function (r) { return String(r.id) === String(id); }) || null;
}

function upsSelectOptions_(opts, selected) {
  return opts.map(function (o) {
    return '<option value="' + upsEsc_(o) + '"' + (String(selected || '') === o ? ' selected' : '') + '>' + upsEsc_(o) + '</option>';
  }).join('');
}

function upsOpenDetail_(id) {
  var row = upsFindRow_(id);
  if (!row) return;
  _upsDetailId = id;
  var title = document.getElementById('upsDetailTitle');
  var body = document.getElementById('upsDetailBody');
  var modal = document.getElementById('upsDetailModal');
  if (title) title.textContent = (row.apartment || 'UPS') + ' · ' + (row.kks || '');
  if (body) {
    body.innerHTML = '<div class="ups-detail-grid">'
      + '<div><label>Group</label><input type="text" value="' + upsEsc_(upsGroupLabel_(row.group)) + '" disabled></div>'
      + '<div><label>Apartment</label><input id="upsEditApartment" type="text" value="' + upsEsc_(row.apartment) + '"></div>'
      + '<div><label>Floor</label><input id="upsEditFloor" type="text" value="' + upsEsc_(row.floor) + '"></div>'
      + '<div><label>Room</label><input id="upsEditRoom" type="text" value="' + upsEsc_(row.room) + '"></div>'
      + '<div><label>UPS KKS</label><input id="upsEditKks" type="text" value="' + upsEsc_(row.kks) + '"></div>'
      + '<div><label>Brand</label><input id="upsEditBrand" type="text" value="' + upsEsc_(row.brand) + '"></div>'
      + '<div><label>Capacity</label><input id="upsEditCapacity" type="text" value="' + upsEsc_(row.capacity) + '"></div>'
      + '<div><label>UPS status</label><select id="upsEditUpsStatus">' + upsSelectOptions_(UPS_STATUS_OPTS, row.upsStatus) + '</select></div>'
      + '<div><label>Battery status</label><select id="upsEditBatteryStatus">' + upsSelectOptions_(UPS_STATUS_OPTS, row.batteryStatus) + '</select></div>'
      + '<div><label>Room clean</label><select id="upsEditRoomClean">' + upsSelectOptions_(UPS_YESNO_OPTS, row.roomClean) + '</select></div>'
      + '<div><label>A.C status</label><select id="upsEditAcStatus">' + upsSelectOptions_(UPS_AC_OPTS, row.acStatus) + '</select></div>'
      + '<div class="full"><label>Alarm or fault description</label><textarea id="upsEditAlarmFault" rows="3">' + upsEsc_(row.alarmFault) + '</textarea></div>'
      + '</div>'
      + '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">'
      + '<button type="button" id="upsSaveBtn" onclick="upsSaveDetail_()" style="color:#fff;background:var(--accent2);border-color:var(--accent2);">Save</button>'
      + '<button type="button" onclick="upsCloseDetail_()">Cancel</button>'
      + '</div>';
  }
  if (modal) modal.classList.add('show');
}

function upsCloseDetail_() {
  _upsDetailId = '';
  var modal = document.getElementById('upsDetailModal');
  if (modal) modal.classList.remove('show');
}

function upsVal_(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function upsSaveDetail_() {
  if (_upsSaving) return;
  var row = upsFindRow_(_upsDetailId);
  if (!row) return;
  var payload = {
    action: 'updateUpsCheck',
    token: upsToken_(),
    id: row.id,
    apartment: upsVal_('upsEditApartment'),
    floor: upsVal_('upsEditFloor'),
    room: upsVal_('upsEditRoom'),
    kks: upsVal_('upsEditKks'),
    brand: upsVal_('upsEditBrand'),
    capacity: upsVal_('upsEditCapacity'),
    upsStatus: upsVal_('upsEditUpsStatus'),
    batteryStatus: upsVal_('upsEditBatteryStatus'),
    roomClean: upsVal_('upsEditRoomClean'),
    acStatus: upsVal_('upsEditAcStatus'),
    alarmFault: upsVal_('upsEditAlarmFault')
  };
  var btn = document.getElementById('upsSaveBtn');
  _upsSaving = true;
  if (btn) btn.disabled = true;
  fetchJSON(payload).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Save failed');
    var saved = upsNormalizeRow_(d);
    if (saved) {
      _upsRows = _upsRows.map(function (r) { return r.id === saved.id ? saved : r; });
    }
    upsCloseDetail_();
    upsRenderTable_();
  }).catch(function (e) {
    alert('Could not save UPS record. ' + ((e && e.message) || e));
  }).finally(function () {
    _upsSaving = false;
    if (btn) btn.disabled = false;
  });
}

function upsFetchSeed_() {
  return fetch(UPS_SEED_URL).then(function (r) { return r.json(); }).then(function (items) {
    if (!Array.isArray(items)) throw new Error('Seed file invalid');
    return items;
  });
}

function upsResetSeed_() {
  if (!confirm('Reset UPS register to the 5 sample records? All current UPS rows will be replaced.')) return;
  upsSetRefreshSpinning_(true);
  upsFetchSeed_().then(function (items) {
    return fetchJSON({ action: 'clearUpsChecks', token: upsToken_() }).then(function (cleared) {
      if (!cleared || cleared.ok === false) throw new Error((cleared && (cleared.message || cleared.error)) || 'Clear failed');
      return fetchJSON({ action: 'importUpsChecks', token: upsToken_(), items: items });
    });
  }).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Import failed');
    return upsLoad_(true);
  }).catch(function (e) {
    alert('Reset failed. ' + ((e && e.message) || e));
  }).finally(function () {
    upsSetRefreshSpinning_(false);
  });
}

function upsSetRefreshSpinning_(on) {
  ['navRefreshIcon', 'listRefreshIcon'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (on) el.classList.add('spinning');
    else el.classList.remove('spinning');
  });
}

function upsLoad_(force) {
  var host = document.getElementById('upsTableHost');
  if (host) host.innerHTML = '<p>Loading…</p>';
  upsSetRefreshSpinning_(true);
  return upsFetchRows_(force).then(function (rows) {
    _upsRows = rows;
    upsRenderTable_();
  }).catch(function (e) {
    if (host) host.innerHTML = '<p class="worker-empty">Could not load UPS data. ' + upsEsc_((e && e.message) || e) + '</p>';
  }).finally(function () {
    upsSetRefreshSpinning_(false);
  });
}

function upsEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  upsPopulateFilters_();
  upsLoad_(false);
}

function upsHandleLogin_(e) {
  empireAuthLogin(e, UPS_DEPT, {
    onSuccess: function () {
      upsEnterApp_();
    }
  });
}

function upsLogout_() {
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function upsInit_() {
  upsPopulateFilters_();
  if (!empireAuthPageBoot({
    dept: UPS_DEPT,
    sendToHomeLogin: false,
    onEnter: upsEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', upsInit_);
