/* HR Department — leave request HR-F-06 */

var HR_DEPT = 'hr';
var HR_LEAVE_TYPES = [
  { id: 'Lateness', label: 'Lateness' },
  { id: 'Annual Leave', label: 'Annual leave' },
  { id: 'Sick leave', label: 'Sick leave' },
  { id: 'Unpaid Leave', label: 'Unpaid Leave' },
  { id: 'Bereavement', label: 'Bereavement' },
  { id: 'Marriage Leave', label: 'Marriage Leave' },
  { id: 'Other', label: 'Other' }
];
var HR_ENTITLE_KEYS = [
  { key: 'lateness', label: 'Lateness', type: 'Lateness' },
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
  pending_director: 'Pending Director',
  director_approved: 'Completed',
  completed: 'Completed',
  processed: 'Completed',
  rejected: 'Rejected'
};
var HR_STAGES = [
  { id: 'inbox', label: 'Leave requests' },
  { id: 'pending_director', label: 'Pending Director' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' }
];

var _hrRows = [];
var _hrSaving = false;
var _hrCanWrite = true;
var _hrListEditing = false;
var _hrReturnTab = 'list';
var _hrSigs = { emp: '', line: '', director: '', hr: '' };
var _hrScan = { url: '', directorSig: '', x: 0.56, y: 0.36, w: 0.2 };
var _hrScanDrag = null;
var _hrPaperTemplate = null;
var _hrPapersReady = false;
var _hrSelectMode = false;
var _hrSelected = {};
var _hrBulkBusy = false;
var _hrDoneSelectMode = false;
var _hrDoneSelected = {};
var _hrConfirmedSelectMode = false;
var _hrConfirmedSelected = {};

function hrSelectedIds_() {
  return Object.keys(_hrSelected).filter(function (id) { return !!_hrSelected[id]; });
}

function hrToggleSelectMode_(on) {
  if (_hrBulkBusy) return;
  _hrSelectMode = on === undefined ? !_hrSelectMode : !!on;
  if (!_hrSelectMode) _hrSelected = {};
  hrRenderTable_();
}

function hrToggleRowSelect_(id, ev) {
  if (ev) ev.stopPropagation();
  if (_hrBulkBusy) return;
  id = String(id || '');
  if (!id) return;
  if (_hrSelected[id]) delete _hrSelected[id];
  else _hrSelected[id] = true;
  var box = document.getElementById('hrSel-' + id);
  if (box) box.checked = !!_hrSelected[id];
  var row = box && box.closest('tr');
  if (row) row.classList.toggle('hr-row-selected', !!_hrSelected[id]);
  var n = hrSelectedIds_().length;
  var count = document.getElementById('hrSelectCount');
  if (count) count.textContent = n ? n + ' selected' : 'Select papers';
  var all = document.getElementById('hrSelAll');
  if (all) {
    var boxes = document.querySelectorAll('input[data-hr-sel]');
    all.checked = boxes.length > 0 && n === boxes.length;
  }
}

function hrSelectableStage_() {
  return hrIsDirectorOnly_() ? 'pending_director' : 'inbox';
}

function hrCanSelectGroup_(g) {
  if (!g || !g.rows.length) return false;
  if (hrIsDirectorOnly_()) return g.type === 'pending_director';
  return hrCanWrite_() && g.type === 'inbox';
}

function hrSelectAllVisible_(ev) {
  if (_hrBulkBusy) return;
  var on = !!(ev && ev.target && ev.target.checked);
  var stage = hrSelectableStage_();
  _hrSelected = {};
  if (on) {
    hrFiltered_().forEach(function (r) {
      if (hrStageOf_(r) === stage) _hrSelected[String(r.id)] = true;
    });
  }
  hrRenderTable_();
}

function hrDoneSelectedIds_() {
  return Object.keys(_hrDoneSelected).filter(function (id) { return !!_hrDoneSelected[id]; });
}

function hrCompletedRows_() {
  return (_hrRows || []).filter(function (r) { return hrStageOf_(r) === 'completed'; });
}

function hrToggleDoneSelectMode_(on) {
  _hrDoneSelectMode = on === undefined ? !_hrDoneSelectMode : !!on;
  if (!_hrDoneSelectMode) _hrDoneSelected = {};
  hrRenderDoneTable_();
}

function hrToggleDoneRowSelect_(id, ev) {
  if (ev) ev.stopPropagation();
  id = String(id || '');
  if (!id) return;
  if (_hrDoneSelected[id]) delete _hrDoneSelected[id];
  else _hrDoneSelected[id] = true;
  var box = document.getElementById('hrDoneSel-' + id);
  if (box) box.checked = !!_hrDoneSelected[id];
  var row = box && box.closest('tr');
  if (row) row.classList.toggle('hr-row-selected', !!_hrDoneSelected[id]);
  var n = hrDoneSelectedIds_().length;
  var count = document.getElementById('hrDoneSelectCount');
  if (count) count.textContent = n ? n + ' selected' : 'Select papers';
  var all = document.getElementById('hrDoneSelAll');
  if (all) {
    var boxes = document.querySelectorAll('input[data-hr-done-sel]');
    all.checked = boxes.length > 0 && n === boxes.length;
  }
}

function hrSelectAllDone_(ev) {
  var on = !!(ev && ev.target && ev.target.checked);
  _hrDoneSelected = {};
  if (on) {
    hrCompletedRows_().forEach(function (r) { _hrDoneSelected[String(r.id)] = true; });
  }
  hrRenderDoneTable_();
}

function hrConfirmedSelectedIds_() {
  return Object.keys(_hrConfirmedSelected).filter(function (id) { return !!_hrConfirmedSelected[id]; });
}

function hrToggleConfirmedSelectMode_(on) {
  _hrConfirmedSelectMode = on === undefined ? !_hrConfirmedSelectMode : !!on;
  if (!_hrConfirmedSelectMode) _hrConfirmedSelected = {};
  hrRenderConfirmedTable_();
}

function hrToggleConfirmedRowSelect_(id, ev) {
  if (ev) ev.stopPropagation();
  id = String(id || '');
  if (!id) return;
  if (_hrConfirmedSelected[id]) delete _hrConfirmedSelected[id];
  else _hrConfirmedSelected[id] = true;
  var box = document.getElementById('hrConfirmedSel-' + id);
  if (box) box.checked = !!_hrConfirmedSelected[id];
  var row = box && box.closest('tr');
  if (row) row.classList.toggle('hr-row-selected', !!_hrConfirmedSelected[id]);
  var n = hrConfirmedSelectedIds_().length;
  var count = document.getElementById('hrConfirmedSelectCount');
  if (count) count.textContent = n ? n + ' selected' : 'Select papers';
  var all = document.getElementById('hrConfirmedSelAll');
  if (all) {
    var boxes = document.querySelectorAll('input[data-hr-confirmed-sel]');
    all.checked = boxes.length > 0 && n === boxes.length;
  }
}

function hrSelectAllConfirmed_(ev) {
  var on = !!(ev && ev.target && ev.target.checked);
  _hrConfirmedSelected = {};
  if (on) {
    hrCompletedRows_().forEach(function (r) { _hrConfirmedSelected[String(r.id)] = true; });
  }
  hrRenderConfirmedTable_();
}

function hrWaitImages_(root, cb) {
  var finished = false;
  var finish = function () {
    if (finished) return;
    finished = true;
    cb();
  };
  var imgs = root ? root.querySelectorAll('img') : [];
  var left = imgs.length;
  if (!left) {
    finish();
    return;
  }
  var tick = function () {
    left--;
    if (left <= 0) finish();
  };
  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].complete) tick();
    else {
      imgs[i].addEventListener('load', tick);
      imgs[i].addEventListener('error', tick);
    }
  }
  setTimeout(finish, 5000);
}

function hrBatchScanPage_(row) {
  var scan = row.entitlements && row.entitlements.__scan;
  var page = document.createElement('div');
  page.className = 'hr-batch-page hr-batch-scan-page';
  var stage = document.createElement('div');
  stage.className = 'hr-scan-stage';
  var img = document.createElement('img');
  img.className = 'hr-batch-scan-img';
  img.alt = row.empName || 'Scanned leave form';
  img.src = scan.url;
  stage.appendChild(img);
  if (scan.directorSig) {
    var sig = document.createElement('img');
    sig.className = 'hr-scan-dir-sig';
    sig.alt = 'Director e-signature';
    sig.src = scan.directorSig;
    sig.style.left = ((Number(scan.x) || 0.56) * 100) + '%';
    sig.style.top = ((Number(scan.y) || 0.36) * 100) + '%';
    sig.style.width = ((Number(scan.w) || 0.2) * 100) + '%';
    stage.appendChild(sig);
  }
  page.appendChild(stage);
  return page;
}

function hrBatchFormPage_(row, i) {
  var page = document.createElement('div');
  page.className = 'hr-batch-page';
  var clone = hrMakePaperClone_('hr-batch-' + i + '-' + String(row.id || '').replace(/[^a-zA-Z0-9_-]/g, ''), row.leaveType);
  if (clone) {
    hrFillPaperClone_(clone, row);
    page.appendChild(clone);
  }
  return page;
}

function hrClearBatchPrint_() {
  document.body.classList.remove('hr-print-batch');
  var host = document.getElementById('hrBatchPrint');
  if (host) {
    host.innerHTML = '';
    host.hidden = true;
  }
}

function hrPrintCompletedByIds_(ids, emptyMsg) {
  ids = ids || [];
  if (!ids.length) {
    alert(emptyMsg || 'Select at least one paper first.');
    return;
  }
  var rows = ids.map(function (id) {
    return _hrRows.find(function (r) { return String(r.id) === String(id); });
  }).filter(function (r) { return r && hrStageOf_(r) === 'completed'; });
  if (!rows.length) {
    alert(emptyMsg || 'Select at least one paper first.');
    return;
  }
  var host = document.getElementById('hrBatchPrint');
  if (!host) return;
  hrSnapshotPaperTemplate_();
  host.innerHTML = '';
  rows.forEach(function (row, i) {
    var scan = row.entitlements && row.entitlements.__scan;
    host.appendChild(scan && scan.url ? hrBatchScanPage_(row) : hrBatchFormPage_(row, i));
  });
  host.hidden = false;
  hrMsg_('Preparing ' + rows.length + ' paper' + (rows.length === 1 ? '' : 's') + '… In the print window choose Save as PDF.', true);
  hrWaitImages_(host, function () {
    document.body.classList.remove('hr-print-scan');
    document.body.classList.add('hr-print-batch');
    window.print();
  });
}

function hrPrintSelectedCompleted_() {
  if (hrIsDirectorOnly_()) return;
  hrPrintCompletedByIds_(hrDoneSelectedIds_(), 'Select at least one completed paper first.');
}

function hrPrintSelectedConfirmed_() {
  hrPrintCompletedByIds_(hrConfirmedSelectedIds_(), 'Select at least one confirmed paper first.');
}

