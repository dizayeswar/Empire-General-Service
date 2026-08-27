/* UPS — register, monthly checklist, history */

var UPS_DEPT = 'ups';
var UPS_SEED_URL = 'assets/ups-seed.json?v=2026-08-27-ups-v2';
var UPS_GROUPS = [
  { id: '', label: 'All groups' },
  { id: 'wing1', label: 'Wing W1-W11' },
  { id: 'wing2', label: 'Wing W12-W15' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'tower', label: 'Tower' },
  { id: 'complex', label: 'Complex C1-C3' }
];
var UPS_STATUS_OPTS = ['', 'Normal', 'Faulty'];
var UPS_AC_OPTS = ['', 'Good', 'Poor', 'Faulty', 'Unavailable'];
var UPS_YESNO_OPTS = ['', 'Yes', 'No'];
var UPS_FIELD_LABELS = {
  group: 'Group',
  no: 'No',
  apartment: 'Apartment',
  floor: 'Floor',
  room: 'Room',
  kks: 'UPS KKS',
  brand: 'Brand',
  capacity: 'Capacity',
  upsStatus: 'UPS status',
  batteryStatus: 'Battery status',
  roomClean: 'Room clean',
  acStatus: 'A.C status',
  alarmFault: 'Alarm / fault',
  notes: 'Notes'
};

var _upsRows = [];
var _upsHistory = [];
var _upsDetailId = '';
var _upsDetailMode = 'edit';
var _upsSaving = false;
var _upsActiveTab = 'list';

function upsToken_() { return empireGetToken() || ''; }
function upsEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function upsIsAdmin_() {
  return typeof empireIsAdminRole === 'function' && empireIsAdminRole();
}
function upsCurrentMonth_() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function upsGroupLabel_(id) {
  var g = UPS_GROUPS.find(function (x) { return x.id === id; });
  return g ? g.label : id || '—';
}
function upsDisplay_(value, emptyLabel) {
  var v = String(value || '').trim();
  return v || (emptyLabel || 'Unchecked');
}

function upsBadgeClass_(field, value) {
  var v = String(value || '').trim().toLowerCase();
  if (!v) return 'ups-badge-unchecked';
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
  var label = upsDisplay_(value);
  return '<span class="ups-badge ' + cls + '">' + upsEsc_(label) + '</span>';
}

function upsNeedsAttention_(r) {
  var u = String(r.upsStatus || '').toLowerCase();
  var b = String(r.batteryStatus || '').toLowerCase();
  var a = String(r.acStatus || '').toLowerCase();
  var c = String(r.roomClean || '').toLowerCase();
  return u === 'faulty' || b === 'faulty' || a === 'faulty' || a === 'poor' || c === 'no' || !!String(r.alarmFault || '').trim();
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
    alarmFault: String(r.alarmFault || r.alarm_fault || ''),
    notes: String(r.notes || ''),
    lastInspectedMonth: String(r.lastInspectedMonth || r.last_inspected_month || ''),
    lastInspectedAt: String(r.lastInspectedAt || r.last_inspected_at || ''),
    lastInspectedBy: String(r.lastInspectedBy || r.last_inspected_by || ''),
    updatedAt: String(r.updatedAt || r.updated_at || ''),
    updatedBy: String(r.updatedBy || r.updated_by || ''),
    inspectedThisMonth: !!r.inspectedThisMonth,
    monthSnapshot: r.monthSnapshot || null,
    history: Array.isArray(r.history) ? r.history : [],
    inspections: Array.isArray(r.inspections) ? r.inspections : []
  };
}

function upsCheckMonth_() {
  var el = document.getElementById('upsCheckMonth');
  return el && el.value ? el.value : upsCurrentMonth_();
}

function upsFetchRows_() {
  return fetchJSONRetry({
    action: 'getUpsChecks',
    token: upsToken_(),
    month: upsCheckMonth_()
  }, 1, 60000).then(function (d) {
    if (Array.isArray(d)) return d.map(upsNormalizeRow_).filter(Boolean);
    if (d && Array.isArray(d.rows)) return d.rows.map(upsNormalizeRow_).filter(Boolean);
    return [];
  });
}

