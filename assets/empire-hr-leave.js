/* HR Department — leave request HR-F-06 */

var HR_DEPT = 'hr';
var HR_LEAVE_TYPES = [
  { id: 'Annual Leave', label: 'Annual leave' },
  { id: 'Sick leave', label: 'Sick leave' },
  { id: 'Unpaid Leave', label: 'Unpaid Leave' },
  { id: 'Bereavement', label: 'Bereavement' },
  { id: 'Marriage Leave', label: 'Marriage Leave' },
  { id: 'Other', label: 'Other' }
];
var HR_ENTITLE_KEYS = [
  { key: 'annual', label: 'Annual Leave', type: 'Annual Leave' },
  { key: 'sick', label: 'Sick leave', type: 'Sick leave' },
  { key: 'unpaid', label: 'Unpaid Leave', type: 'Unpaid Leave' },
  { key: 'bereavement', label: 'Bereavement', type: 'Bereavement' },
  { key: 'marriage', label: 'Marriage Leave', type: 'Marriage Leave' },
  { key: 'other', label: 'Other', type: 'Other' }
];
var HR_STATUS_LABEL = {
  submitted: 'Submitted',
  line_approved: 'Line manager approved',
  director_approved: 'Director approved',
  processed: 'HR processed',
  rejected: 'Rejected'
};

var _hrRows = [];
var _hrSaving = false;
var _hrCanWrite = true;

function hrToken_() { return empireGetToken() || ''; }
function hrEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function hrVal_(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}
function hrSet_(id, v) {
  var el = document.getElementById(id);
  if (el) el.value = v == null ? '' : String(v);
}
function hrCanWrite_() {
  var p = typeof empireGetPerms === 'function' ? empireGetPerms() : {};
  if (p.add === false && p.edit === false) return false;
  return _hrCanWrite;
}
function hrToday_() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hrFmtDate_(iso) {
  var s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
  return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
}
function hrDaysNum_(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s) return 0;
  if (s.indexOf('half') !== -1) return 0.5;
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function hrSelectedLeaveType_() {
  var el = document.querySelector('input[name="hrLeaveType"]:checked');
  return el ? String(el.value || '') : '';
}
function hrMsg_(text, ok) {
  var el = document.getElementById('hrFormMsg');
  if (!el) return;
  el.className = 'hr-form-msg' + (text ? (ok ? ' ok' : ' err') : '');
  el.textContent = text || '';
}

function hrRenderLeaveTypes_(selected) {
  var host = document.getElementById('hrLeaveTypes');
  if (!host) return;
  host.innerHTML = HR_LEAVE_TYPES.map(function (t) {
    return '<label><input type="radio" name="hrLeaveType" value="' + hrEsc_(t.id) + '"' +
      (selected === t.id ? ' checked' : '') + ' onchange="hrOnLeaveType_()"> ' + hrEsc_(t.label) + '</label>';
  }).join('');
  hrOnLeaveType_();
}

function hrEmptyEntitlements_() {
  var o = {};
  HR_ENTITLE_KEYS.forEach(function (r) {
    o[r.key] = { annualBalance: '', available: '', requested: '', remaining: '' };
  });
  return o;
}

function hrRenderEntitlements_(data) {
  data = data || hrEmptyEntitlements_();
  var body = document.getElementById('hrEntitleBody');
  if (!body) return;
  body.innerHTML = HR_ENTITLE_KEYS.map(function (r) {
    var row = data[r.key] || {};
    return '<tr>' +
      '<td>' + hrEsc_(r.label) + '</td>' +
      '<td><input data-ent="' + r.key + '" data-col="annualBalance" value="' + hrEsc_(row.annualBalance || '') + '" oninput="hrRecalcRemain_(\'' + r.key + '\')"></td>' +
      '<td><input data-ent="' + r.key + '" data-col="available" value="' + hrEsc_(row.available || '') + '" oninput="hrRecalcRemain_(\'' + r.key + '\')"></td>' +
      '<td><input data-ent="' + r.key + '" data-col="requested" value="' + hrEsc_(row.requested || '') + '" oninput="hrRecalcRemain_(\'' + r.key + '\')"></td>' +
      '<td><input data-ent="' + r.key + '" data-col="remaining" value="' + hrEsc_(row.remaining || '') + '"></td>' +
      '</tr>';
  }).join('');
}