function hrDirectorConfirmRequest_(id) {
  id = String(id || '').trim();
  var row = _hrRows.find(function (r) { return String(r.id) === id; });
  if (!row || hrStageOf_(row) !== 'pending_director') {
    return Promise.reject(new Error('That paper is not waiting for the director.'));
  }
  var sig = '';
  if (hrVal_('hr-id') === id) sig = (_hrSigs && _hrSigs.director) || '';
  if (!sig && row.entitlements && row.entitlements.__sigs) sig = row.entitlements.__sigs.director || '';
  if (!sig) sig = hrAccountDirectorSig_();
  if (!sig) return Promise.reject(new Error('Add your e-signature in the Director box, then Confirm.'));
  var extra = {
    action: 'confirmHrLeaveRequest',
    token: hrToken_(),
    id: id,
    directorSignature: sig,
    directorName: (hrVal_('hr-id') === id ? hrVal_('hr-directorName') : row.directorName) ||
      (typeof empireGetUser === 'function' ? empireGetUser() : ''),
    directorSignedAt: (hrVal_('hr-id') === id ? hrVal_('hr-directorSignedAt') : row.directorSignedAt) || hrToday_(),
    entitlements: Object.assign({}, hrVal_('hr-id') === id ? hrReadEntitlements_() : (row.entitlements || {}))
  };
  extra.entitlements.__sigs = Object.assign({}, extra.entitlements.__sigs || {}, { director: sig });
  return fetchJSONRetry(extra, 1, 30000).then(function (d) {
    if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) {
      throw new Error('Session expired');
    }
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Confirm failed');
    return d;
  });
}

function hrDirectorRejectRequest_(id) {
  id = String(id || '').trim();
  return fetchJSONRetry({ action: 'rejectHrLeaveRequest', token: hrToken_(), id: id }, 1, 30000).then(function (d) {
    if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) {
      throw new Error('Session expired');
    }
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Reject failed');
    return d;
  });
}

function hrRunSelectedPending_(kind) {
  if (_hrBulkBusy || !hrIsDirectorOnly_()) return;
  var ids = hrSelectedIds_();
  if (!ids.length) {
    hrMsg_('Select at least one paper first.', false);
    return;
  }
  if (kind === 'confirm' && !hrAccountDirectorSig_()) {
    hrMsg_('Add your e-signature in the Director box, then Confirm.', false);
    return;
  }
  var n = ids.length;
  var verb = kind === 'reject' ? 'Reject' : 'Confirm';
  var detail = kind === 'reject'
    ? verb + ' ' + n + ' selected paper' + (n === 1 ? '' : 's') + '? They go to HR as Rejected, with no e-signature.'
    : verb + ' ' + n + ' selected paper' + (n === 1 ? '' : 's') + '? Your e-signature is applied to each.';
  var go = function () {
    hrRunBulkIds_(ids, kind === 'reject' ? hrDirectorRejectRequest_ : hrDirectorConfirmRequest_, {
      working: verb + 'ing ' + n + '…',
      done: kind === 'reject'
        ? 'Sent ' + n + ' back to HR as Rejected, without an e-signature.'
        : 'Sent ' + n + ' back to HR as Completed.',
      tab: kind === 'reject' ? 'list' : 'confirmed'
    });
  };
  if (typeof uiConfirm === 'function') {
    uiConfirm(detail).then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm(detail)) go();
}

function hrStaffConfirmRequest_(id) {
  id = String(id || '').trim();
  var row = _hrRows.find(function (r) { return String(r.id) === id; });
  if (!row || hrStageOf_(row) !== 'inbox') {
    return Promise.reject(new Error('That paper cannot be confirmed.'));
  }
  return fetchJSONRetry({ action: 'confirmHrLeaveRequest', token: hrToken_(), id: id }, 1, 30000).then(function (d) {
    if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) {
      throw new Error('Session expired');
    }
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Confirm failed');
    return d;
  });
}

function hrDeleteRequest_(id) {
  id = String(id || '').trim();
  return fetchJSONRetry({ action: 'deleteHrLeaveRequest', token: hrToken_(), id: id }, 1, 30000).then(function (d) {
    if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) {
      throw new Error('Session expired');
    }
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Delete failed');
    if (hrVal_('hr-id') === id) hrClearForm_();
    return d;
  });
}

function hrRunBulkIds_(ids, requestFn, msgs) {
  _hrBulkBusy = true;
  hrMsg_(msgs.working, true);
  var n = ids.length;
  var i = 0;
  var fail = 0;
  var lastErr = '';
  var step = function () {
    if (i >= ids.length) {
      _hrBulkBusy = false;
      _hrSelectMode = false;
      _hrSelected = {};
      hrSetListEditing_(false);
      return hrLoad_(true).then(function () {
        if (msgs.tab) hrSwitchTab_(null, msgs.tab);
        if (fail) hrMsg_((n - fail) + ' done, ' + fail + ' failed' + (lastErr ? ': ' + lastErr : '.'), false);
        else hrMsg_(msgs.done, true);
      });
    }
    requestFn(ids[i++]).then(function () { step(); }).catch(function (err) {
      fail++;
      lastErr = err && err.message ? err.message : String(err || 'failed');
      step();
    });
  };
  step();
}

function hrRunSelectedInbox_(kind) {
  if (_hrBulkBusy || !hrCanWrite_() || hrIsDirectorOnly_()) return;
  var ids = hrSelectedIds_();
  if (!ids.length) {
    hrMsg_('Select at least one paper first.', false);
    return;
  }
  var n = ids.length;
  var confirmKind = kind === 'confirm';
  var detail = confirmKind
    ? 'Confirm ' + n + ' selected paper' + (n === 1 ? '' : 's') + '? They go to Pending Director.'
    : 'Delete ' + n + ' selected paper' + (n === 1 ? '' : 's') + '? They move to the Recycle Bin.';
  var go = function () {
    hrRunBulkIds_(ids, confirmKind ? hrStaffConfirmRequest_ : hrDeleteRequest_, {
      working: (confirmKind ? 'Confirming ' : 'Deleting ') + n + '…',
      done: confirmKind
        ? 'Sent ' + n + ' to Pending Director.'
        : 'Moved ' + n + ' to the Recycle Bin.'
    });
  };
  if (typeof uiConfirm === 'function') {
    uiConfirm(detail, confirmKind ? {} : { danger: true }).then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm(detail)) go();
}

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
  if (el) hrSyncPaperDate_(el);
  if (id === 'hr-daysOut') hrAutosizeDaysOut_(el);
}
function hrAutosizeDaysOut_(el) {
  el = el || document.getElementById('hr-daysOut');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(22, el.scrollHeight) + 'px';
}
function hrIsHrStaff_() {
  if (typeof empireIsAdminRole === 'function' && empireIsAdminRole()) return true;
  return typeof empireModuleLevel === 'function' && empireModuleLevel('hr') === 'write';
}
function hrIsDirector_() {
  return typeof empireModuleLevel === 'function' && empireModuleLevel('hr_director') !== 'none';
}
function hrIsDirectorOnly_() {
  return hrIsDirector_() && !hrIsHrStaff_();
}
function hrAccountDirectorSig_() {
  return typeof empireGetSignature === 'function' ? String(empireGetSignature() || '').trim() : '';
}

function hrApplyAccountDirectorSig_(row) {
  if (!hrDirectorCanSign_(row)) return;
  if (_hrSigs.director) return;
  var saved = hrAccountDirectorSig_();
  if (!saved) return;
  _hrSigs.director = saved;
  if (!hrVal_('hr-directorName')) {
    hrSet_('hr-directorName', typeof empireGetUser === 'function' ? empireGetUser() : '');
  }
  if (!hrVal_('hr-directorSignedAt')) hrSet_('hr-directorSignedAt', hrToday_());
  hrSet_('hr-directorStatus', 'approved');
}

function hrStageOf_(r) {
  var s = String((r && r.status) || 'submitted');
  if (s === 'pending_director') return 'pending_director';
  if (s === 'completed' || s === 'processed' || s === 'director_approved') return 'completed';
  if (s === 'rejected') return 'rejected';
  return 'inbox';
}
function hrPaperLocked_(row) {
  var st = row ? String(row.status || '') : hrVal_('hr-status');
  return hrStageOf_({ status: st }) !== 'inbox';
}
function hrDirectorCanSign_(row) {
  var st = row ? String(row.status || '') : hrVal_('hr-status');
  return hrIsDirectorOnly_() && st === 'pending_director';
}
function hrCanWrite_() {
  if (hrIsDirectorOnly_()) return false;
  var p = typeof empireGetPerms === 'function' ? empireGetPerms() : {};
  if (p.add === false && p.edit === false) return false;
  return _hrCanWrite;
}
var HR_MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
var HR_MONTHS_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hrToday_() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hrFmtPaperDate_(iso) {
  var s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  var day = parseInt(s.slice(8, 10), 10);
  var month = parseInt(s.slice(5, 7), 10);
  if (!day || month < 1 || month > 12) return '';
  return day + '-' + HR_MONTHS_SHORT[month - 1] + '-' + s.slice(0, 4);
}
function hrFmtAbsenceDate_(iso) {
  var s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  var day = parseInt(s.slice(8, 10), 10);
  var month = parseInt(s.slice(5, 7), 10);
  if (!day || month < 1 || month > 12) return '';
  return day + '-' + HR_MONTHS_TITLE[month - 1] + '-' + s.slice(2, 4);
}
function hrFmtDate_(iso) {
  return hrFmtPaperDate_(iso) || String(iso || '').trim() || '—';
}
function hrSyncPaperDate_(el) {
  if (!el || !el.id) return;
  var view = document.getElementById(el.id + '-view');
  if (!view) return;
  view.value = (el.id === 'hr-startDate' || el.id === 'hr-endDate')
    ? hrFmtAbsenceDate_(el.value)
    : hrFmtPaperDate_(el.value);
}
function hrSyncAllPaperDates_() {
  ['hr-startDate', 'hr-endDate', 'hr-hrSignedAt'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) hrSyncPaperDate_(el);
  });
}
function hrOpenPaperDate_(id) {
  if (id === 'hr-hrSignedAt') return;
  if (!hrCanWrite_()) return;
  var el = document.getElementById(id);
  if (!el) return;
  if (typeof el.showPicker === 'function') {
    try { el.showPicker(); return; } catch (err) { /* fall through */ }
  }
  el.focus();
}
function hrDaysNum_(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s) return 0;
  if (s.indexOf('half') !== -1) return 0.5;
  var hour = s.match(/^(\d+(?:\.\d+)?)\s*h/);
  if (hour) return parseFloat(hour[1]) / 8;
  var min = s.match(/^(\d+(?:\.\d+)?)\s*m/);
  if (min) return parseFloat(min[1]) / (8 * 60);
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function hrSelectedLeaveType_() {
  return hrVal_('hr-leaveType');
}
function hrMsg_(text, ok) {
  ['hrFormMsg', 'hrScanMsg'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'hr-form-msg' + (text ? (ok ? ' ok' : ' err') : '');
    el.textContent = text || '';
  });
}

function hrRenderLeaveTypes_(selected) {
  var sel = document.getElementById('hr-leaveType');
  var want = selected || 'Lateness';
  if (sel) {
    sel.innerHTML = HR_LEAVE_TYPES.map(function (t) {
      return '<option value="' + hrEsc_(t.id) + '">' + hrEsc_(t.label) + '</option>';
    }).join('');
    sel.value = want;
    if (sel.value !== want) sel.value = 'Lateness';
  }
  hrOnLeaveType_();
}

function hrEmptySigs_() {
  return { emp: '', line: '', director: '', hr: '' };
}