function upsFilteredRows_() {
  var group = String((document.getElementById('upsFilterGroup') || {}).value || '').trim();
  var status = String((document.getElementById('upsFilterStatus') || {}).value || '').trim();
  var q = String((document.getElementById('upsFilterSearch') || {}).value || '').trim().toLowerCase();
  return _upsRows.filter(function (r) {
    if (group && String(r.group || '') !== group) return false;
    if (status === 'attention' && !upsNeedsAttention_(r)) return false;
    if (status === 'unchecked' && String(r.upsStatus || '').trim()) return false;
    if (status === 'normal' && String(r.upsStatus || '').toLowerCase() !== 'normal') return false;
    if (status === 'faulty' && String(r.upsStatus || '').toLowerCase() !== 'faulty') return false;
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

function upsKpiHtml_() {
  var total = _upsRows.length;
  var faulty = _upsRows.filter(function (r) {
    return String(r.upsStatus || '').toLowerCase() === 'faulty' || String(r.batteryStatus || '').toLowerCase() === 'faulty';
  }).length;
  var dirty = _upsRows.filter(function (r) { return String(r.roomClean || '').toLowerCase() === 'no'; }).length;
  var month = upsCheckMonth_();
  var inspected = _upsRows.filter(function (r) { return r.inspectedThisMonth || r.lastInspectedMonth === month; }).length;
  return ''
    + '<div class="ups-kpi"><strong>' + total + '</strong><span>UPS units</span></div>'
    + '<div class="ups-kpi ' + (faulty ? 'warn' : 'ok') + '"><strong>' + faulty + '</strong><span>Faulty UPS / battery</span></div>'
    + '<div class="ups-kpi"><strong>' + dirty + '</strong><span>Rooms not clean</span></div>'
    + '<div class="ups-kpi ' + (total && inspected === total ? 'ok' : '') + '"><strong>' + inspected + '/' + total + '</strong><span>Inspected ' + upsEsc_(month) + '</span></div>';
}

function upsRenderTable_() {
  var host = document.getElementById('upsTableHost');
  var summary = document.getElementById('upsSummary');
  var kpi = document.getElementById('upsKpiRow');
  if (kpi) kpi.innerHTML = upsKpiHtml_();
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
    + '<th>Brand</th><th>Capacity</th><th>UPS</th><th>Battery</th><th>Room</th>'
    + '<th>A.C</th><th>Alarm / fault</th><th>Last check</th></tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr class="ups-row-click" onclick="upsOpenDetail_(' + JSON.stringify(r.id) + ',\'edit\')">'
      + '<td>' + upsEsc_(r.no) + '</td>'
      + '<td>' + upsEsc_(upsGroupLabel_(r.group)) + '</td>'
      + '<td><strong>' + upsEsc_(r.apartment) + '</strong></td>'
      + '<td>' + upsEsc_(r.floor) + '</td>'
      + '<td>' + upsEsc_(r.room) + '</td>'
      + '<td>' + upsEsc_(r.kks) + '</td>'
      + '<td>' + upsEsc_(r.brand || '—') + '</td>'
      + '<td>' + upsEsc_(r.capacity || '—') + '</td>'
      + '<td>' + upsBadge_('upsStatus', r.upsStatus) + '</td>'
      + '<td>' + upsBadge_('batteryStatus', r.batteryStatus) + '</td>'
      + '<td>' + upsBadge_('roomClean', r.roomClean) + '</td>'
      + '<td>' + upsBadge_('acStatus', r.acStatus) + '</td>'
      + '<td class="ups-fault">' + upsEsc_(r.alarmFault || '—') + '</td>'
      + '<td>' + upsEsc_(r.lastInspectedMonth || '—') + '</td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}

function upsChecklistRows_() {
  var group = String((document.getElementById('upsCheckGroup') || {}).value || '').trim();
  var show = String((document.getElementById('upsCheckShow') || {}).value || 'pending');
  var month = upsCheckMonth_();
  return _upsRows.filter(function (r) {
    if (group && String(r.group || '') !== group) return false;
    var done = !!(r.inspectedThisMonth || r.lastInspectedMonth === month);
    if (show === 'pending' && done) return false;
    if (show === 'done' && !done) return false;
    return true;
  }).sort(function (a, b) {
    var ga = String(a.group || '');
    var gb = String(b.group || '');
    if (ga !== gb) return ga < gb ? -1 : 1;
    return (Number(a.no) || 0) - (Number(b.no) || 0);
  });
}

function upsRenderChecklist_() {
  var host = document.getElementById('upsCheckHost');
  var prog = document.getElementById('upsCheckProgress');
  if (!host) return;
  var month = upsCheckMonth_();
  var group = String((document.getElementById('upsCheckGroup') || {}).value || '').trim();
  var all = _upsRows.filter(function (r) { return !group || r.group === group; });
  var done = all.filter(function (r) { return r.inspectedThisMonth || r.lastInspectedMonth === month; }).length;
  var pct = all.length ? Math.round(done / all.length * 100) : 0;
  if (prog) {
    prog.innerHTML = '<div class="ups-progress"><div class="ups-progress-bar"><span style="width:' + pct + '%"></span></div>'
      + '<p>' + done + ' of ' + all.length + ' inspected for ' + upsEsc_(month) + ' (' + pct + '%)</p></div>';
  }
  var rows = upsChecklistRows_();
  if (!rows.length) {
    host.innerHTML = '<p class="worker-empty">No units in this view. Switch Show to All units, or add a missing UPS.</p>';
    return;
  }
  var h = '<div class="ups-check-list">';
  rows.forEach(function (r) {
    var inspected = !!(r.inspectedThisMonth || r.lastInspectedMonth === month);
    h += '<div class="ups-check-card' + (inspected ? ' done' : '') + '">'
      + '<div><strong>' + upsEsc_(r.apartment) + ' · ' + upsEsc_(r.kks || '') + '</strong>'
      + '<div class="ups-check-meta">' + upsEsc_(upsGroupLabel_(r.group)) + ' · ' + upsEsc_(r.floor) + ' · ' + upsEsc_(r.room)
      + (r.brand ? ' · ' + upsEsc_(r.brand + (r.capacity ? ' ' + r.capacity : '')) : '') + '</div>'
      + '<div class="ups-check-badges">'
      + upsBadge_('upsStatus', r.upsStatus) + upsBadge_('batteryStatus', r.batteryStatus)
      + upsBadge_('roomClean', r.roomClean) + upsBadge_('acStatus', r.acStatus)
      + '</div></div>'
      + '<div><button type="button" onclick="upsOpenDetail_(' + JSON.stringify(r.id) + ',\'inspect\')">'
      + (inspected ? 'Update check' : 'Inspect') + '</button></div></div>';
  });
  h += '</div>';
  host.innerHTML = h;
}

function upsRenderSummary_() {
  var host = document.getElementById('upsSummaryHost');
  if (!host) return;
  var month = upsCheckMonth_();
  var total = _upsRows.length;
  var inspected = _upsRows.filter(function (r) { return r.inspectedThisMonth || r.lastInspectedMonth === month; }).length;
  var faultyUps = _upsRows.filter(function (r) { return String(r.upsStatus || '').toLowerCase() === 'faulty'; }).length;
  var faultyBat = _upsRows.filter(function (r) { return String(r.batteryStatus || '').toLowerCase() === 'faulty'; }).length;
  var dirty = _upsRows.filter(function (r) { return String(r.roomClean || '').toLowerCase() === 'no'; }).length;
  var acBad = _upsRows.filter(function (r) {
    var a = String(r.acStatus || '').toLowerCase();
    return a === 'poor' || a === 'faulty';
  }).length;
  var unchecked = _upsRows.filter(function (r) { return !String(r.upsStatus || '').trim(); }).length;
  var h = '<div class="ups-summary-grid">'
    + '<div class="ups-kpi"><strong>' + total + '</strong><span>Units in register</span></div>'
    + '<div class="ups-kpi"><strong>' + inspected + '/' + total + '</strong><span>Checked ' + upsEsc_(month) + '</span></div>'
    + '<div class="ups-kpi warn"><strong>' + faultyUps + '</strong><span>Faulty UPS</span></div>'
    + '<div class="ups-kpi warn"><strong>' + faultyBat + '</strong><span>Faulty battery</span></div>'
    + '<div class="ups-kpi"><strong>' + dirty + '</strong><span>Room not clean</span></div>'
    + '<div class="ups-kpi"><strong>' + acBad + '</strong><span>A.C poor / faulty</span></div>'
    + '<div class="ups-kpi"><strong>' + unchecked + '</strong><span>Never inspected</span></div>'
    + '</div>';
  UPS_GROUPS.forEach(function (g) {
    if (!g.id) return;
    var rows = _upsRows.filter(function (r) { return r.group === g.id; });
    if (!rows.length) return;
    var done = rows.filter(function (r) { return r.inspectedThisMonth || r.lastInspectedMonth === month; }).length;
    var faults = rows.filter(upsNeedsAttention_).length;
    h += '<div class="ups-group-card"><h3>' + upsEsc_(g.label) + '</h3>'
      + '<p>' + rows.length + ' units · ' + done + ' inspected this month · ' + faults + ' need attention</p></div>';
  });
  host.innerHTML = h;
}

function upsHistoryField_(field) {
  return UPS_FIELD_LABELS[field] || field || 'Change';
}

function upsRenderHistory_() {
  var host = document.getElementById('upsHistoryHost');
  if (!host) return;
  var q = String((document.getElementById('upsHistSearch') || {}).value || '').trim().toLowerCase();
  var rows = _upsHistory.filter(function (item) {
    if (!q) return true;
    var blob = [item.apartment, item.kks, item.field, item.oldValue, item.newValue, item.changedBy, item.inspectionMonth].join(' ').toLowerCase();
    return blob.indexOf(q) !== -1;
  });
  if (!rows.length) {
    host.innerHTML = '<p class="worker-empty">No history yet. Save a checklist or edit a unit to start the log.</p>';
    return;
  }
  var h = '<div class="ups-history">';
  rows.forEach(function (item) {
    h += '<div class="ups-history-item">'
      + '<div class="ups-history-when">' + upsEsc_(item.changedAt || '—') + '<br>' + upsEsc_(item.changedBy || '—') + '</div>'
      + '<div><strong>' + upsEsc_(item.apartment || item.checkId) + (item.kks ? ' · ' + upsEsc_(item.kks) : '') + '</strong>'
      + (item.inspectionMonth ? '<span class="ups-month-chip">' + upsEsc_(item.inspectionMonth) + '</span>' : '')
      + '<div>' + upsEsc_(upsHistoryField_(item.field)) + '</div>'
      + '<div class="ups-history-change">' + upsEsc_(upsDisplay_(item.oldValue, '(empty)')) + ' → ' + upsEsc_(upsDisplay_(item.newValue, '(empty)')) + '</div>'
      + '</div></div>';
  });
  h += '</div>';
  host.innerHTML = h;
}

function upsPopulateSelect_(id, includeAll) {
  var sel = document.getElementById(id);
  if (!sel) return;
  var current = sel.value;
  sel.innerHTML = '';
  UPS_GROUPS.forEach(function (g) {
    if (!includeAll && !g.id) return;
    var opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.label;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function upsPopulateFilters_() {
  upsPopulateSelect_('upsFilterGroup', true);
  upsPopulateSelect_('upsCheckGroup', true);
  upsPopulateSelect_('upsAddGroup', false);
  var month = upsCurrentMonth_();
  ['upsCheckMonth'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = month;
  });
}

function upsFindRow_(id) {
  return _upsRows.find(function (r) { return String(r.id) === String(id); }) || null;
}

function upsSelectOptions_(opts, selected) {
  return opts.map(function (o) {
    var label = o ? o : 'Unchecked';
    return '<option value="' + upsEsc_(o) + '"' + (String(selected || '') === o ? ' selected' : '') + '>' + upsEsc_(label) + '</option>';
  }).join('');
}

function upsVal_(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function upsHistoryHtml_(history) {
  if (!history || !history.length) {
    return '<div class="ups-history"><p class="ups-empty">No changes recorded yet.</p></div>';
  }
  var h = '<div class="ups-history">';
  history.forEach(function (item) {
    h += '<div class="ups-history-item">'
      + '<div class="ups-history-when">' + upsEsc_(item.changedAt || '—') + '<br>' + upsEsc_(item.changedBy || '—') + '</div>'
      + '<div><strong>' + upsEsc_(upsHistoryField_(item.field)) + '</strong>'
      + (item.inspectionMonth ? '<span class="ups-month-chip">' + upsEsc_(item.inspectionMonth) + '</span>' : '')
      + '<div class="ups-history-change">' + upsEsc_(upsDisplay_(item.oldValue, '(empty)')) + ' → ' + upsEsc_(upsDisplay_(item.newValue, '(empty)')) + '</div></div></div>';
  });
  h += '</div>';
  return h;
}

function upsInspectionsHtml_(inspections) {
  if (!inspections || !inspections.length) {
    return '<p class="ups-empty">No monthly snapshots yet. Use Inspect on the checklist tab.</p>';
  }
  var h = '<div class="ups-table-wrap"><table class="ups-table"><thead><tr>'
    + '<th>Month</th><th>UPS</th><th>Battery</th><th>Room</th><th>A.C</th><th>Fault</th><th>By</th></tr></thead><tbody>';
  inspections.forEach(function (item) {
    h += '<tr>'
      + '<td>' + upsEsc_(item.month) + '</td>'
      + '<td>' + upsBadge_('upsStatus', item.upsStatus) + '</td>'
      + '<td>' + upsBadge_('batteryStatus', item.batteryStatus) + '</td>'
      + '<td>' + upsBadge_('roomClean', item.roomClean) + '</td>'
      + '<td>' + upsBadge_('acStatus', item.acStatus) + '</td>'
      + '<td class="ups-fault">' + upsEsc_(item.alarmFault || '—') + '</td>'
      + '<td>' + upsEsc_(item.inspectedBy || '—') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function upsDetailFormHtml_(row, mode) {
  var inspect = mode === 'inspect';
  var month = upsCheckMonth_();
  var h = '<div class="ups-detail-grid">'
    + '<div><label>Group</label><select id="upsEditGroup">' + upsSelectOptions_(UPS_GROUPS.filter(function (g) { return g.id; }).map(function (g) { return g.id; }), row.group) + '</select></div>'
    + '<div><label>Apartment</label><input id="upsEditApartment" type="text" value="' + upsEsc_(row.apartment) + '"></div>'
    + '<div><label>Floor</label><input id="upsEditFloor" type="text" value="' + upsEsc_(row.floor) + '"></div>'
    + '<div><label>Room</label><input id="upsEditRoom" type="text" value="' + upsEsc_(row.room) + '"></div>'
    + '<div><label>UPS KKS</label><input id="upsEditKks" type="text" value="' + upsEsc_(row.kks) + '"></div>'
    + '<div><label>Brand</label><input id="upsEditBrand" type="text" value="' + upsEsc_(row.brand) + '"></div>'
    + '<div><label>Capacity</label><input id="upsEditCapacity" type="text" value="' + upsEsc_(row.capacity) + '"></div>'
    + '</div>';
  h += '<div class="ups-detail-section"><h3>' + (inspect ? 'Checklist for ' + upsEsc_(month) : 'Current condition') + '</h3>'
    + '<div class="ups-detail-grid">'
    + '<div><label>UPS status</label><select id="upsEditUpsStatus">' + upsSelectOptions_(UPS_STATUS_OPTS, row.upsStatus) + '</select></div>'
    + '<div><label>Battery status</label><select id="upsEditBatteryStatus">' + upsSelectOptions_(UPS_STATUS_OPTS, row.batteryStatus) + '</select></div>'
    + '<div><label>Room clean</label><select id="upsEditRoomClean">' + upsSelectOptions_(UPS_YESNO_OPTS, row.roomClean) + '</select></div>'
    + '<div><label>A.C status</label><select id="upsEditAcStatus">' + upsSelectOptions_(UPS_AC_OPTS, row.acStatus) + '</select></div>'
    + '<div class="full"><label>Alarm or fault description</label><textarea id="upsEditAlarmFault" rows="2">' + upsEsc_(row.alarmFault) + '</textarea></div>'
    + '<div class="full"><label>Notes</label><textarea id="upsEditNotes" rows="2">' + upsEsc_(row.notes) + '</textarea></div>'
    + '</div></div>';
  h += '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">'
    + '<button type="button" id="upsSaveBtn" onclick="upsSaveDetail_()" style="color:#fff;background:var(--accent2);border-color:var(--accent2);">'
    + (inspect ? 'Save inspection' : 'Save') + '</button>'
    + '<button type="button" onclick="upsCloseDetail_()">Cancel</button>';
  if (upsIsAdmin_()) {
    h += '<button type="button" onclick="upsDeleteUnit_()" style="color:#fff;background:#C5504F;border-color:#C5504F;">Delete unit</button>';
  }
  h += '</div>';
  h += '<p class="ups-summary" style="margin-top:10px;">Last updated ' + upsEsc_(row.updatedAt || '—') + ' by ' + upsEsc_(row.updatedBy || '—') + '</p>';
  h += '<div class="ups-detail-section"><h3>Monthly snapshots</h3>' + upsInspectionsHtml_(row.inspections) + '</div>';
  h += '<div class="ups-detail-section"><h3>Change history</h3>' + upsHistoryHtml_(row.history) + '</div>';
  return h;
}

function upsPaintDetail_(row) {
  var title = document.getElementById('upsDetailTitle');
  var body = document.getElementById('upsDetailBody');
  if (title) title.textContent = (row.apartment || 'UPS') + ' · ' + (row.kks || '');
  if (body) body.innerHTML = upsDetailFormHtml_(row, _upsDetailMode);
  var groupSel = document.getElementById('upsEditGroup');
  if (groupSel) {
    groupSel.innerHTML = UPS_GROUPS.filter(function (g) { return g.id; }).map(function (g) {
      return '<option value="' + upsEsc_(g.id) + '"' + (row.group === g.id ? ' selected' : '') + '>' + upsEsc_(g.label) + '</option>';
    }).join('');
  }
}

function upsOpenDetail_(id, mode) {
  var row = upsFindRow_(id);
  if (!row) return;
  _upsDetailId = id;
  _upsDetailMode = mode === 'inspect' ? 'inspect' : 'edit';
  var modal = document.getElementById('upsDetailModal');
  var body = document.getElementById('upsDetailBody');
  upsPaintDetail_(row);
  if (body) body.insertAdjacentHTML('afterbegin', '<p class="ups-summary">Loading history…</p>');
  if (modal) modal.classList.add('show');
  fetchJSONRetry({ action: 'getUpsCheckDetail', token: upsToken_(), id: id }, 1, 45000).then(function (d) {
    if (!_upsDetailId || String(_upsDetailId) !== String(id)) return;
    if (!d || d.ok === false) return;
    var saved = upsNormalizeRow_(d);
    if (saved) {
      _upsRows = _upsRows.map(function (r) { return r.id === saved.id ? Object.assign({}, r, saved) : r; });
      upsPaintDetail_(saved);
    }
  }).catch(function () {});
}

function upsCloseDetail_() {
  _upsDetailId = '';
  var modal = document.getElementById('upsDetailModal');
  if (modal) modal.classList.remove('show');
}

function upsCollectForm_(row) {
  return {
    id: row.id,
    group: upsVal_('upsEditGroup') || row.group,
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
    alarmFault: upsVal_('upsEditAlarmFault'),
    notes: upsVal_('upsEditNotes')
  };
}

function upsApplySaved_(saved) {
  if (!saved || !saved.id) return;
  var found = false;
  _upsRows = _upsRows.map(function (r) {
    if (r.id !== saved.id) return r;
    found = true;
    return Object.assign({}, r, saved);
  });
  if (!found) _upsRows.push(saved);
}

function upsSaveDetail_() {
  if (_upsSaving) return;
  var row = upsFindRow_(_upsDetailId);
  if (!row) return;
  var payload = upsCollectForm_(row);
  payload.token = upsToken_();
  if (_upsDetailMode === 'inspect') {
    payload.action = 'saveUpsInspection';
    payload.month = upsCheckMonth_();
  } else {
    payload.action = 'updateUpsCheck';
  }
  var btn = document.getElementById('upsSaveBtn');
  _upsSaving = true;
  if (btn) btn.disabled = true;
  fetchJSON(payload).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Save failed');
    var saved = upsNormalizeRow_(d);
    upsApplySaved_(saved);
    upsCloseDetail_();
    upsRenderAll_();
  }).catch(function (e) {
    alert('Could not save UPS record. ' + ((e && e.message) || e));
  }).finally(function () {
    _upsSaving = false;
    if (btn) btn.disabled = false;
  });
}

function upsDeleteUnit_() {
  if (!upsIsAdmin_()) return;
  var row = upsFindRow_(_upsDetailId);
  if (!row) return;
  if (!confirm('Delete ' + (row.apartment || 'this UPS') + ' and all of its history?')) return;
  fetchJSON({ action: 'deleteUpsCheck', token: upsToken_(), id: row.id }).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Delete failed');
    _upsRows = _upsRows.filter(function (r) { return r.id !== row.id; });
    upsCloseDetail_();
    upsRenderAll_();
  }).catch(function (e) {
    alert('Could not delete. ' + ((e && e.message) || e));
  });
}

function upsAddUnit_() {
  var apartment = upsVal_('upsAddApartment');
  var group = upsVal_('upsAddGroup');
  var msg = document.getElementById('upsAddMsg');
  if (!apartment || !group) {
    if (msg) msg.textContent = 'Group and apartment are required.';
    return;
  }
  var btn = document.getElementById('upsAddBtn');
  if (btn) btn.disabled = true;
  fetchJSON({
    action: 'addUpsCheck',
    token: upsToken_(),
    group: group,
    apartment: apartment,
    floor: upsVal_('upsAddFloor') || 'Roof',
    room: upsVal_('upsAddRoom') || 'E&M',
    kks: upsVal_('upsAddKks') || 'E-A',
    brand: upsVal_('upsAddBrand'),
    capacity: upsVal_('upsAddCapacity')
  }).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Add failed');
    var saved = upsNormalizeRow_(d);
    upsApplySaved_(saved);
    if (msg) msg.textContent = 'Added ' + apartment + '. It is now in the register and checklist.';
    var apt = document.getElementById('upsAddApartment');
    if (apt) apt.value = '';
    upsRenderAll_();
  }).catch(function (e) {
    if (msg) msg.textContent = 'Could not add unit. ' + ((e && e.message) || e);
  }).finally(function () {
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
  if (!upsIsAdmin_()) return;
  if (!confirm('Replace the UPS register with the full building list? History and monthly snapshots will be cleared.')) return;
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

function upsLoadHistory_() {
  var host = document.getElementById('upsHistoryHost');
  if (host) host.innerHTML = '<p>Loading…</p>';
  var monthEl = document.getElementById('upsHistMonth');
  var payload = { action: 'getUpsHistory', token: upsToken_() };
  if (monthEl && monthEl.value) payload.month = monthEl.value;
  return fetchJSONRetry(payload, 1, 60000).then(function (d) {
    _upsHistory = Array.isArray(d) ? d : (d && Array.isArray(d.rows) ? d.rows : []);
    upsRenderHistory_();
  }).catch(function (e) {
    if (host) host.innerHTML = '<p class="worker-empty">Could not load history. ' + upsEsc_((e && e.message) || e) + '</p>';
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

function upsRenderAll_() {
  upsRenderTable_();
  upsRenderChecklist_();
  upsRenderSummary_();
}

function upsOnChecklistMonth_() {
  upsLoad_(true);
}

function upsLoad_(force) {
  var host = document.getElementById('upsTableHost');
  if (host) host.innerHTML = '<p>Loading…</p>';
  upsSetRefreshSpinning_(true);
  return upsFetchRows_(force).then(function (rows) {
    _upsRows = rows;
    upsRenderAll_();
    if (_upsActiveTab === 'history') upsLoadHistory_();
  }).catch(function (e) {
    if (host) host.innerHTML = '<p class="worker-empty">Could not load UPS data. ' + upsEsc_((e && e.message) || e) + '</p>';
  }).finally(function () {
    upsSetRefreshSpinning_(false);
  });
}

function upsSwitchTab_(ev, tab) {
  _upsActiveTab = tab;
  document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
  var pane = document.getElementById(tab);
  if (pane) pane.classList.add('active');
  if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
  if (tab === 'checklist') upsRenderChecklist_();
  if (tab === 'summary') upsRenderSummary_();
  if (tab === 'history') upsLoadHistory_();
}

function upsEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  var resetBtn = document.getElementById('upsResetBtn');
  if (resetBtn && upsIsAdmin_()) resetBtn.style.display = '';
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