function hrReadEntitlements_() {
  var out = hrEmptyEntitlements_();
  document.querySelectorAll('#hrEntitleBody input[data-ent]').forEach(function (el) {
    var k = el.getAttribute('data-ent');
    var c = el.getAttribute('data-col');
    if (out[k] && c) out[k][c] = String(el.value || '').trim();
  });
  return out;
}

function hrRecalcRemain_(key) {
  var avail = document.querySelector('#hrEntitleBody input[data-ent="' + key + '"][data-col="available"]');
  var req = document.querySelector('#hrEntitleBody input[data-ent="' + key + '"][data-col="requested"]');
  var rem = document.querySelector('#hrEntitleBody input[data-ent="' + key + '"][data-col="remaining"]');
  if (!avail || !req || !rem) return;
  var a = hrDaysNum_(avail.value);
  var r = hrDaysNum_(req.value);
  if (String(avail.value || '').trim() === '' && String(req.value || '').trim() === '') {
    rem.value = '';
    return;
  }
  var left = a - r;
  rem.value = String(Math.round(left * 100) / 100);
}

function hrOnLeaveType_() {
  var type = hrSelectedLeaveType_();
  var other = document.getElementById('hrOtherWrap');
  if (other) other.style.display = type === 'Other' ? '' : 'none';
  var days = hrVal_('hr-daysOut');
  if (!days) return;
  var match = HR_ENTITLE_KEYS.find(function (r) { return r.type === type; });
  if (!match) return;
  var req = document.querySelector('#hrEntitleBody input[data-ent="' + match.key + '"][data-col="requested"]');
  if (req && !String(req.value || '').trim()) {
    req.value = days;
    hrRecalcRemain_(match.key);
  }
}