function hrRenderSig_(slot) {
  var pad = document.getElementById('hr-sig-' + slot);
  if (!pad) return;
  var url = _hrSigs[slot] || '';
  pad.innerHTML = url ? '<img src="' + url + '" alt="">' : '';
}

function hrRenderAllSigs_() {
  ['emp', 'line', 'director', 'hr'].forEach(hrRenderSig_);
}

function hrOpenSig_(slot) {
  if (slot === 'hr') return;
  if (hrDirectorCanSign_() && slot === 'director') {
    /* director may sign the Director box only */
  } else if (!hrCanWrite_() || hrPaperLocked_()) {
    return;
  }
  var inp = document.getElementById('hr-sig-file');
  if (!inp) return;
  inp.setAttribute('data-slot', slot);
  inp.click();
}

function hrProcessSigImage_(dataUrl, cb) {
  var img = new Image();
  img.onload = function () {
    try {
      var maxW = 900;
      var maxH = 360;
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      var scale = Math.min(1, maxW / w, maxH / h);
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      var imageData = ctx.getImageData(0, 0, cw, ch);
      var d = imageData.data;
      var minX = cw;
      var minY = ch;
      var maxX = 0;
      var maxY = 0;
      var found = false;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i];
        var g = d[i + 1];
        var b = d[i + 2];
        var a = d[i + 3];
        if (a < 8) {
          d[i + 3] = 0;
          continue;
        }
        var lum = 0.299 * r + 0.587 * g + 0.114 * b;
        var ink = Math.max(0, Math.min(1, (205 - lum) / 95));
        if (ink < 0.12) {
          d[i] = 0;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = 0;
          continue;
        }
        d[i] = 16;
        d[i + 1] = 38;
        d[i + 2] = 125;
        d[i + 3] = Math.round(Math.pow(ink, 0.85) * 255);
        var px = (i / 4) % cw;
        var py = Math.floor((i / 4) / cw);
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        found = true;
      }
      ctx.putImageData(imageData, 0, 0);
      if (!found) {
        cb(canvas.toDataURL('image/png'));
        return;
      }
      var pad = 4;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(cw - 1, maxX + pad);
      maxY = Math.min(ch - 1, maxY + pad);
      var tw = Math.max(1, maxX - minX + 1);
      var th = Math.max(1, maxY - minY + 1);
      var out = document.createElement('canvas');
      out.width = tw;
      out.height = th;
      var octx = out.getContext('2d');
      octx.clearRect(0, 0, tw, th);
      octx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
      cb(out.toDataURL('image/png'));
    } catch (err) {
      cb(dataUrl);
    }
  };
  img.onerror = function () { cb(dataUrl); };
  img.src = dataUrl;
}

function hrOnSigFile_(e) {
  var file = e.target.files && e.target.files[0];
  var slot = e.target.getAttribute('data-slot');
  e.target.value = '';
  if (!file || !slot) return;
  var reader = new FileReader();
  reader.onload = function () {
    hrProcessSigImage_(String(reader.result || ''), function (url) {
      _hrSigs[slot] = url;
      hrRenderSig_(slot);
      if (slot === 'director') hrApplyDirectorOnly_(url, false);
    });
  };
  reader.readAsDataURL(file);
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
  body.innerHTML = HR_ENTITLE_KEYS.filter(function (r) { return r.key !== 'lateness'; }).map(function (r) {
    var row = data[r.key] || {};
    return '<tr>' +
      '<td class="lab"><span class="hr-lbl">' + hrEsc_(r.label) + '</span></td>' +
      '<td><input class="hr-cell-input" data-ent="' + r.key + '" data-col="annualBalance" value="' + hrEsc_(row.annualBalance || '') + '" readonly tabindex="-1"></td>' +
      '<td><input class="hr-cell-input" data-ent="' + r.key + '" data-col="available" value="' + hrEsc_(row.available || '') + '" readonly tabindex="-1"></td>' +
      '<td><input class="hr-cell-input" data-ent="' + r.key + '" data-col="requested" value="' + hrEsc_(row.requested || '') + '" readonly tabindex="-1"></td>' +
      '<td><input class="hr-cell-input" data-ent="' + r.key + '" data-col="remaining" value="' + hrEsc_(row.remaining || '') + '" readonly tabindex="-1"></td>' +
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
  if (_hrSigs.emp || _hrSigs.line || _hrSigs.director || _hrSigs.hr) {
    out.__sigs = {
      emp: _hrSigs.emp || '',
      line: _hrSigs.line || '',
      director: _hrSigs.director || '',
      hr: _hrSigs.hr || ''
    };
  }
  if (_hrScan.url) {
    out.__scan = {
      url: _hrScan.url,
      directorSig: _hrScan.directorSig || _hrSigs.director || '',
      x: _hrScan.x,
      y: _hrScan.y,
      w: _hrScan.w
    };
  }
  return out;
}

function hrRecalcRemain_(_key) {
  return;
}

function hrOnLeaveType_() {
  var type = hrSelectedLeaveType_();
  var other = document.getElementById('hr-leaveOther');
  if (other) other.style.display = type === 'Other' ? '' : 'none';
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
  hrRenderLeaveTypes_(row.leaveType || 'Lateness');
  hrSet_('hr-leaveOther', row.leaveOther || '');
  hrSet_('hr-empSignature', row.empSignature || '');
  hrSet_('hr-empSignedAt', row.empSignedAt || hrToday_());
  hrSet_('hr-lineManagerName', row.lineManagerName || '');
  hrSet_('hr-lineManagerSignedAt', row.lineManagerSignedAt || '');
  hrSet_('hr-lineManagerStatus', row.lineManagerStatus || '');
  hrSet_('hr-directorName', row.directorName || '');
  hrSet_('hr-directorSignedAt', row.directorSignedAt || '');
  hrSet_('hr-directorStatus', row.directorStatus || '');
  var ents = row.entitlements || {};
  _hrSigs = Object.assign(hrEmptySigs_(), ents.__sigs || {});
  _hrScan = hrEmptyScan_();
  if (ents.__scan && ents.__scan.url) {
    _hrScan.url = ents.__scan.url || '';
    _hrScan.directorSig = ents.__scan.directorSig || _hrSigs.director || '';
    if (ents.__scan.x != null) _hrScan.x = Number(ents.__scan.x) || _hrScan.x;
    if (ents.__scan.y != null) _hrScan.y = Number(ents.__scan.y) || _hrScan.y;
    if (ents.__scan.w != null) _hrScan.w = Number(ents.__scan.w) || _hrScan.w;
    if (_hrScan.directorSig && !_hrSigs.director) _hrSigs.director = _hrScan.directorSig;
  }
  if (hrStageOf_(row) === 'rejected') {
    _hrSigs.director = '';
    if (_hrScan) _hrScan.directorSig = '';
  }
  hrApplyAccountDirectorSig_(row);
  hrRenderEntitlements_(ents);
  hrRenderAllSigs_();
  hrRenderScan_();
  hrSyncScanFields_();
  hrSet_('hr-hrComment', row.hrComment || '');
  hrSet_('hr-hrSignature', row.hrSignature || '');
  hrSet_('hr-hrSignedAt', row.hrSignedAt || '');
  hrSet_('hr-status', row.status || 'submitted');
  hrSet_('hrFormNo', row.num ? String(row.num) : '');
  hrSyncAllPaperDates_();
  var title = document.getElementById('hrFormTitle');
  if (title) title.textContent = row.id ? 'Leave Request (editing saved)' : 'Leave Request';
  var delBtn = document.getElementById('hrDeleteBtn');
  if (delBtn) delBtn.style.display = row.id && hrCanWrite_() ? '' : 'none';
  var saveBtn = document.getElementById('hrSaveBtn');
  var saveBtn2 = document.getElementById('hrSaveBtn2');
  if (saveBtn) saveBtn.style.display = hrCanWrite_() ? '' : 'none';
  if (saveBtn2) saveBtn2.style.display = hrCanWrite_() ? '' : 'none';
  hrMsg_('', true);
  hrAutosizeDaysOut_();
  hrApplyPaperLock_();
}

function hrClearForm_() {
  _hrSigs = hrEmptySigs_();
  _hrScan = hrEmptyScan_();
  hrFillForm_({
    status: 'submitted',
    empSignedAt: hrToday_(),
    entitlements: hrEmptyEntitlements_()
  });
}

function hrOpenRow_(id) {
  hrEditInList_(id);
}

function hrSetListEditing_(on) {
  _hrListEditing = !!on;
  var browse = document.getElementById('hrListBrowse');
  var editor = document.getElementById('hrListEditor');
  var app = document.getElementById('hrApp');
  var home = document.getElementById('form');
  if (on) {
    if (browse) browse.hidden = true;
    if (editor) editor.hidden = false;
    if (app && editor && app.parentNode !== editor) editor.appendChild(app);
    document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
    var stayBtn = document.getElementById(hrTabBtnId_(_hrReturnTab));
    if (stayBtn) stayBtn.classList.add('active');
  } else {
    if (browse) browse.hidden = false;
    if (editor) editor.hidden = true;
    if (app && home && app.parentNode !== home) home.appendChild(app);
  }
  document.querySelectorAll('[data-hr-form-only]').forEach(function (el) {
    el.style.display = on ? 'none' : '';
  });
  var ret = document.getElementById('hrReturnBtn');
  var ret2 = document.getElementById('hrReturnBtn2');
  if (ret) {
    ret.style.display = on ? '' : 'none';
    if (on) ret.textContent = hrReturnBtnLabel_();
  }
  if (ret2) {
    ret2.style.display = on ? '' : 'none';
    if (on) ret2.textContent = hrReturnBtnLabel_();
  }
  var title = document.getElementById('hrFormTitle');
  if (title && on) {
    if (hrDirectorCanSign_()) title.textContent = 'Sign leave request';
    else if (hrPaperLocked_()) title.textContent = 'View leave request';
    else title.textContent = hrCanWrite_() ? 'Edit leave request' : 'View leave request';
  }
  hrApplyPaperLock_();
  if (on) setTimeout(hrAutosizeDaysOut_, 0);
}

function hrEditInList_(id, fromTab) {
  var row = _hrRows.find(function (r) { return String(r.id) === String(id); });
  if (!row) return;
  if (fromTab) _hrReturnTab = fromTab;
  else if (hrStageOf_(row) === 'completed') _hrReturnTab = 'confirmed';
  else if (hrStageOf_(row) === 'rejected') _hrReturnTab = 'done';
  else _hrReturnTab = 'list';
  hrFillForm_(row);
  hrSetListEditing_(true);
}

function hrReturnToList_() {
  var tab = _hrReturnTab === 'done' || _hrReturnTab === 'confirmed' ? _hrReturnTab : 'list';
  hrSetListEditing_(false);
  hrSwitchTab_(null, tab);
}

function hrReturnBtnLabel_() {
  if (_hrReturnTab === 'done') return 'Return to completed request';
  if (_hrReturnTab === 'confirmed') return 'Return to director confirmed';
  return 'Return to saved requests';
}

function hrTabBtnId_(tab) {
  if (tab === 'form') return 'tabBtnForm';
  if (tab === 'scan') return 'tabBtnScan';
  if (tab === 'done') return 'tabBtnDone';
  if (tab === 'confirmed') return 'tabBtnConfirmed';
  return 'tabBtnList';
}

function hrPrintRow_(id) {
  var row = _hrRows.find(function (r) { return String(r.id) === String(id); });
  if (!row) return;
  if (!(_hrListEditing && hrVal_('hr-id') === String(id))) hrFillForm_(row);
  setTimeout(hrPrint_, 80);
}

function hrDeleteRow_(id) {
  id = String(id || hrVal_('hr-id') || '').trim();
  if (!id || !hrCanWrite_()) return;
  var row = _hrRows.find(function (r) { return String(r.id) === id; });
  var label = row && row.empName ? row.empName : 'this leave request';
  var go = function () {
    hrDeleteRequest_(id)
      .then(function () {
        hrSetListEditing_(false);
        hrSwitchTab_(null, 'list');
        return hrLoad_(true);
      })
      .catch(function (err) {
        hrMsg_(err.message || 'Delete failed.', false);
      });
  };
  var msg = 'Delete the leave request for ' + label + '? It will move to the Recycle Bin.';
  if (typeof uiConfirm === 'function') {
    uiConfirm(msg).then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm(msg)) go();
}

function hrOpenLeaveNav_() {
  var sub = document.getElementById('hrLeaveSub');
  var parent = document.getElementById('tabBtnForm');
  if (sub) sub.hidden = false;
  if (parent) parent.classList.add('hr-nav-open');
}

function hrClickLeaveNav_(ev) {
  hrOpenLeaveNav_();
  hrCloseSettings_();
  if (hrIsDirectorOnly_()) {
    hrSwitchTab_(null, 'list');
    return;
  }
  hrSwitchTab_(ev, 'form');
}

function hrCloseSettings_() {
  var wrap = document.getElementById('hrSettingsWrap');
  var btn = document.getElementById('hrSettingsBtn');
  var panel = document.getElementById('hrSettingsPanel');
  if (wrap) wrap.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (panel) panel.hidden = true;
}

function hrToggleSettings_(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  var wrap = document.getElementById('hrSettingsWrap');
  var btn = document.getElementById('hrSettingsBtn');
  var panel = document.getElementById('hrSettingsPanel');
  if (!wrap || !panel) return;
  var open = !wrap.classList.contains('open');
  wrap.classList.toggle('open', open);
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.hidden = !open;
}

function hrSwitchTab_(ev, tab) {
  hrCloseSettings_();
  if (_hrListEditing && (tab === 'list' || tab === 'done' || tab === 'confirmed') && ev && ev.currentTarget) hrSetListEditing_(false);
  else if (tab !== 'list' && tab !== 'done' && tab !== 'confirmed' && _hrListEditing) hrSetListEditing_(false);
  document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
  var pane = document.getElementById(tab);
  if (pane) pane.classList.add('active');
  if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
  else {
    var btn = document.getElementById(hrTabBtnId_(tab));
    if (btn) btn.classList.add('active');
  }
  if (tab === 'form' || tab === 'scan' || tab === 'list' || tab === 'done' || tab === 'confirmed') {
    hrOpenLeaveNav_();
  }
  if (tab === 'form' && !hrVal_('hr-id') && !hrVal_('hr-empSignedAt')) {
    hrSet_('hr-empSignedAt', hrToday_());
  }
  if (tab === 'form') setTimeout(hrAutosizeDaysOut_, 0);
  if (tab === 'scan') {
    hrSyncScanFields_();
    hrRenderScan_();
  }
  if (tab === 'list' && !_hrListEditing) hrRenderTable_();
  if (tab === 'done' && !_hrListEditing) hrRenderDoneTable_();
  if (tab === 'confirmed' && !_hrListEditing) hrRenderConfirmedTable_();
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
  var type = hrVal_('hrFilterType');
  var dept = hrVal_('hrFilterDept');
  var month = hrVal_('hrFilterMonth');
  var q = hrVal_('hrFilterSearch').toLowerCase();
  return _hrRows.filter(function (r) {
    if (status && String(r.status || '') !== status) return false;
    if (type && String(r.leaveType || '') !== type) return false;
    if (dept && String(r.empDepartment || '') !== dept) return false;
    if (month && String(r.startDate || '').slice(0, 7) !== month) return false;
    if (hrStageOf_(r) === 'completed' || hrStageOf_(r) === 'rejected') return false;
    if (q) {
      var hay = [r.no, r.empName, r.empCode, r.empDepartment, r.empJobTitle, r.leaveType, r.replacement, r.daysOut]
        .join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function hrTypeLabel_(id) {
  var found = HR_LEAVE_TYPES.find(function (t) { return t.id === id; });
  return found ? found.label : (id || 'Other');
}

function hrGroupedByStage_(list) {
  var groups = {};
  HR_STAGES.forEach(function (st) { groups[st.id] = []; });
  list.forEach(function (r) {
    var k = hrStageOf_(r);
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });
  var stages = hrIsDirectorOnly_()
    ? HR_STAGES.filter(function (st) { return st.id === 'pending_director'; })
    : HR_STAGES.filter(function (st) { return st.id === 'inbox' || st.id === 'pending_director'; });
  return stages.map(function (st) {
    return { type: st.id, label: st.label, rows: groups[st.id] || [] };
  });
}

function hrApplyPaperLock_() {
  var root = document.getElementById('hrPrintRoot');
  var locked = hrPaperLocked_();
  var directorSign = hrDirectorCanSign_();
  var freeze = locked && !directorSign;
  if (root) {
    root.classList.toggle('hr-paper-locked', freeze);
    root.classList.toggle('hr-paper-director-sign', directorSign);
    root.querySelectorAll('input, select, textarea').forEach(function (el) {
      var id = el.id || '';
      var blank = !!(el.closest && el.closest('.hr-f06-blank')) || !!el.getAttribute('data-ent') ||
        id === 'hr-hrComment' || id === 'hr-hrSignature' || id === 'hr-hrSignedAt' || id === 'hr-hrSignedAt-view';
      var directorField = id === 'hr-directorName' || id === 'hr-directorSignedAt' || id === 'hr-directorSignedAt-view';
      var block = blank || freeze || (directorSign && !directorField);
      if (el.tagName === 'SELECT') el.disabled = block;
      else el.readOnly = block;
    });
  }
  var statusEl = document.getElementById('hr-status');
  if (statusEl) statusEl.disabled = locked || directorSign || hrIsDirectorOnly_();
  var saveBtn = document.getElementById('hrSaveBtn');
  var saveBtn2 = document.getElementById('hrSaveBtn2');
  var delBtn = document.getElementById('hrDeleteBtn');
  var confirmBtn = document.getElementById('hrConfirmBtn');
  var confirmBtn2 = document.getElementById('hrConfirmBtn2');
  var rejectBtn = document.getElementById('hrRejectBtn');
  var rejectBtn2 = document.getElementById('hrRejectBtn2');
  var st = hrVal_('hr-status');
  var showSave = hrCanWrite_() && !locked;
  var showDel = showSave && !!hrVal_('hr-id');
  var showConfirm = (!!hrVal_('hr-id')) && (
    (hrIsHrStaff_() && hrStageOf_({ status: st }) === 'inbox') ||
    (hrIsDirectorOnly_() && st === 'pending_director')
  );
  var showReject = (!!hrVal_('hr-id')) && hrIsDirectorOnly_() && st === 'pending_director';
  if (saveBtn) saveBtn.style.display = showSave ? '' : 'none';
  if (saveBtn2) saveBtn2.style.display = showSave ? '' : 'none';
  if (delBtn) delBtn.style.display = showDel ? '' : 'none';
  if (confirmBtn) confirmBtn.style.display = showConfirm ? '' : 'none';
  if (confirmBtn2) confirmBtn2.style.display = showConfirm ? '' : 'none';
  if (rejectBtn) rejectBtn.style.display = showReject ? '' : 'none';
  if (rejectBtn2) rejectBtn2.style.display = showReject ? '' : 'none';
}

function hrConfirmRow_(id) {
  id = String(id || hrVal_('hr-id') || '').trim();
  if (!id) return;
  var row = _hrRows.find(function (r) { return String(r.id) === id; });
  var stage = hrStageOf_(row || { status: hrVal_('hr-status') });
  if (hrIsDirectorOnly_()) {
    hrDirectorConfirmRequest_(id)
      .then(function () {
        hrMsg_('Sent back to HR as Completed.', true);
        hrSetListEditing_(false);
        return hrLoad_(true).then(function () {
          hrSwitchTab_(null, 'confirmed');
        });
      })
      .catch(function (err) {
        if (String(err && err.message || '').indexOf('e-signature') !== -1 && hrVal_('hr-id') !== id) hrEditInList_(id);
        hrMsg_(err.message || 'Confirm failed.', false);
      });
    return;
  }
  if (!(hrIsHrStaff_() && stage === 'inbox')) return;
  var extra = { action: 'confirmHrLeaveRequest', token: hrToken_(), id: id };
  hrMsg_('Confirming…', true);
  fetchJSONRetry(extra, 1, 30000)
    .then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Confirm failed');
      hrMsg_('Sent to Pending Director.', true);
      hrSetListEditing_(false);
      hrSwitchTab_(null, 'list');
      return hrLoad_(true);
    })
    .catch(function (err) {
      hrMsg_(err.message || 'Confirm failed.', false);
    });
}

function hrRejectRow_(id) {
  id = String(id || hrVal_('hr-id') || '').trim();
  if (!id || !hrIsDirectorOnly_()) return;
  var row = _hrRows.find(function (r) { return String(r.id) === id; });
  if (hrStageOf_(row || { status: hrVal_('hr-status') }) !== 'pending_director') return;
  var label = row && row.empName ? row.empName : 'this leave request';
  var go = function () {
    hrMsg_('Rejecting…', true);
    hrDirectorRejectRequest_(id)
      .then(function () {
        if (hrVal_('hr-id') === id) {
          _hrSigs.director = '';
          hrSet_('hr-directorName', '');
          hrSet_('hr-directorSignedAt', '');
          hrSet_('hr-directorStatus', 'rejected');
          hrRenderSig_('director');
        }
        hrMsg_('Sent back to HR as Rejected, without an e-signature.', true);
        hrSetListEditing_(false);
        hrSwitchTab_(null, 'list');
        return hrLoad_(true);
      })
      .catch(function (err) {
        hrMsg_(err.message || 'Reject failed.', false);
      });
  };
  var msg = 'Reject the leave request for ' + label + '? It goes to HR as Rejected, with no director e-signature.';
  if (typeof uiConfirm === 'function') {
    uiConfirm(msg).then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm(msg)) go();
}

function hrNewPaper_(typeId) {
  hrSetListEditing_(false);
  hrClearForm_();
  hrRenderLeaveTypes_(typeId || 'Lateness');
  hrSwitchTab_(null, 'form');
}

function hrSnapshotPaperTemplate_() {
  var src = document.getElementById('hrPrintRoot');
  if (!src) return;
  if (!_hrPaperTemplate) hrRenderEntitlements_(hrEmptyEntitlements_());
  src = document.getElementById('hrPrintRoot');
  if (!src) return;
  _hrPaperTemplate = src.cloneNode(true);
}

function hrMakePaperClone_(prefix, typeId) {
  if (!_hrPaperTemplate) hrSnapshotPaperTemplate_();
  if (!_hrPaperTemplate) return null;
  var clone = _hrPaperTemplate.cloneNode(true);
  clone.id = prefix;
  clone.classList.add('hr-paper-pdf');
  clone.querySelectorAll('[id]').forEach(function (el) {
    el.setAttribute('data-hr-id', el.id);
    el.id = prefix + '-' + el.id;
  });
  ['onclick', 'onchange', 'oninput', 'onpaste'].forEach(function (a) {
    clone.querySelectorAll('[' + a + ']').forEach(function (el) { el.removeAttribute(a); });
  });
  clone.querySelectorAll('input, select, textarea, button').forEach(function (el) {
    el.tabIndex = -1;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.readOnly = true;
  });
  var typeSel = clone.querySelector('[data-hr-id="hr-leaveType"]');
  if (typeSel && typeId) {
    typeSel.value = typeId;
    if (typeSel.value !== typeId) {
      var opt = document.createElement('option');
      opt.value = typeId;
      opt.textContent = hrTypeLabel_(typeId);
      typeSel.appendChild(opt);
      typeSel.value = typeId;
    }
  }
  return clone;
}

function hrCloneSet_(root, id, v) {
  var el = root.querySelector('[data-hr-id="' + id + '"]');
  var val = v == null ? '' : String(v);
  if (el) el.value = val;
  var view = root.querySelector('[data-hr-id="' + id + '-view"]');
  if (view) {
    view.value = (id === 'hr-startDate' || id === 'hr-endDate')
      ? (hrFmtAbsenceDate_(val) || val)
      : (hrFmtPaperDate_(val) || val);
  }
}

function hrFillPaperClone_(root, row) {
  if (!root || !row) return;
  hrCloneSet_(root, 'hr-empName', row.empName);
  hrCloneSet_(root, 'hr-empDepartment', row.empDepartment);
  hrCloneSet_(root, 'hr-empCode', row.empCode);
  hrCloneSet_(root, 'hr-empDivision', row.empDivision);
  hrCloneSet_(root, 'hr-empJobTitle', row.empJobTitle);
  hrCloneSet_(root, 'hr-replacement', row.replacement);
  hrCloneSet_(root, 'hr-startDate', row.startDate);
  hrCloneSet_(root, 'hr-endDate', row.endDate);
  hrCloneSet_(root, 'hr-daysOut', row.daysOut);
  hrCloneSet_(root, 'hr-leaveType', row.leaveType);
  hrCloneSet_(root, 'hr-leaveOther', row.leaveOther);
  hrCloneSet_(root, 'hr-empSignature', row.empSignature);
  hrCloneSet_(root, 'hr-empSignedAt', row.empSignedAt);
  hrCloneSet_(root, 'hr-lineManagerName', row.lineManagerName);
  hrCloneSet_(root, 'hr-lineManagerSignedAt', row.lineManagerSignedAt);
  hrCloneSet_(root, 'hr-directorName', row.directorName);
  hrCloneSet_(root, 'hr-directorSignedAt', row.directorSignedAt);
  hrCloneSet_(root, 'hr-hrComment', row.hrComment);
  hrCloneSet_(root, 'hr-hrSignature', row.hrSignature);
  hrCloneSet_(root, 'hr-hrSignedAt', row.hrSignedAt);
  var other = root.querySelector('[data-hr-id="hr-leaveOther"]');
  if (other) other.style.display = String(row.leaveType || '') === 'Other' ? '' : 'none';
  var ents = row.entitlements || {};
  var sigs = Object.assign({ emp: '', line: '', director: '', hr: '' }, ents.__sigs || {});
  ['emp', 'line', 'director', 'hr'].forEach(function (slot) {
    var pad = root.querySelector('[data-hr-id="hr-sig-' + slot + '"]');
    if (pad) pad.innerHTML = sigs[slot] ? '<img src="' + sigs[slot] + '" alt="">' : '';
  });
  HR_ENTITLE_KEYS.forEach(function (r) {
    var d = ents[r.key] || {};
    root.querySelectorAll('input[data-ent="' + r.key + '"]').forEach(function (el) {
      var col = el.getAttribute('data-col');
      if (col) el.value = d[col] || '';
    });
  });
  var days = root.querySelector('[data-hr-id="hr-daysOut"]');
  if (days && days.style) {
    days.style.height = 'auto';
    days.style.height = Math.max(22, days.scrollHeight || 22) + 'px';
  }
}

function hrEnsureSavedPapers_() {
  var host = document.getElementById('hrSavedPapers');
  if (!host || _hrPapersReady) return;
  hrSnapshotPaperTemplate_();
  host.innerHTML = '';
  HR_LEAVE_TYPES.forEach(function (t) {
    var sec = document.createElement('section');
    sec.className = 'hr-saved-type';
    sec.setAttribute('data-type', t.id);
    var slug = String(t.id).replace(/\s+/g, '-');
    sec.innerHTML =
      '<div class="hr-saved-type-bar">' +
        '<h3>' + hrEsc_(t.label) + '</h3>' +
        '<button type="button" data-hr-new="' + hrEsc_(t.id) + '">New paper</button>' +
      '</div>' +
      '<div class="hr-saved-filled" id="hr-filled-' + slug + '"></div>';
    var btn = sec.querySelector('[data-hr-new]');
    if (btn) btn.addEventListener('click', function () { hrNewPaper_(t.id); });
    host.appendChild(sec);
  });
  _hrPapersReady = true;
}

function hrRenderSavedFilledPapers_(list) {
  hrEnsureSavedPapers_();
  var write = hrCanWrite_();
  HR_LEAVE_TYPES.forEach(function (t) {
    var slug = String(t.id).replace(/\s+/g, '-');
    var box = document.getElementById('hr-filled-' + slug);
    var sec = box && box.closest('.hr-saved-type');
    if (!box) return;
    box.innerHTML = '';
    var rows = (list || []).filter(function (r) {
      var s = String(r.leaveType || '').trim();
      return s === t.id || s.toLowerCase() === t.id.toLowerCase() || s.toLowerCase() === t.label.toLowerCase();
    });
    if (sec) sec.style.display = '';
    rows.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'hr-saved-filled-card';
      var st = String(r.status || 'submitted');
      card.innerHTML =
        '<div class="hr-saved-type-bar">' +
          '<h3>' + hrEsc_(r.empName || t.label) +
            (r.no || r.num ? ' (#' + hrEsc_(r.no || r.num) + ')' : '') + '</h3>' +
          '<span class="hr-badge hr-badge-' + hrEsc_(st) + '">' + hrEsc_(HR_STATUS_LABEL[st] || st) + '</span>' +
          '<button type="button" data-hr-edit="' + hrEsc_(r.id) + '">' + (write ? 'Edit' : 'View') + '</button>' +
          (write ? '<button type="button" class="hr-btn-del" data-hr-del="' + hrEsc_(r.id) + '">Delete</button>' : '') +
          '<button type="button" data-hr-print="' + hrEsc_(r.id) + '">Print / PDF</button>' +
        '</div>';
      var clone = hrMakePaperClone_('hr-saved-' + String(r.id).replace(/[^a-zA-Z0-9_-]/g, ''), r.leaveType);
      if (clone) {
        hrFillPaperClone_(clone, r);
        card.appendChild(clone);
      }
      var editBtn = card.querySelector('[data-hr-edit]');
      var delBtn = card.querySelector('[data-hr-del]');
      var printBtn = card.querySelector('[data-hr-print]');
      if (editBtn) editBtn.addEventListener('click', function (ev) { ev.stopPropagation(); hrEditInList_(r.id); });
      if (delBtn) delBtn.addEventListener('click', function (ev) { ev.stopPropagation(); hrDeleteRow_(r.id); });
      if (printBtn) printBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        hrPrintRow_(r.id);
      });
      card.addEventListener('click', function (ev) {
        if (ev.target.closest('button')) return;
        hrEditInList_(r.id);
      });
      box.appendChild(card);
    });
  });
}