function hrOnDatesChange_() {
  var start = hrVal_('hr-startDate');
  var end = hrVal_('hr-endDate') || start;
  if (!start) return;
  if (end && end < start) hrSet_('hr-endDate', start);
  end = hrVal_('hr-endDate') || start;
  if (hrVal_('hr-daysOut')) return;
  var a = new Date(start + 'T00:00:00');
  var b = new Date(end + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return;
  var days = Math.round((b - a) / 86400000) + 1;
  if (days > 0) hrSet_('hr-daysOut', String(days));
  hrOnLeaveType_();
}

function hrCollect_() {
  return {
    id: hrVal_('hr-id'),
    empName: hrVal_('hr-empName'),
    empDepartment: hrVal_('hr-empDepartment'),
    empCode: hrVal_('hr-empCode'),
    empDivision: hrVal_('hr-empDivision'),
    empJobTitle: hrVal_('hr-empJobTitle'),
    replacement: hrVal_('hr-replacement'),
    startDate: hrVal_('hr-startDate'),
    endDate: hrVal_('hr-endDate'),
    daysOut: hrVal_('hr-daysOut'),
    leaveType: hrSelectedLeaveType_(),
    leaveOther: hrVal_('hr-leaveOther'),
    empSignature: hrVal_('hr-empSignature'),
    empSignedAt: hrVal_('hr-empSignedAt'),
    lineManagerName: hrVal_('hr-lineManagerName'),
    lineManagerSignedAt: hrVal_('hr-lineManagerSignedAt'),
    lineManagerStatus: hrVal_('hr-lineManagerStatus'),
    directorName: hrVal_('hr-directorName'),
    directorSignedAt: hrVal_('hr-directorSignedAt'),
    directorStatus: hrVal_('hr-directorStatus'),
    entitlements: hrReadEntitlements_(),
    hrComment: hrVal_('hr-hrComment'),
    hrSignature: hrVal_('hr-hrSignature'),
    hrSignedAt: hrVal_('hr-hrSignedAt'),
    status: hrVal_('hr-status') || 'submitted'
  };
}

function hrFillForm_(row) {
  row = row || {};
  hrSet_('hr-id', row.id || '');
  hrSet_('hr-empName', row.empName || '');
  hrSet_('hr-empDepartment', row.empDepartment || '');
  hrSet_('hr-empCode', row.empCode || '');
  hrSet_('hr-empDivision', row.empDivision || '');
  hrSet_('hr-empJobTitle', row.empJobTitle || '');
  hrSet_('hr-replacement', row.replacement || '');
  hrSet_('hr-startDate', row.startDate || '');
  hrSet_('hr-endDate', row.endDate || '');
  hrSet_('hr-daysOut', row.daysOut || '');
  hrRenderLeaveTypes_(row.leaveType || '');
  hrSet_('hr-leaveOther', row.leaveOther || '');
  hrSet_('hr-empSignature', row.empSignature || '');
  hrSet_('hr-empSignedAt', row.empSignedAt || '');
  hrSet_('hr-lineManagerName', row.lineManagerName || '');
  hrSet_('hr-lineManagerSignedAt', row.lineManagerSignedAt || '');
  hrSet_('hr-lineManagerStatus', row.lineManagerStatus || '');
  hrSet_('hr-directorName', row.directorName || '');
  hrSet_('hr-directorSignedAt', row.directorSignedAt || '');
  hrSet_('hr-directorStatus', row.directorStatus || '');
  hrRenderEntitlements_(row.entitlements);
  hrSet_('hr-hrComment', row.hrComment || '');
  hrSet_('hr-hrSignature', row.hrSignature || '');
  hrSet_('hr-hrSignedAt', row.hrSignedAt || '');
  hrSet_('hr-status', row.status || 'submitted');
  var no = document.getElementById('hrFormNo');
  if (no) no.textContent = row.num ? String(row.num) : 'New';
  var title = document.getElementById('hrFormTitle');
  if (title) title.textContent = row.id ? 'Edit leave request' : 'New leave request';
  var printSt = document.getElementById('hrPrintStatus');
  if (printSt) printSt.textContent = HR_STATUS_LABEL[row.status] || '';
  var printBtn = document.getElementById('hrPrintBtn');
  var delBtn = document.getElementById('hrDeleteBtn');
  var cancelBtn = document.getElementById('hrCancelEditBtn');
  if (printBtn) printBtn.style.display = row.id ? '' : 'none';
  if (delBtn) delBtn.style.display = row.id && hrCanWrite_() ? '' : 'none';
  if (cancelBtn) cancelBtn.style.display = row.id ? '' : 'none';
  var saveBtn = document.getElementById('hrSaveBtn');
  if (saveBtn) {
    saveBtn.style.display = hrCanWrite_() ? '' : 'none';
    saveBtn.textContent = row.id ? 'Save changes' : 'Save request';
  }
  hrMsg_('', true);
}

function hrClearForm_() {
  hrFillForm_({
    status: 'submitted',
    empSignedAt: hrToday_(),
    entitlements: hrEmptyEntitlements_()
  });
  hrRenderLeaveTypes_('Annual Leave');
}

function hrOpenRow_(id) {
  var row = _hrRows.find(function (r) { return String(r.id) === String(id); });
  if (!row) return;
  hrFillForm_(row);
  hrSwitchTab_(null, 'form');
}

function hrSwitchTab_(ev, tab) {
  document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
  var pane = document.getElementById(tab);
  if (pane) pane.classList.add('active');
  if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
  else {
    var btn = document.getElementById(tab === 'form' ? 'tabBtnForm' : 'tabBtnList');
    if (btn) btn.classList.add('active');
  }
  if (tab === 'form' && !hrVal_('hr-id') && !hrVal_('hr-empName')) {
    if (!document.getElementById('hrFormNo') || document.getElementById('hrFormNo').textContent === 'New') {
      if (!hrVal_('hr-empSignedAt')) hrSet_('hr-empSignedAt', hrToday_());
    }
  }
}

function hrUniqueDepts_() {
  var seen = {};
  var out = [];
  _hrRows.forEach(function (r) {
    var d = String(r.empDepartment || '').trim();
    if (!d || seen[d.toLowerCase()]) return;
    seen[d.toLowerCase()] = true;
    out.push(d);
  });
  out.sort(function (a, b) { return a.localeCompare(b); });
  return out;
}

function hrFiltered_() {
  var status = hrVal_('hrFilterStatus');
  var dept = hrVal_('hrFilterDept');
  var month = hrVal_('hrFilterMonth');
  var q = hrVal_('hrFilterSearch').toLowerCase();
  return _hrRows.filter(function (r) {
    if (status && String(r.status || '') !== status) return false;
    if (dept && String(r.empDepartment || '') !== dept) return false;
    if (month && String(r.startDate || '').slice(0, 7) !== month) return false;
    if (q) {
      var hay = [r.no, r.empName, r.empCode, r.empDepartment, r.empJobTitle, r.leaveType, r.replacement, r.daysOut]
        .join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function hrRenderKpis_(list) {
  var host = document.getElementById('hrKpiRow');
  if (!host) return;
  var pending = list.filter(function (r) { return r.status !== 'processed' && r.status !== 'rejected'; }).length;
  var processed = list.filter(function (r) { return r.status === 'processed'; }).length;
  var rejected = list.filter(function (r) { return r.status === 'rejected'; }).length;
  host.innerHTML =
    '<div class="hr-kpi"><b>' + list.length + '</b><span>Shown</span></div>' +
    '<div class="hr-kpi"><b>' + pending + '</b><span>Pending</span></div>' +
    '<div class="hr-kpi"><b>' + processed + '</b><span>Processed</span></div>' +
    '<div class="hr-kpi"><b>' + rejected + '</b><span>Rejected</span></div>';
}

function hrRenderTable_() {
  var host = document.getElementById('hrTableHost');
  var summary = document.getElementById('hrSummary');
  if (!host) return;
  var deptEl = document.getElementById('hrFilterDept');
  if (deptEl && !deptEl.getAttribute('data-ready')) {
    deptEl.innerHTML = '<option value="">All departments</option>' + hrUniqueDepts_().map(function (d) {
      return '<option value="' + hrEsc_(d) + '">' + hrEsc_(d) + '</option>';
    }).join('');
    deptEl.setAttribute('data-ready', '1');
  } else if (deptEl) {
    var keep = deptEl.value;
    deptEl.innerHTML = '<option value="">All departments</option>' + hrUniqueDepts_().map(function (d) {
      return '<option value="' + hrEsc_(d) + '">' + hrEsc_(d) + '</option>';
    }).join('');
    deptEl.value = keep;
  }
  var list = hrFiltered_();
  hrRenderKpis_(list);
  if (summary) {
    summary.textContent = list.length + ' request' + (list.length === 1 ? '' : 's') +
      (list.length !== _hrRows.length ? ' of ' + _hrRows.length : '');
  }
  if (!list.length) {
    host.innerHTML = typeof empireEmptyHtml === 'function'
      ? empireEmptyHtml('No leave requests', 'Use New request to fill HR-F-06.')
      : '<p>No leave requests yet.</p>';
    return;
  }
  var write = hrCanWrite_();
  var h = '<div class="hr-table-wrap"><table class="hr-list-table"><thead><tr>' +
    '<th>#</th><th>Employee</th><th>Department</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th>' +
    '</tr></thead><tbody>';
  list.forEach(function (r) {
    var st = String(r.status || 'submitted');
    h += '<tr>' +
      '<td>' + hrEsc_(r.no || r.num || '') + '</td>' +
      '<td><strong>' + hrEsc_(r.empName || '—') + '</strong><div style="color:var(--text-soft);font-size:12px;">' + hrEsc_(r.empCode || '') + '</div></td>' +
      '<td>' + hrEsc_(r.empDepartment || '—') + '</td>' +
      '<td>' + hrEsc_(r.leaveType || '—') + '</td>' +
      '<td>' + hrEsc_(hrFmtDate_(r.startDate)) + (r.endDate && r.endDate !== r.startDate ? ' – ' + hrEsc_(hrFmtDate_(r.endDate)) : '') + '</td>' +
      '<td>' + hrEsc_(r.daysOut || '—') + '</td>' +
      '<td><span class="hr-badge hr-badge-' + hrEsc_(st) + '">' + hrEsc_(HR_STATUS_LABEL[st] || st) + '</span></td>' +
      '<td><div class="hr-row-acts">' +
        '<button type="button" onclick="hrOpenRow_(\'' + hrEsc_(r.id) + '\')">' + (write ? 'Open' : 'View') + '</button>' +
        '<button type="button" onclick="hrOpenRow_(\'' + hrEsc_(r.id) + '\');setTimeout(hrPrint_,80)">Print</button>' +
      '</div></td></tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}

function hrLoad_(force) {
  var host = document.getElementById('hrTableHost');
  if (host && !_hrRows.length) host.innerHTML = typeof empireLoadingHtml === 'function' ? empireLoadingHtml('Loading leave requests…') : '<p>Loading…</p>';
  return fetchJSONRetry({ action: 'getHrLeaveRequests', token: hrToken_() }, force ? 1 : 2, 45000)
    .then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Could not load');
      _hrRows = Array.isArray(d.rows) ? d.rows : (Array.isArray(d) ? d : []);
      hrRenderTable_();
    })
    .catch(function (err) {
      if (host) {
        host.innerHTML = typeof empireErrorHtml === 'function'
          ? empireErrorHtml(err.message || 'Could not load leave requests.', 'Try Refresh.')
          : '<p>' + hrEsc_(err.message || 'Load failed') + '</p>';
      }
    });
}

function hrSave_() {
  if (_hrSaving || !hrCanWrite_()) return;
  var body = hrCollect_();
  if (!body.empName) { hrMsg_('Employee name is required.', false); return; }
  if (!body.startDate) { hrMsg_('Start date is required.', false); return; }
  if (!body.leaveType) { hrMsg_('Select a type of leave.', false); return; }
  if (body.lineManagerStatus === 'rejected' || body.directorStatus === 'rejected') {
    if (body.status !== 'rejected') body.status = 'rejected';
  }
  _hrSaving = true;
  hrMsg_('Saving…', true);
  var action = body.id ? 'updateHrLeaveRequest' : 'addHrLeaveRequest';
  fetchJSONRetry(Object.assign({ action: action, token: hrToken_() }, body), 1, 45000)
    .then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Save failed');
      hrMsg_('Saved.', true);
      if (d.row) hrFillForm_(d.row);
      return hrLoad_(true);
    })
    .catch(function (err) {
      hrMsg_(err.message || 'Save failed.', false);
    })
    .finally(function () {
      _hrSaving = false;
    });
}

function hrDelete_() {
  var id = hrVal_('hr-id');
  if (!id || !hrCanWrite_()) return;
  var go = function () {
    fetchJSONRetry({ action: 'deleteHrLeaveRequest', token: hrToken_(), id: id }, 1, 30000)
      .then(function (d) {
        if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
        if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Delete failed');
        hrClearForm_();
        hrSwitchTab_(null, 'list');
        return hrLoad_(true);
      })
      .catch(function (err) {
        hrMsg_(err.message || 'Delete failed.', false);
      });
  };
  if (typeof uiConfirm === 'function') {
    uiConfirm('Delete this leave request?').then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm('Delete this leave request?')) go();
}

function hrPrint_() {
  var st = document.getElementById('hrPrintStatus');
  if (st) st.textContent = HR_STATUS_LABEL[hrVal_('hr-status')] || '';
  window.print();
}

function hrEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  _hrCanWrite = hrCanWrite_();
  hrRenderLeaveTypes_('Annual Leave');
  hrRenderEntitlements_(hrEmptyEntitlements_());
  if (!hrVal_('hr-empSignedAt')) hrSet_('hr-empSignedAt', hrToday_());
  var saveBtn = document.getElementById('hrSaveBtn');
  if (saveBtn && !_hrCanWrite) saveBtn.style.display = 'none';
  hrLoad_(false);
}

function hrHandleLogin_(e) {
  empireAuthLogin(e, HR_DEPT, {
    onSuccess: function () { hrEnterApp_(); }
  });
}

function hrLogout_() {
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function hrInit_() {
  if (!empireAuthPageBoot({
    dept: HR_DEPT,
    sendToHomeLogin: false,
    onEnter: hrEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', hrInit_);