function hrRenderKpis_(list) {
  var host = document.getElementById('hrKpiRow');
  if (!host) return;
  var all = _hrRows || [];
  var pendingDir = all.filter(function (r) { return hrStageOf_(r) === 'pending_director'; }).length;
  var completed = all.filter(function (r) { return hrStageOf_(r) === 'completed'; }).length;
  var inbox = all.filter(function (r) { return hrStageOf_(r) === 'inbox'; }).length;
  host.innerHTML =
    (hrIsDirectorOnly_()
      ? ''
      : '<div class="hr-kpi"><b>' + inbox + '</b><span>Leave requests</span></div>') +
    '<div class="hr-kpi"><b>' + pendingDir + '</b><span>Pending Director</span></div>' +
    '<div class="hr-kpi" role="button" tabindex="0" onclick="hrSwitchTab_(null,\'confirmed\')" style="cursor:pointer;"><b>' + completed + '</b><span>Director confirmed</span></div>';
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
  var staff = hrIsHrStaff_();
  var director = hrIsDirectorOnly_();
  var groups = hrGroupedByStage_(list);
  var h = '';
  groups.forEach(function (g) {
    var emptyHint = g.type === 'pending_director'
      ? 'Confirmed papers wait here for the director e-signature.'
      : 'No leave requests in this section.';
    h += '<section class="hr-stage hr-stage-' + hrEsc_(g.type) + '">';
    h += '<div class="hr-stage-head">';
    h += '<h3 class="hr-stage-title">' + hrEsc_(g.label) + ' <span>(' + g.rows.length + ')</span></h3>';
    var groupSelN = 0;
    if (hrCanSelectGroup_(g)) {
      var selN = hrSelectedIds_().length;
      groupSelN = g.rows.filter(function (r) { return !!_hrSelected[String(r.id)]; }).length;
      h += '<div class="hr-stage-acts">';
      if (_hrSelectMode) {
        h += '<span class="hr-select-count" id="hrSelectCount">' + (selN ? selN + ' selected' : 'Select papers') + '</span>';
        if (director) {
          h += '<button type="button" class="hr-btn-confirm" onclick="hrRunSelectedPending_(\'confirm\')">Confirm</button>';
          h += '<button type="button" class="hr-btn-reject" onclick="hrRunSelectedPending_(\'reject\')">Rejected</button>';
        } else {
          h += '<button type="button" class="hr-btn-confirm" onclick="hrRunSelectedInbox_(\'confirm\')">Confirm</button>';
          h += '<button type="button" class="hr-btn-del" onclick="hrRunSelectedInbox_(\'delete\')">Delete</button>';
        }
        h += '<button type="button" onclick="hrToggleSelectMode_(false)">Cancel</button>';
      } else {
        h += '<button type="button" onclick="hrToggleSelectMode_(true)">Select</button>';
      }
      h += '</div>';
    }
    h += '</div>';
    if (!g.rows.length) {
      h += '<p class="hr-stage-empty">' + emptyHint + '</p>';
      h += '</section>';
      return;
    }
    var showSel = hrCanSelectGroup_(g) && _hrSelectMode;
    h += '<div class="hr-table-wrap"><table class="hr-list-table"><thead><tr>' +
      (showSel ? '<th class="hr-sel-col"><input type="checkbox" id="hrSelAll" onclick="hrSelectAllVisible_(event)"' + (g.rows.length && groupSelN === g.rows.length ? ' checked' : '') + '></th>' : '') +
      '<th>#</th><th>Employee</th><th>Department</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>';
    g.rows.forEach(function (r) {
      var st = String(r.status || 'submitted');
      var stage = hrStageOf_(r);
      var canEdit = staff && stage === 'inbox';
      var canConfirm = (staff && stage === 'inbox') || (director && stage === 'pending_director');
      var picked = !!_hrSelected[String(r.id)];
      h += '<tr' + (showSel && picked ? ' class="hr-row-selected"' : '') + '>' +
        (showSel
          ? '<td class="hr-sel-col"><input type="checkbox" id="hrSel-' + hrEsc_(r.id) + '" data-hr-sel="1" onclick="hrToggleRowSelect_(\'' + hrEsc_(r.id) + '\',event)"' + (picked ? ' checked' : '') + '></td>'
          : '') +
        '<td>' + hrEsc_(r.no || r.num || '') + '</td>' +
        '<td><strong>' + hrEsc_(r.empName || '—') + '</strong><div style="color:var(--text-soft);font-size:12px;">' + hrEsc_(r.empCode || '') + '</div></td>' +
        '<td>' + hrEsc_(r.empDepartment || '—') + '</td>' +
        '<td>' + hrEsc_(r.leaveType || '—') + '</td>' +
        '<td>' + hrEsc_(hrFmtDate_(r.startDate)) + (r.endDate && r.endDate !== r.startDate ? ' – ' + hrEsc_(hrFmtDate_(r.endDate)) : '') +
          (r.entitlements && r.entitlements.__scan && r.entitlements.__scan.url ? ' <span class="hr-badge">Scan</span>' : '') + '</td>' +
        '<td>' + hrEsc_(r.daysOut || '—') + '</td>' +
        '<td><span class="hr-badge hr-badge-' + hrEsc_(st) + '">' + hrEsc_(HR_STATUS_LABEL[st] || st) + '</span></td>' +
        '<td><div class="hr-row-acts">' +
          '<button type="button" class="hr-btn-edit" onclick="hrEditInList_(\'' + hrEsc_(r.id) + '\')">' + (canEdit ? 'Edit' : 'View') + '</button>' +
          (!showSel && canConfirm ? '<button type="button" class="hr-btn-confirm" onclick="hrConfirmRow_(\'' + hrEsc_(r.id) + '\')">Confirm</button>' : '') +
          (!showSel && director && stage === 'pending_director' ? '<button type="button" class="hr-btn-reject" onclick="hrRejectRow_(\'' + hrEsc_(r.id) + '\')">Rejected</button>' : '') +
          (!showSel && canEdit ? '<button type="button" class="hr-btn-del" onclick="hrDeleteRow_(\'' + hrEsc_(r.id) + '\')">Delete</button>' : '') +
          (r.entitlements && r.entitlements.__scan && r.entitlements.__scan.url
            ? '<button type="button" onclick="hrOpenScanRow_(\'' + hrEsc_(r.id) + '\')">Open scan</button>'
            : '') +
          '<button type="button" onclick="hrPrintRow_(\'' + hrEsc_(r.id) + '\')">Print</button>' +
        '</div></td></tr>';
    });
    h += '</tbody></table></div></section>';
  });
  host.innerHTML = h;
}

function hrRenderDoneTable_() {
  var host = document.getElementById('hrDoneHost');
  var summary = document.getElementById('hrDoneSummary');
  if (!host) return;
  var completed = hrCompletedRows_();
  var rejected = (_hrRows || []).filter(function (r) { return hrStageOf_(r) === 'rejected'; });
  var rows = completed.concat(rejected);
  if (summary) {
    summary.textContent = completed.length + ' completed, ' + rejected.length + ' rejected';
  }
  function rowHtml(r, showSel) {
    var rejectedRow = hrStageOf_(r) === 'rejected';
    var picked = !!_hrDoneSelected[String(r.id)];
    return '<tr' + (showSel && picked ? ' class="hr-row-selected"' : '') + '>' +
      (showSel
        ? '<td class="hr-sel-col"><input type="checkbox" id="hrDoneSel-' + hrEsc_(r.id) + '" data-hr-done-sel="1" onclick="hrToggleDoneRowSelect_(\'' + hrEsc_(r.id) + '\',event)"' + (picked ? ' checked' : '') + '></td>'
        : '') +
      '<td>' + hrEsc_(r.no || r.num || '') + '</td>' +
      '<td><strong>' + hrEsc_(r.empName || '—') + '</strong><div style="color:var(--text-soft);font-size:12px;">' + hrEsc_(r.empCode || '') + '</div></td>' +
      '<td>' + hrEsc_(r.empDepartment || '—') + '</td>' +
      '<td>' + hrEsc_(r.leaveType || '—') + '</td>' +
      '<td>' + hrEsc_(hrFmtDate_(r.startDate)) + (r.endDate && r.endDate !== r.startDate ? ' – ' + hrEsc_(hrFmtDate_(r.endDate)) : '') + '</td>' +
      '<td>' + hrEsc_(r.daysOut || '—') + '</td>' +
      '<td><span class="hr-badge hr-badge-' + (rejectedRow ? 'rejected' : 'completed') + '">' + (rejectedRow ? 'Rejected' : 'Completed') + '</span></td>' +
      '<td><div class="hr-row-acts">' +
        '<button type="button" class="hr-btn-edit" onclick="hrEditInList_(\'' + hrEsc_(r.id) + '\',\'done\')">View</button>' +
        (!showSel ? '<button type="button" onclick="hrPrintRow_(\'' + hrEsc_(r.id) + '\')">Print</button>' : '') +
      '</div></td></tr>';
  }
  function rejectedHtml(list) {
    var h = '<section class="hr-stage hr-stage-rejected">';
    h += '<h3 class="hr-stage-title">Rejected <span>(' + list.length + ')</span></h3>';
    if (!list.length) {
      h += '<p class="hr-stage-empty">Papers the director rejected come here, with no e-signature.</p></section>';
      return h;
    }
    h += '<div class="hr-table-wrap"><table class="hr-list-table"><thead><tr>' +
      '<th>#</th><th>Employee</th><th>Department</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>';
    list.forEach(function (r) { h += rowHtml(r, false); });
    h += '</tbody></table></div></section>';
    return h;
  }
  var showSel = !hrIsDirectorOnly_() && _hrDoneSelectMode && completed.length;
  var selN = hrDoneSelectedIds_().length;
  var groupSelN = completed.filter(function (r) { return !!_hrDoneSelected[String(r.id)]; }).length;
  var h = '<section class="hr-stage hr-stage-completed">';
  h += '<div class="hr-stage-head">';
  h += '<h3 class="hr-stage-title">Completed request <span>(' + completed.length + ')</span></h3>';
  if (completed.length && !hrIsDirectorOnly_()) {
    h += '<div class="hr-stage-acts">';
    if (_hrDoneSelectMode) {
      h += '<span class="hr-select-count" id="hrDoneSelectCount">' + (selN ? selN + ' selected' : 'Select papers') + '</span>';
      h += '<button type="button" class="hr-btn-confirm" onclick="hrPrintSelectedCompleted_()">Print / PDF</button>';
      h += '<button type="button" onclick="hrToggleDoneSelectMode_(false)">Cancel</button>';
    } else {
      h += '<button type="button" onclick="hrToggleDoneSelectMode_(true)">Select</button>';
    }
    h += '</div>';
  }
  h += '</div>';
  if (!completed.length) {
    h += '<p class="hr-stage-empty">Papers the director has signed come here.</p></section>';
  } else {
    h += '<div class="hr-table-wrap"><table class="hr-list-table"><thead><tr>' +
      (showSel ? '<th class="hr-sel-col"><input type="checkbox" id="hrDoneSelAll" onclick="hrSelectAllDone_(event)"' + (completed.length && groupSelN === completed.length ? ' checked' : '') + '></th>' : '') +
      '<th>#</th><th>Employee</th><th>Department</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>';
    completed.forEach(function (r) { h += rowHtml(r, showSel); });
    h += '</tbody></table></div></section>';
  }
  if (!rows.length) {
    host.innerHTML = h + rejectedHtml([]);
    return;
  }
  host.innerHTML = h + rejectedHtml(rejected);
}

function hrRenderConfirmedTable_() {
  var host = document.getElementById('hrConfirmedHost');
  var summary = document.getElementById('hrConfirmedSummary');
  if (!host) return;
  var completed = hrCompletedRows_();
  if (summary) {
    summary.textContent = completed.length + ' confirmed paper' + (completed.length === 1 ? '' : 's');
  }
  var showSel = _hrConfirmedSelectMode && completed.length;
  var selN = hrConfirmedSelectedIds_().length;
  var groupSelN = completed.filter(function (r) { return !!_hrConfirmedSelected[String(r.id)]; }).length;
  var h = '<section class="hr-stage hr-stage-completed">';
  h += '<div class="hr-stage-head">';
  h += '<h3 class="hr-stage-title">Director confirmed <span>(' + completed.length + ')</span></h3>';
  if (completed.length) {
    h += '<div class="hr-stage-acts">';
    if (_hrConfirmedSelectMode) {
      h += '<span class="hr-select-count" id="hrConfirmedSelectCount">' + (selN ? selN + ' selected' : 'Select papers') + '</span>';
      h += '<button type="button" class="hr-btn-confirm" onclick="hrPrintSelectedConfirmed_()">Print / PDF</button>';
      h += '<button type="button" onclick="hrToggleConfirmedSelectMode_(false)">Cancel</button>';
    } else {
      h += '<button type="button" onclick="hrToggleConfirmedSelectMode_(true)">Select</button>';
    }
    h += '</div>';
  }
  h += '</div>';
  if (!completed.length) {
    h += '<p class="hr-stage-empty">Papers the director confirms appear here.</p></section>';
    host.innerHTML = h;
    return;
  }
  h += '<div class="hr-table-wrap"><table class="hr-list-table"><thead><tr>' +
    (showSel ? '<th class="hr-sel-col"><input type="checkbox" id="hrConfirmedSelAll" onclick="hrSelectAllConfirmed_(event)"' + (completed.length && groupSelN === completed.length ? ' checked' : '') + '></th>' : '') +
    '<th>#</th><th>Employee</th><th>Department</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th>' +
    '</tr></thead><tbody>';
  completed.forEach(function (r) {
    var picked = !!_hrConfirmedSelected[String(r.id)];
    h += '<tr' + (showSel && picked ? ' class="hr-row-selected"' : '') + '>' +
      (showSel
        ? '<td class="hr-sel-col"><input type="checkbox" id="hrConfirmedSel-' + hrEsc_(r.id) + '" data-hr-confirmed-sel="1" onclick="hrToggleConfirmedRowSelect_(\'' + hrEsc_(r.id) + '\',event)"' + (picked ? ' checked' : '') + '></td>'
        : '') +
      '<td>' + hrEsc_(r.no || r.num || '') + '</td>' +
      '<td><strong>' + hrEsc_(r.empName || '—') + '</strong><div style="color:var(--text-soft);font-size:12px;">' + hrEsc_(r.empCode || '') + '</div></td>' +
      '<td>' + hrEsc_(r.empDepartment || '—') + '</td>' +
      '<td>' + hrEsc_(r.leaveType || '—') + '</td>' +
      '<td>' + hrEsc_(hrFmtDate_(r.startDate)) + (r.endDate && r.endDate !== r.startDate ? ' – ' + hrEsc_(hrFmtDate_(r.endDate)) : '') + '</td>' +
      '<td>' + hrEsc_(r.daysOut || '—') + '</td>' +
      '<td><span class="hr-badge hr-badge-completed">Confirmed</span></td>' +
      '<td><div class="hr-row-acts">' +
        '<button type="button" class="hr-btn-edit" onclick="hrEditInList_(\'' + hrEsc_(r.id) + '\',\'confirmed\')">View</button>' +
        (!showSel ? '<button type="button" onclick="hrPrintRow_(\'' + hrEsc_(r.id) + '\')">Print</button>' : '') +
      '</div></td></tr>';
  });
  h += '</tbody></table></div></section>';
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
      hrRenderDoneTable_();
      hrRenderConfirmedTable_();
    })
    .catch(function (err) {
      var errHtml = typeof empireErrorHtml === 'function'
        ? empireErrorHtml(err.message || 'Could not load leave requests.', 'Try Refresh.')
        : '<p>' + hrEsc_(err.message || 'Load failed') + '</p>';
      if (host) host.innerHTML = errHtml;
      var doneHost = document.getElementById('hrDoneHost');
      if (doneHost) doneHost.innerHTML = errHtml;
      var confirmedHost = document.getElementById('hrConfirmedHost');
      if (confirmedHost) confirmedHost.innerHTML = errHtml;
    });
}

function hrEmptyScan_() {
  return { url: '', directorSig: '', x: 0.56, y: 0.36, w: 0.2 };
}

function hrSyncScanFields_() {
  var nameEl = document.getElementById('hr-scanEmpName');
  var dateEl = document.getElementById('hr-scanStartDate');
  if (nameEl) nameEl.value = hrVal_('hr-empName');
  if (dateEl) dateEl.value = hrVal_('hr-startDate');
}

function hrScanStatusText_() {
  if (!_hrScan.url) return 'No scan yet';
  return _hrScan.directorSig ? 'Scan attached — director signed' : 'Scan attached — add director e-signature';
}

function hrRenderScan_() {
  var wrap = document.getElementById('hrScanStageWrap');
  var img = document.getElementById('hrScanImg');
  var sig = document.getElementById('hrScanDirSig');
  var hint = document.getElementById('hrScanHint');
  var status = document.getElementById('hrScanFormStatus');
  var target = document.getElementById('hrScanTarget');
  if (status) status.textContent = hrScanStatusText_();
  if (!wrap || !img) return;
  if (!_hrScan.url) {
    wrap.style.display = 'none';
    img.removeAttribute('src');
    if (sig) { sig.hidden = true; sig.removeAttribute('src'); }
    if (hint) hint.textContent = 'No paper yet. Scan or upload the leave form, then put the director e-signature on the Director box.';
    return;
  }
  wrap.style.display = '';
  img.src = _hrScan.url;
  if (target) {
    target.style.left = (_hrScan.x * 100) + '%';
    target.style.top = (_hrScan.y * 100) + '%';
    target.style.width = Math.max(_hrScan.w * 100, 18) + '%';
  }
  if (sig) {
    if (_hrScan.directorSig) {
      sig.src = _hrScan.directorSig;
      sig.hidden = false;
      sig.style.left = (_hrScan.x * 100) + '%';
      sig.style.top = (_hrScan.y * 100) + '%';
      sig.style.width = (_hrScan.w * 100) + '%';
    } else {
      sig.hidden = true;
      sig.removeAttribute('src');
    }
  }
  if (hint) {
    hint.textContent = _hrScan.directorSig
      ? 'Drag the director e-signature onto the Director box, then Save.'
      : 'Scan loaded. Add the director e-signature only.';
  }
}

function hrApplyDirectorOnly_(dataUrl, openPickerDone) {
  var url = String(dataUrl || '').trim();
  if (!url) return;
  _hrSigs.director = url;
  _hrScan.directorSig = url;
  hrSet_('hr-directorSignedAt', hrToday_());
  hrSet_('hr-directorStatus', 'approved');
  hrRenderSig_('director');
  hrRenderScan_();
  if (openPickerDone) hrMsg_('Director e-signature placed. Drag it onto the Director box if needed.', true);
}

function hrOpenScanDirectorSig_() {
  if (!hrCanWrite_()) return;
  if (!_hrScan.url) { hrMsg_('Scan or upload the paper first.', false); return; }
  var inp = document.getElementById('hr-scan-dir-sig');
  if (inp) inp.click();
}

function hrOnScanDirectorSig_(e) {
  var file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!hrCanWrite_()) return;
  var reader = new FileReader();
  reader.onload = function () {
    hrProcessSigImage_(String(reader.result || ''), function (url) {
      hrApplyDirectorOnly_(url, true);
    });
  };
  reader.readAsDataURL(file);
}

function hrCompressScan_(file) {
  return new Promise(function (resolve, reject) {
    var kind = String(file && file.type || '');
    if (kind === 'application/pdf') {
      reject(new Error('Please photograph or upload a JPG/PNG of the paper.'));
      return;
    }
    if (!file || kind.indexOf('image/') !== 0) {
      reject(new Error('Please photograph or upload a picture of the paper.'));
      return;
    }
    var r = new FileReader();
    r.onerror = function () { reject(new Error('Could not read the scan.')); };
    r.onload = function (ev) {
      var img = new Image();
      img.onerror = function () { reject(new Error('Could not read that image.')); };
      img.onload = function () {
        var max = 1600;
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var dataUrl = c.toDataURL('image/jpeg', 0.72);
        c.toBlob(function (b) {
          resolve({ blob: b, dataUrl: dataUrl });
        }, 'image/jpeg', 0.72);
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  });
}

function hrOnScanFile_(e) {
  var file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file || !hrCanWrite_()) return;
  hrMsg_('Loading scan…', true);
  hrCompressScan_(file).then(function (out) {
    _hrScan.url = out.dataUrl;
    if (!_hrScan.directorSig) {
      _hrScan.x = 0.56;
      _hrScan.y = 0.36;
      _hrScan.w = 0.2;
    }
    hrRenderScan_();
    var finish = function (url) {
      if (url) _hrScan.url = url;
      hrRenderScan_();
      hrMsg_('Scan loaded. Add the director e-signature only.', true);
      setTimeout(hrOpenScanDirectorSig_, 250);
    };
    if (out.blob && typeof empireUploadPhotoAsync === 'function') {
      return empireUploadPhotoAsync(out.blob, 'hr-leave-scans').then(function (url) {
        finish(url || out.dataUrl);
      });
    }
    finish(out.dataUrl);
  }).catch(function (err) {
    hrMsg_(err.message || 'Could not load the scan.', false);
  });
}

function hrClearScan_() {
  if (!hrCanWrite_()) return;
  _hrScan = hrEmptyScan_();
  hrRenderScan_();
  hrMsg_('Scan removed. Director e-signature on the paper was cleared; the digital Director box is unchanged.', true);
}

function hrSaveFromScan_() {
  var scanName = hrVal_('hr-scanEmpName');
  var scanDate = hrVal_('hr-scanStartDate');
  if (scanName) hrSet_('hr-empName', scanName);
  if (scanDate) hrSet_('hr-startDate', scanDate);
  if (!hrVal_('hr-startDate')) hrSet_('hr-startDate', hrToday_());
  if (!hrVal_('hr-endDate')) hrSet_('hr-endDate', hrVal_('hr-startDate'));
  if (!_hrScan.url) { hrMsg_('Scan or upload the paper first.', false); return; }
  hrSave_();
}

function hrOpenScanRow_(id) {
  var row = _hrRows.find(function (r) { return String(r.id) === String(id); });
  if (!row) return;
  hrFillForm_(row);
  hrSetListEditing_(false);
  hrSwitchTab_(null, 'scan');
}

function hrPrintScan_() {
  if (!_hrScan.url) { hrMsg_('Scan or upload the paper first.', false); return; }
  document.body.classList.add('hr-print-scan');
  var wrap = document.getElementById('hrScanStageWrap');
  if (wrap) wrap.style.display = '';
  window.print();
  setTimeout(function () { document.body.classList.remove('hr-print-scan'); }, 400);
}

function hrScanDirPointerDown_(ev) {
  if (!hrCanWrite_() || !_hrScan.directorSig) return;
  ev.preventDefault();
  var stage = document.getElementById('hrScanStage');
  if (!stage) return;
  _hrScanDrag = { stage: stage };
  if (stage.setPointerCapture && ev.pointerId != null) {
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (err) {}
  }
}

function hrScanDirPointerMove_(ev) {
  if (!_hrScanDrag) return;
  var rec = _hrScanDrag.stage.getBoundingClientRect();
  if (!rec.width || !rec.height) return;
  _hrScan.x = Math.max(0, Math.min(0.82, (ev.clientX - rec.left) / rec.width - _hrScan.w / 2));
  _hrScan.y = Math.max(0, Math.min(0.9, (ev.clientY - rec.top) / rec.height - 0.03));
  hrRenderScan_();
}

function hrScanDirPointerUp_() {
  _hrScanDrag = null;
}

function hrBindScanDrag_() {
  var sig = document.getElementById('hrScanDirSig');
  if (!sig || sig.getAttribute('data-bound')) return;
  sig.setAttribute('data-bound', '1');
  sig.addEventListener('pointerdown', hrScanDirPointerDown_);
  sig.addEventListener('pointermove', hrScanDirPointerMove_);
  sig.addEventListener('pointerup', hrScanDirPointerUp_);
  sig.addEventListener('pointercancel', hrScanDirPointerUp_);
}

var HR_TRASH_SHEETS = ['HrLeaveRequests'];

function hrShowStaffTools_() {
  var show = hrCanWrite_() && !hrIsDirectorOnly_();
  var trash = document.getElementById('btnHrTrash');
  var reset = document.getElementById('btnHrReset');
  if (trash) trash.style.display = show ? '' : 'none';
  if (reset) reset.style.display = show ? '' : 'none';
}

function hrRbOpen_() {
  if (!hrCanWrite_()) return;
  var m = document.getElementById('hrRbModal');
  if (m) m.style.display = 'flex';
  hrRbLoad_();
}

function hrRbClose_() {
  var m = document.getElementById('hrRbModal');
  if (m) m.style.display = 'none';
}

function hrRbItemHtml_(it) {
  var when = String(it.deletedAt || '').replace('T', ' ').slice(0, 16);
  var how = it.reason === 'reset'
    ? '<span class="rb-how reset">Reset</span>'
    : '<span class="rb-how">Delete</span>';
  var title = hrEsc_(it.preview || it.empName || 'Leave request');
  var ref = it.num ? ('<span class="rb-ref">#' + hrEsc_(String(it.num)) + '</span> ') : '';
  var st = String(it.status || '');
  var status = st
    ? '<span class="rb-status open">' + hrEsc_(HR_STATUS_LABEL[st] || st) + '</span>'
    : '';
  var locParts = [];
  if (it.empCode) locParts.push(String(it.empCode));
  if (it.leaveType) locParts.push(String(it.leaveType));
  var loc = hrEsc_(locParts.join(' · '));
  var tid = hrEsc_(it.trashId);
  return '<div class="rb-item">'
    + '<div class="rb-body">'
    + '<div class="rb-title">' + ref + title + ' ' + status + '</div>'
    + (loc ? '<div class="rb-loc">' + loc + '</div>' : '')
    + '<div class="rb-meta">' + hrEsc_(when) + (it.deletedBy ? (' · ' + hrEsc_(it.deletedBy)) : '') + ' · ' + how + '</div>'
    + '</div>'
    + '<div class="rb-actions">'
    + '<button type="button" class="rb-restore" onclick="hrRbRestore_(\'' + tid + '\')">Restore</button>'
    + '<button type="button" class="rb-purge" onclick="hrRbPurge_(\'' + tid + '\')" title="Delete forever">✕</button>'
    + '</div></div>';
}

function hrRbLoad_() {
  var box = document.getElementById('hrRbList');
  if (!box) return;
  box.innerHTML = '<p style="color:var(--text-faint);">Loading…</p>';
  fetchJSONRetry({
    action: 'getTrash',
    dept: HR_DEPT,
    sheets: HR_TRASH_SHEETS,
    token: hrToken_()
  }, 1, 30000).then(function (d) {
    if (d && d.ok === false) throw new Error(d.message || d.error || 'Could not load bin');
    var items = Array.isArray(d) ? d : (Array.isArray(d.items) ? d.items : []);
    if (!items.length) {
      box.innerHTML = '<p style="color:var(--text-faint);">The bin is empty.</p>';
      return;
    }
    box.innerHTML = '<div class="rb-items">' + items.map(hrRbItemHtml_).join('') + '</div>';
  }).catch(function (e) {
    box.innerHTML = '<p style="color:#C5504F;">' + hrEsc_(e.message || 'Could not load') + '</p>';
  });
}

function hrRbRestore_(id) {
  var go = function () {
    fetchJSONRetry({
      action: 'restoreTrash',
      dept: HR_DEPT,
      sheets: HR_TRASH_SHEETS,
      trashIds: [id],
      token: hrToken_()
    }, 1, 30000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Restore failed');
      hrRbLoad_();
      return hrLoad_(true);
    }).catch(function (e) {
      hrMsg_(e.message || 'Restore failed.', false);
    });
  };
  if (typeof uiConfirm === 'function') {
    uiConfirm('Restore this leave request?').then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm('Restore this leave request?')) go();
}

function hrRbPurge_(id) {
  var go = function () {
    fetchJSONRetry({
      action: 'purgeTrash',
      dept: HR_DEPT,
      sheets: HR_TRASH_SHEETS,
      trashIds: [id],
      token: hrToken_()
    }, 1, 30000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Delete forever failed');
      hrRbLoad_();
    }).catch(function (e) {
      hrMsg_(e.message || 'Delete forever failed.', false);
    });
  };
  var msg = 'Delete this record forever? This cannot be undone.';
  if (typeof uiConfirm === 'function') {
    uiConfirm(msg, { danger: true }).then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm(msg)) go();
}

function hrRbRestoreAll_() {
  var go = function () {
    fetchJSONRetry({
      action: 'restoreTrash',
      dept: HR_DEPT,
      sheets: HR_TRASH_SHEETS,
      token: hrToken_()
    }, 1, 60000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Restore failed');
      hrRbLoad_();
      return hrLoad_(true);
    }).catch(function (e) {
      hrMsg_(e.message || 'Restore failed.', false);
    });
  };
  if (typeof uiConfirm === 'function') {
    uiConfirm('Restore everything in the bin?').then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm('Restore everything in the bin?')) go();
}

function hrRbEmpty_() {
  var go = function () {
    fetchJSONRetry({
      action: 'purgeTrash',
      dept: HR_DEPT,
      sheets: HR_TRASH_SHEETS,
      token: hrToken_()
    }, 1, 60000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Empty bin failed');
      hrRbLoad_();
    }).catch(function (e) {
      hrMsg_(e.message || 'Empty bin failed.', false);
    });
  };
  var msg = 'Empty the Recycle Bin? This deletes every item forever.';
  if (typeof uiConfirm === 'function') {
    uiConfirm(msg, { danger: true }).then(function (ok) { if (ok) go(); });
    return;
  }
  if (confirm(msg)) go();
}

function hrOpenResetModal_() {
  if (!hrCanWrite_()) return;
  var m = document.getElementById('hrResetModal');
  var pw = document.getElementById('hrResetPwInput');
  var msg = document.getElementById('hrResetMsg');
  if (pw) pw.value = '';
  if (msg) msg.textContent = '';
  if (m) m.style.display = 'flex';
  if (pw) setTimeout(function () { pw.focus(); }, 50);
}

function hrCloseResetModal_() {
  var m = document.getElementById('hrResetModal');
  if (m) m.style.display = 'none';
}

function hrDoReset_() {
  var pwEl = document.getElementById('hrResetPwInput');
  var msg = document.getElementById('hrResetMsg');
  if (!pwEl || !msg) return;
  var pw = String(pwEl.value || '');
  if (!pw) {
    msg.style.color = '#C5504F';
    msg.textContent = 'Please enter the password.';
    return;
  }
  msg.style.color = 'var(--text-soft)';
  msg.textContent = 'Moving to Recycle Bin…';
  fetchJSONRetry({
    action: 'clearHrLeaveRequests',
    token: hrToken_(),
    resetPassword: pw,
    username: typeof empireGetUser === 'function' ? empireGetUser() : ''
  }, 1, 60000).then(function (d) {
    if (d && d.error === 'bad_password') {
      msg.style.color = '#C5504F';
      msg.textContent = 'Wrong password — nothing was deleted.';
      return;
    }
    if (d && d.error === 'not_allowed') {
      msg.style.color = '#C5504F';
      msg.textContent = 'Not allowed.';
      return;
    }
    if (d && d.ok === false) {
      msg.style.color = '#C5504F';
      msg.textContent = d.message || d.error || 'Reset failed';
      return;
    }
    msg.style.color = '#1d9e75';
    msg.textContent = 'Moved ' + (d.cleared || 0) + ' leave request(s) to the Recycle Bin.';
    hrLoad_(true);
    setTimeout(hrCloseResetModal_, 900);
  }).catch(function (e) {
    msg.style.color = '#C5504F';
    msg.textContent = e.message || 'Reset failed';
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
      var stay = _hrListEditing;
      return hrLoad_(true).then(function () {
        if (stay) hrSetListEditing_(true);
      });
    })
    .catch(function (err) {
      hrMsg_(err.message || 'Save failed.', false);
    })
    .finally(function () {
      _hrSaving = false;
    });
}

function hrDelete_() {
  hrDeleteRow_(hrVal_('hr-id'));
}

function hrPrintFieldText_(el) {
  if (!el) return '';
  if (el.tagName === 'SELECT') {
    var opt = el.options[el.selectedIndex];
    return opt ? String(opt.text || '') : String(el.value || '');
  }
  return String(el.value || '');
}

function hrBakePrintClone_(src) {
  var clone = src.cloneNode(true);
  src.querySelectorAll('input, select, textarea').forEach(function (el) {
    var id = el.id;
    if (!id) return;
    var dest = clone.querySelector('[id="' + id.replace(/"/g, '') + '"]');
    if (!dest || !dest.parentNode) return;
    if (el.classList.contains('hr-date-native') || el.type === 'hidden' || el.type === 'file') {
      dest.parentNode.removeChild(dest);
      return;
    }
    var span = document.createElement('span');
    span.className = (dest.className || 'hr-cell-input').replace(/\bhr-date-native\b/g, '').trim() || 'hr-cell-input';
    if (id === 'hr-startDate-view' || id === 'hr-endDate-view') {
      var native = document.getElementById(id.replace(/-view$/, ''));
      span.textContent = hrFmtAbsenceDate_(native && native.value) || hrPrintFieldText_(el);
    } else {
      span.textContent = hrPrintFieldText_(el);
    }
    if (el.style && el.style.display) span.style.display = el.style.display;
    dest.parentNode.replaceChild(span, dest);
  });
  clone.querySelectorAll('.hr-date-native').forEach(function (el) {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
  return clone;
}

function hrPrint_() {
  document.body.classList.remove('hr-print-scan');
  var src = document.getElementById('hrPrintRoot');
  if (!src) {
    window.print();
    return;
  }
  var clone = hrBakePrintClone_(src);
  var base = location.origin + location.pathname.replace(/[^/]+$/, '');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Leave Request</title>'
    + '<base href="' + String(base).replace(/"/g, '') + '">'
    + '<link rel="stylesheet" href="assets/empire-hr.css?v=2026-09-02-hr-aug-26">'
    + '<style>'
    + '@page{size:A4 portrait;margin:7mm 16.26mm 12mm 17.51mm;}'
    + 'html,body{margin:0;padding:0;background:#fff;color:#000;}'
    + '@media print{body *{visibility:visible!important;color:#000!important;-webkit-text-fill-color:#000!important;}}'
    + '.hr-note{width:100%!important;min-height:278mm!important;padding:0!important;margin:0!important;border:none!important;box-shadow:none!important;max-width:none!important;position:relative!important;}'
    + '.hr-f06-doc-foot{right:0!important;bottom:0!important;}'
    + '.hr-cell-input,.hr-date-view{color:#000!important;-webkit-text-fill-color:#000!important;display:inline-block;width:100%;font:inherit;}'
    + '.hr-date-native{display:none!important;}'
    + '</style></head><body>' + clone.outerHTML + '</body></html>';
  var frame = document.getElementById('hrPrintFrame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'hrPrintFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);
  }
  var win = frame.contentWindow;
  var doc = frame.contentDocument || (win && win.document);
  if (!doc || !win) {
    window.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  hrWaitImages_(doc.body, function () {
    setTimeout(function () {
      try {
        win.focus();
        win.print();
      } catch (err) {
        window.print();
      }
    }, 250);
  });
}

function hrEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  if (typeof empireAuthRefreshPerms === 'function') {
    empireAuthRefreshPerms(function () {
      _hrCanWrite = hrCanWrite_();
      hrShowStaffTools_();
    });
  }
  _hrCanWrite = hrCanWrite_();
  if (!hrVal_('hr-id')) {
    hrClearForm_();
  }
  hrApplyPaperLock_();
  if (hrIsDirectorOnly_()) {
    var scanBtn = document.getElementById('tabBtnScan');
    if (scanBtn) scanBtn.style.display = 'none';
    var doneBtn = document.getElementById('tabBtnDone');
    if (doneBtn) doneBtn.style.display = 'none';
    var confirmedBtn = document.getElementById('tabBtnConfirmed');
    if (confirmedBtn) confirmedBtn.style.display = '';
    hrOpenLeaveNav_();
    hrSwitchTab_(null, 'list');
  }
  hrShowStaffTools_();
  hrRenderScan_();
  hrLoad_(true);
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
  hrBindScanDrag_();
  document.addEventListener('click', function (e) {
    var wrap = document.getElementById('hrSettingsWrap');
    if (!wrap || !wrap.classList.contains('open')) return;
    if (wrap.contains(e.target)) return;
    hrCloseSettings_();
  });
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('hr-print-scan');
    hrClearBatchPrint_();
  });
  if (!empireAuthPageBoot({
    dept: HR_DEPT,
    sendToHomeLogin: false,
    onEnter: hrEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', hrInit_);
