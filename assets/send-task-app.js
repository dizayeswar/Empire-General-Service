/* Send Task — senders send apartment tasks to a department, department staff do them on the phone */
var DT_LOGIN_DEPT = 'send task';
var DT_SEND_KEY = 'send_task';
var DT_WORK_KEYS = {
  electrical: 'dtask_worker_electrical',
  civil: 'dtask_worker_civil',
  hvac: 'dtask_worker_hvac',
  mechanical: 'dtask_worker_mechanical'
};
var DT_DEPT_LABELS = { electrical: 'Electrical', civil: 'Civil', hvac: 'HVAC', mechanical: 'Mechanical' };
var DT_POLL_MS = 60000;
var DT_PROJECT_NAMES = { ec: 'Empire Complex', es: 'Empire Square', wd: 'West Diamond', ww: 'West Wing', ra: 'Royal Apartment' };
var DT_STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done', closed: 'Closed', cancelled: 'Cancelled' };
var DT_PHOTO_LABEL = { before: 'Before', after: 'After', invoice: 'Invoice' };
var DT_VOICE_MAX_SEC = 180;
var DT_ITEM_LABEL = { pending: 'Pending', done: 'Done', cant_fix: "Can't fix" };
var DT_PRIORITY_LABEL = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

var _dtMode = '';
var _dtLocations = [];
var _dtIssueTypes = [];
var _dtCatalogLoaded = false;
var _dtTasks = [];
var _dtDetail = null;
var _dtPhoneTab = 'new';
var _dtBusy = false;
var _dtPollTimer = null;
var _dtPendingOpenId = '';
var _dtPhotoTarget = null;

function dtEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dtMe_() { return String(empireGetUser() || '').trim().toLowerCase(); }
function dtIsAdmin_() { return typeof empireIsAdminRole === 'function' && empireIsAdminRole(); }
function dtCanSend_() { return dtIsAdmin_() || empireModuleLevel(DT_SEND_KEY) !== 'none'; }
function dtCanSendWrite_() { return dtIsAdmin_() || empireModuleLevel(DT_SEND_KEY) === 'write'; }
function dtWorkDepts_() {
  return Object.keys(DT_WORK_KEYS).filter(function (k) {
    return dtIsAdmin_() || empireModuleLevel(DT_WORK_KEYS[k]) === 'write';
  });
}
function dtCanWork_() { return dtWorkDepts_().length > 0; }
function dtDeptLabel_(k) { return DT_DEPT_LABELS[k] || k; }
function dtPretty_(u) {
  return String(u || '').split(/[_.\s]+/).filter(Boolean).map(function (p) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
}
function dtWhen_(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  var z = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function dtVisit_(t) { return t.visitAt ? dtWhen_(t.visitAt) : 'No set time'; }
function dtLoc_(t) {
  return [t.building, t.floor, t.unit].filter(function (x) { return String(x || '').trim(); }).join(' · ');
}
function dtStatusBadge_(status) {
  return '<span class="dt-badge dt-st-' + dtEsc_(status) + '">' + dtEsc_(DT_STATUS_LABEL[status] || status) + '</span>';
}
function dtItemBadge_(status) {
  return '<span class="dt-badge dt-it-' + dtEsc_(status) + '">' + dtEsc_(DT_ITEM_LABEL[status] || status) + '</span>';
}
function dtDeptBadge_(dept) {
  return '<span class="dt-dept dt-dept-' + dtEsc_(dept) + '">' + dtEsc_(dtDeptLabel_(dept)) + '</span>';
}
function dtProgress_(t) {
  var items = t.items || [];
  var closed = items.filter(function (i) { return i.status !== 'pending'; }).length;
  return closed + '/' + items.length;
}
function dtApi_(action, extra) {
  var body = { action: action, token: empireGetToken() };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return fetchJSONRetry(body, 2, 45000).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Request failed');
    return d;
  });
}

// ---------------------------------------------------------------------------
// Login and mode
// ---------------------------------------------------------------------------

function dtHandleLogin_(e) {
  empireAuthLogin(e, 'auto', { onSuccess: function () { dtEnter_(); } }).catch(function () {});
}

function dtLogout_() {
  dtStopPoll_();
  if (_dtMode === 'phone' && typeof empireAuthWorkerLogout === 'function') {
    empireAuthWorkerLogout({ requirePassword: true, reload: true });
    return;
  }
  empireAuthLogout({ reload: true });
}

function dtEnter_() {
  document.getElementById('loginPage').classList.remove('show');
  empireAuthMarkLoginVisible(false);
  if (!dtCanSend_() && !dtCanWork_()) {
    var msg = document.getElementById('loginMessage');
    document.getElementById('loginPage').classList.add('show');
    empireAuthMarkLoginVisible(true);
    empireShowLoginMessage(msg, 'This account has no Send Task access. Ask an admin to enable it.', true);
    return;
  }
  var saved = '';
  try { saved = localStorage.getItem('dt_mode_' + dtMe_()) || ''; } catch (e) {}
  var mode = dtCanSend_() ? 'desk' : 'phone';
  if (saved === 'phone' && dtCanWork_()) mode = 'phone';
  if (saved === 'desk' && dtCanSend_()) mode = 'desk';
  _dtPendingOpenId = dtJobFromUrl_();
  dtSwitchMode_(mode);
}

function dtSwitchMode_(mode) {
  _dtMode = mode;
  try { localStorage.setItem('dt_mode_' + dtMe_(), mode); } catch (e) {}
  document.getElementById('dtDeskApp').classList.toggle('show', mode === 'desk');
  document.getElementById('dtPhoneApp').classList.toggle('show', mode === 'phone');
  document.body.classList.toggle('dt-phone-mode', mode === 'phone');
  document.getElementById('dtToPhoneBtn').style.display = (mode === 'desk' && dtCanWork_()) ? '' : 'none';
  document.getElementById('dtToDeskBtn').style.display = (mode === 'phone' && dtCanSend_()) ? '' : 'none';
  document.getElementById('dtDeskWho').textContent = 'Signed in as ' + dtPretty_(dtMe_());
  if (mode === 'phone') dtSetupPhoneDepts_();
  dtLoadCatalogs_();
  dtLoadTasks_(true);
  dtStartPoll_();
}

function dtJobFromUrl_() {
  try {
    var u = new URL(location.href);
    var id = u.searchParams.get('job') || '';
    if (id) {
      u.searchParams.delete('job');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    }
    return id;
  } catch (e) { return ''; }
}

function dtStartPoll_() {
  dtStopPoll_();
  _dtPollTimer = setInterval(function () {
    if (document.hidden || _dtBusy) return;
    dtLoadTasks_(false);
  }, DT_POLL_MS);
}
function dtStopPoll_() {
  if (_dtPollTimer) clearInterval(_dtPollTimer);
  _dtPollTimer = null;
}

// ---------------------------------------------------------------------------
// Desk: catalogs + new task form
// ---------------------------------------------------------------------------

function dtLoadCatalogs_() {
  if (_dtCatalogLoaded) return;
  Promise.all([dtApi_('getDtaskLocations'), dtApi_('getDtaskIssueTypes')]).then(function (res) {
    _dtCatalogLoaded = true;
    _dtLocations = res[0].locations || [];
    _dtIssueTypes = res[1].issueTypes || [];
    var depts = (res[1].departments || []).map(function (d) { return d.key; });
    if (depts.length) dtFillDeptSelects_(depts);
    dtFillProjects_();
    dtRenderIssuePicker_();
  }).catch(function (err) {
    document.getElementById('dtIssuePicker').innerHTML = empireErrorHtml(err.message);
  });
}

function dtFillDeptSelects_(depts) {
  var sendSel = document.getElementById('dtDept');
  var prev = sendSel.value;
  sendSel.innerHTML = '<option value="">— Pick a department —</option>' + depts.map(function (k) {
    return '<option value="' + dtEsc_(k) + '">' + dtEsc_(dtDeptLabel_(k)) + ' Department</option>';
  }).join('');
  if (prev) sendSel.value = prev;
  var filterSel = document.getElementById('dtFilterDept');
  var prevF = filterSel.value;
  filterSel.innerHTML = '<option value="">All departments</option>' + depts.map(function (k) {
    return '<option value="' + dtEsc_(k) + '">' + dtEsc_(dtDeptLabel_(k)) + '</option>';
  }).join('');
  filterSel.value = prevF;
}

function dtFillSelect_(id, values, labelFn) {
  var el = document.getElementById(id);
  var prev = el.value;
  el.innerHTML = values.map(function (v) {
    return '<option value="' + dtEsc_(v) + '">' + dtEsc_(labelFn ? labelFn(v) : v) + '</option>';
  }).join('');
  if (values.indexOf(prev) !== -1) el.value = prev;
}

function dtUnique_(list) {
  var seen = {};
  return list.filter(function (v) {
    if (seen[v]) return false;
    seen[v] = 1;
    return true;
  });
}

function dtFillProjects_() {
  var projects = dtUnique_(_dtLocations.map(function (l) { return l.project; }));
  dtFillSelect_('dtProject', projects, function (p) { return DT_PROJECT_NAMES[p] || p.toUpperCase(); });
  dtOnProjectChange_();
}
function dtOnProjectChange_() {
  var p = document.getElementById('dtProject').value;
  var buildings = dtUnique_(_dtLocations.filter(function (l) { return l.project === p; }).map(function (l) { return l.building; }));
  buildings.sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  dtFillSelect_('dtBuilding', buildings);
  dtOnBuildingChange_();
}
function dtOnBuildingChange_() {
  var p = document.getElementById('dtProject').value;
  var b = document.getElementById('dtBuilding').value;
  var rows = _dtLocations.filter(function (l) { return l.project === p && l.building === b && !l.unit; });
  rows.sort(function (x, y) { return x.sortOrder - y.sortOrder; });
  dtFillSelect_('dtFloor', dtUnique_(rows.map(function (l) { return l.floor; })));
  dtOnFloorChange_();
}
function dtOnFloorChange_() {
  var p = document.getElementById('dtProject').value;
  var b = document.getElementById('dtBuilding').value;
  var f = document.getElementById('dtFloor').value;
  var units = dtUnique_(_dtLocations.filter(function (l) {
    return l.project === p && l.building === b && l.floor === f && l.unit;
  }).map(function (l) { return l.unit; }));
  units.sort(function (a, c) { return a.localeCompare(c, undefined, { numeric: true }); });
  document.getElementById('dtUnitList').innerHTML = units.map(function (u) {
    return '<option value="' + dtEsc_(u) + '"></option>';
  }).join('');
}

function dtOnDeptChange_() {
  dtRenderIssuePicker_();
  dtSetMsg_('dtSendMsg', '');
}

function dtRenderIssuePicker_() {
  var host = document.getElementById('dtIssuePicker');
  var dept = document.getElementById('dtDept').value;
  document.getElementById('dtIssuesTitle').textContent = dept ? dtDeptLabel_(dept) + ' issues found' : 'Issues found';
  if (!dept) {
    host.innerHTML = '<p class="dt-hint">Pick the department first. Its issue list shows here.</p>';
    return;
  }
  var types = _dtIssueTypes.filter(function (t) { return t.dept === dept; });
  if (!types.length) {
    host.innerHTML = empireEmptyHtml('No issue types for this department yet', 'Run the Send Task SQL in Supabase first.');
    return;
  }
  host.innerHTML = types.map(function (t) {
    return '<div class="dt-issue-row" data-type-id="' + dtEsc_(t.id) + '">' +
      '<label class="dt-issue-check"><input type="checkbox" onchange="dtOnIssueToggle_(this)"> ' + dtEsc_(t.label) + '</label>' +
      '<input type="text" class="dt-issue-note" placeholder="' + (t.code === 'other' ? 'Describe the issue (required)' : 'Detail (optional) — which room, how many…') + '" style="display:none" autocomplete="off">' +
      '</div>';
  }).join('');
}
function dtOnIssueToggle_(cb) {
  var row = cb.closest('.dt-issue-row');
  row.classList.toggle('checked', cb.checked);
  row.querySelector('.dt-issue-note').style.display = cb.checked ? '' : 'none';
  if (cb.checked) row.querySelector('.dt-issue-note').focus();
}

function dtOnVisitModeChange_() {
  var mode = (document.querySelector('input[name="dtVisitMode"]:checked') || {}).value;
  var el = document.getElementById('dtVisitAt');
  el.style.display = mode === 'time' ? '' : 'none';
  if (mode === 'time' && !el.value) {
    var d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    var z = function (n) { return String(n).padStart(2, '0'); };
    el.value = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':00';
  }
}

function dtSetMsg_(id, text, isError) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('dt-msg-error', !!isError);
}

function dtSendTask_() {
  if (_dtBusy) return;
  var dept = document.getElementById('dtDept').value;
  if (!dept) { dtSetMsg_('dtSendMsg', 'Pick the department to send to.', true); return; }
  var items = [];
  var missingOther = false;
  document.querySelectorAll('#dtIssuePicker .dt-issue-row').forEach(function (row) {
    if (!row.querySelector('input[type=checkbox]').checked) return;
    var typeId = row.getAttribute('data-type-id');
    var type = _dtIssueTypes.filter(function (t) { return t.id === typeId; })[0] || {};
    var note = row.querySelector('.dt-issue-note').value.trim();
    if (type.code === 'other' && !note) missingOther = true;
    items.push({ issueTypeId: typeId, label: type.code === 'other' && note ? note : '', note: type.code === 'other' ? '' : note });
  });
  if (!items.length) { dtSetMsg_('dtSendMsg', 'Tick at least one issue.', true); return; }
  if (missingOther) { dtSetMsg_('dtSendMsg', 'Describe the "Other" issue.', true); return; }

  var visitAt = '';
  var visitMode = (document.querySelector('input[name="dtVisitMode"]:checked') || {}).value;
  if (visitMode === 'time') {
    var raw = document.getElementById('dtVisitAt').value;
    var vd = raw ? new Date(raw) : null;
    if (!vd || isNaN(vd.getTime())) { dtSetMsg_('dtSendMsg', 'Pick the visit date and time, or choose "No set time".', true); return; }
    visitAt = vd.toISOString();
  }

  var payload = {
    dept: dept,
    project: document.getElementById('dtProject').value,
    building: document.getElementById('dtBuilding').value,
    floor: document.getElementById('dtFloor').value,
    unit: document.getElementById('dtUnit').value.trim(),
    priority: document.getElementById('dtPriority').value,
    visitAt: visitAt,
    note: document.getElementById('dtNote').value.trim(),
    items: items
  };
  if (!payload.building || !payload.floor) { dtSetMsg_('dtSendMsg', 'Pick a building and floor.', true); return; }
  if (_dtDraftRec) { dtSetMsg_('dtSendMsg', 'Stop the voice message first, or cancel it.', true); return; }
  var draftVoice = _dtDraftVoice;
  _dtBusy = true;
  var btn = document.getElementById('dtSendBtn');
  btn.disabled = true;
  dtSetMsg_('dtSendMsg', 'Sending…');
  dtApi_('createDtask', payload).then(function (d) {
    if (!draftVoice || !d.task) return d;
    dtSetMsg_('dtSendMsg', 'Sending the voice message…');
    return empireUploadAudioAsync(draftVoice.blob, 'dtasks/' + dept + '/voice').then(function (url) {
      if (!url) {
        var err = new Error((typeof _lastEmpireUploadError !== 'undefined' && _lastEmpireUploadError) || 'Voice upload failed.');
        err.taskSent = d.task;
        throw err;
      }
      return dtApi_('addDtaskVoice', { id: d.task.id, url: url, durationSec: draftVoice.sec }).then(function () { return d; });
    });
  }).then(function (d) {
    var voiceNote = draftVoice ? ' The voice message is on the task.' : '';
    dtSetMsg_('dtSendMsg', 'Sent ' + (d.task && d.task.ref ? d.task.ref : 'task') + ' to the ' + dtDeptLabel_(dept) + ' department.' + voiceNote);
    if (payload.unit && !_dtLocations.some(function (l) {
      return l.project === payload.project && l.building === payload.building && l.floor === payload.floor && l.unit === payload.unit;
    })) {
      _dtLocations.push({ project: payload.project, building: payload.building, floor: payload.floor, unit: payload.unit, sortOrder: 0 });
    }
    dtResetForm_();
    dtLoadTasks_(false);
  }).catch(function (err) {
    if (err && err.taskSent) {
      dtSetMsg_('dtSendMsg', 'The task was sent, but the voice message did not go through. Open the task and record it again.', true);
      dtResetForm_();
      dtLoadTasks_(false);
      return;
    }
    dtSetMsg_('dtSendMsg', err.message, true);
  }).finally(function () {
    _dtBusy = false;
    btn.disabled = false;
  });
}

function dtResetForm_() {
  document.getElementById('dtUnit').value = '';
  document.getElementById('dtNote').value = '';
  document.getElementById('dtPriority').value = 'normal';
  document.getElementById('dtVisitAt').value = '';
  document.querySelector('input[name="dtVisitMode"][value="none"]').checked = true;
  dtOnVisitModeChange_();
  document.querySelectorAll('#dtIssuePicker .dt-issue-row').forEach(function (row) {
    row.querySelector('input[type=checkbox]').checked = false;
    row.classList.remove('checked');
    var n = row.querySelector('.dt-issue-note');
    n.value = '';
    n.style.display = 'none';
  });
  dtOnFloorChange_();
  dtDraftVoiceRemove_();
}

var _dtDraftRec = null;
var _dtDraftVoice = null;

function dtDraftVoiceUi_() {
  var btn = document.getElementById('dtDraftVoiceBtn');
  var cancel = document.getElementById('dtDraftVoiceCancel');
  var remove = document.getElementById('dtDraftVoiceRemove');
  var play = document.getElementById('dtDraftVoicePlay');
  if (!btn) return;
  if (_dtDraftRec) {
    btn.textContent = '⏹ Stop (' + dtFmtSec_(_dtDraftRec.sec) + ')';
    if (cancel) cancel.style.display = '';
    if (remove) remove.style.display = 'none';
    return;
  }
  btn.textContent = _dtDraftVoice ? '🎤 Record again' : '🎤 Record voice';
  if (cancel) cancel.style.display = 'none';
  if (remove) remove.style.display = _dtDraftVoice ? '' : 'none';
  if (play) {
    play.style.display = _dtDraftVoice ? '' : 'none';
    if (_dtDraftVoice) play.src = _dtDraftVoice.url;
  }
}

function dtDraftVoiceToggle_() {
  if (_dtDraftRec) { dtDraftVoiceFinish_(true); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    dtSetMsg_('dtSendMsg', 'Voice messages are not supported on this device.', true);
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    var mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].filter(function (m) {
      return MediaRecorder.isTypeSupported(m);
    })[0] || '';
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start();
    _dtDraftRec = { rec: rec, stream: stream, chunks: chunks, sec: 0 };
    dtDraftVoiceUi_();
    _dtDraftRec.timer = setInterval(function () {
      if (!_dtDraftRec) return;
      _dtDraftRec.sec++;
      if (_dtDraftRec.sec >= DT_VOICE_MAX_SEC) { dtDraftVoiceFinish_(true); return; }
      dtDraftVoiceUi_();
    }, 1000);
  }).catch(function () {
    dtSetMsg_('dtSendMsg', 'Allow the microphone to record a voice message.', true);
  });
}

function dtDraftVoiceCancel_() { dtDraftVoiceFinish_(false); }

function dtDraftVoiceFinish_(keep) {
  var v = _dtDraftRec;
  if (!v) return;
  _dtDraftRec = null;
  clearInterval(v.timer);
  v.stream.getTracks().forEach(function (tr) { tr.stop(); });
  v.rec.onstop = function () {
    if (!keep || v.sec < 1 || !v.chunks.length) {
      dtDraftVoiceUi_();
      if (keep) dtSetMsg_('dtSendMsg', 'Voice message was too short. Hold it a little longer.', true);
      return;
    }
    if (_dtDraftVoice && _dtDraftVoice.url) URL.revokeObjectURL(_dtDraftVoice.url);
    var blob = new Blob(v.chunks, { type: v.rec.mimeType || 'audio/webm' });
    _dtDraftVoice = { blob: blob, sec: v.sec, url: URL.createObjectURL(blob) };
    dtDraftVoiceUi_();
    dtSetMsg_('dtSendMsg', 'Voice message ready. It goes with the task when you send it.');
  };
  if (v.rec.state !== 'inactive') v.rec.stop();
  else dtDraftVoiceUi_();
}

function dtDraftVoiceRemove_() {
  if (_dtDraftRec) dtDraftVoiceFinish_(false);
  if (_dtDraftVoice && _dtDraftVoice.url) URL.revokeObjectURL(_dtDraftVoice.url);
  _dtDraftVoice = null;
  dtDraftVoiceUi_();
}

function dtDeskTab_(tab) {
  document.getElementById('dtTabNew').classList.toggle('active', tab === 'new');
  document.getElementById('dtTabList').classList.toggle('active', tab === 'list');
  document.getElementById('dtPaneNew').classList.toggle('active', tab === 'new');
  document.getElementById('dtPaneList').classList.toggle('active', tab === 'list');
  if (tab === 'list') dtRenderDeskList_();
}

// ---------------------------------------------------------------------------
// Task lists
// ---------------------------------------------------------------------------

function dtLoadTasks_(showLoading) {
  var hostId = _dtMode === 'desk' ? 'dtDeskList' : 'dtPhoneList';
  if (showLoading && !_dtTasks.length) document.getElementById(hostId).innerHTML = empireLoadingHtml();
  return dtApi_('getDtasks', { view: _dtMode === 'desk' ? 'sender' : 'worker' }).then(function (d) {
    _dtTasks = d.tasks || [];
    if (_dtMode === 'desk') dtRenderDeskList_();
    else dtRenderPhoneList_();
    if (_dtPendingOpenId) {
      var id = _dtPendingOpenId;
      _dtPendingOpenId = '';
      dtOpenDetail_(id);
    }
  }).catch(function (err) {
    if (showLoading) document.getElementById(hostId).innerHTML = empireErrorHtml(err.message);
  });
}

function dtRenderDeskList_() {
  var openCount = _dtTasks.filter(function (t) { return t.status === 'open' || t.status === 'in_progress'; }).length;
  var badge = document.getElementById('dtOpenCount');
  badge.textContent = String(openCount);
  badge.style.display = openCount ? '' : 'none';

  var dept = document.getElementById('dtFilterDept').value;
  var status = document.getElementById('dtFilterStatus').value;
  var q = document.getElementById('dtFilterSearch').value.trim().toLowerCase();
  var rows = _dtTasks.filter(function (t) {
    if (dept && t.dept !== dept) return false;
    if (status && t.status !== status) return false;
    if (!q) return true;
    var blob = [t.ref, t.deptLabel, t.building, t.floor, t.unit, t.assignedTo, dtPretty_(t.assignedTo), t.createdBy, t.note]
      .concat((t.items || []).map(function (i) { return i.issueLabel; })).join(' ').toLowerCase();
    return blob.indexOf(q) !== -1;
  });
  var host = document.getElementById('dtDeskList');
  if (!rows.length) {
    host.innerHTML = empireEmptyHtml('No tasks match', _dtTasks.length ? 'Change the filters.' : 'Send the first task from "New task".');
    return;
  }
  var h = '<div class="dt-table-wrap"><table><thead><tr>' +
    '<th>Task</th><th>Department</th><th>Apartment</th><th>Issues</th><th>Visit</th><th>Status</th><th>Taken by</th><th>Sent</th>' +
    '</tr></thead><tbody>';
  rows.forEach(function (t) {
    h += '<tr class="issue-row" onclick="dtOpenDetail_(\'' + dtEsc_(t.id) + '\')">' +
      '<td><strong>' + dtEsc_(t.ref) + '</strong>' + (t.priority !== 'normal' ? ' <span class="dt-prio dt-prio-' + dtEsc_(t.priority) + '">' + dtEsc_(DT_PRIORITY_LABEL[t.priority] || t.priority) + '</span>' : '') + '</td>' +
      '<td>' + dtDeptBadge_(t.dept) + '</td>' +
      '<td>' + dtEsc_(dtLoc_(t)) + '</td>' +
      '<td>' + dtEsc_(dtProgress_(t)) + ' — ' + dtEsc_((t.items || []).map(function (i) { return i.issueLabel; }).join(', ')) + '</td>' +
      '<td>' + dtEsc_(dtVisit_(t)) + '</td>' +
      '<td>' + dtStatusBadge_(t.status) + (t.refundable ? ' <span class="dt-refund-badge">Refundable</span>' : '') + '</td>' +
      '<td>' + dtEsc_(t.assignedTo ? dtPretty_(t.assignedTo) : '—') + '</td>' +
      '<td>' + dtEsc_(dtWhen_(t.sentAt || t.createdAt)) + '<br><span class="dt-sub">by ' + dtEsc_(dtPretty_(t.createdBy)) + '</span></td>' +
      '</tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}

function dtSetupPhoneDepts_() {
  var depts = dtWorkDepts_();
  var wrap = document.getElementById('dtPhoneDeptWrap');
  var sel = document.getElementById('dtPhoneDept');
  if (depts.length > 1) {
    sel.innerHTML = '<option value="">All my departments</option>' + depts.map(function (k) {
      return '<option value="' + dtEsc_(k) + '">' + dtEsc_(dtDeptLabel_(k)) + '</option>';
    }).join('');
    wrap.style.display = '';
  } else {
    sel.innerHTML = '';
    wrap.style.display = 'none';
  }
  document.getElementById('dtPhoneTitle').textContent = depts.length === 1
    ? dtDeptLabel_(depts[0]) + ' tasks — ' + dtPretty_(dtMe_())
    : 'Tasks — ' + dtPretty_(dtMe_());
}

function dtPhoneTab_(tab) {
  _dtPhoneTab = tab;
  ['new', 'mine', 'done'].forEach(function (k) {
    document.getElementById('dtPTab' + k.charAt(0).toUpperCase() + k.slice(1)).classList.toggle('active', k === tab);
  });
  dtRenderPhoneList_();
}

function dtPhoneBuckets_() {
  var me = dtMe_();
  var deptSel = document.getElementById('dtPhoneDept').value;
  var b = { new: [], mine: [], done: [] };
  _dtTasks.forEach(function (t) {
    if (deptSel && t.dept !== deptSel) return;
    if (t.status === 'open' && !t.assignedTo) b.new.push(t);
    else if (t.status === 'in_progress' && t.assignedTo === me) b.mine.push(t);
    else if ((t.status === 'done' || t.status === 'closed' || t.status === 'cancelled') && t.assignedTo === me) b.done.push(t);
  });
  b.new.sort(function (x, y) {
    var vx = x.visitAt ? new Date(x.visitAt).getTime() : Infinity;
    var vy = y.visitAt ? new Date(y.visitAt).getTime() : Infinity;
    return vx - vy;
  });
  return b;
}

function dtRenderPhoneList_() {
  var b = dtPhoneBuckets_();
  document.getElementById('dtPTabNew').textContent = 'New (' + b.new.length + ')';
  document.getElementById('dtPTabMine').textContent = 'My tasks (' + b.mine.length + ')';
  document.getElementById('dtPTabDone').textContent = 'Done (' + b.done.length + ')';
  document.getElementById('dtPhoneCount').textContent = b.new.length
    ? b.new.length + ' new task' + (b.new.length === 1 ? '' : 's') + ' waiting'
    : (b.mine.length ? b.mine.length + ' task' + (b.mine.length === 1 ? '' : 's') + ' in progress' : 'No new tasks');
  var list = b[_dtPhoneTab] || [];
  var host = document.getElementById('dtPhoneList');
  if (!list.length) {
    host.innerHTML = '<p class="worker-empty">' + (_dtPhoneTab === 'new' ? 'No new tasks.' : _dtPhoneTab === 'mine' ? 'Nothing in progress. Accept a task from New.' : 'No finished tasks yet.') + '</p>';
    return;
  }
  var showDept = dtWorkDepts_().length > 1;
  host.innerHTML = list.map(function (t) {
    return '<button type="button" class="dt-card" onclick="dtOpenDetail_(\'' + dtEsc_(t.id) + '\')">' +
      '<div class="dt-card-top"><strong>' + dtEsc_(t.ref) + '</strong>' + dtStatusBadge_(t.status) +
      (showDept ? dtDeptBadge_(t.dept) : '') +
      (t.priority !== 'normal' ? '<span class="dt-prio dt-prio-' + dtEsc_(t.priority) + '">' + dtEsc_(DT_PRIORITY_LABEL[t.priority] || t.priority) + '</span>' : '') +
      (t.refundable ? '<span class="dt-refund-badge">Refundable</span>' : '') + '</div>' +
      '<div class="dt-card-loc">' + dtEsc_(dtLoc_(t)) + '</div>' +
      '<div class="dt-card-from">From: <strong>' + dtEsc_(dtPretty_(t.createdBy)) + '</strong></div>' +
      '<div class="dt-card-issues">' + dtEsc_((t.items || []).map(function (i) { return i.issueLabel; }).join(', ')) + '</div>' +
      '<div class="dt-card-visit' + (t.visitAt ? ' dt-has-visit' : '') + '">🕒 ' + dtEsc_(dtVisit_(t)) + '</div>' +
      '<div class="dt-card-meta">' + dtEsc_(dtProgress_(t)) + ' issues · sent ' + dtEsc_(dtWhen_(t.sentAt || t.createdAt)) + '</div>' +
      '</button>';
  }).join('');
}

// ---------------------------------------------------------------------------
// Task detail
// ---------------------------------------------------------------------------

function dtOpenDetail_(id) {
  _dtDetail = null;
  document.getElementById('dtDetailTitle').textContent = 'Task';
  document.getElementById('dtDetailBody').innerHTML = empireLoadingHtml();
  document.getElementById('dtDetail').classList.add('show');
  dtApi_('getDtask', { id: id }).then(function (d) {
    dtShowDetail_(d.task);
  }).catch(function (err) {
    document.getElementById('dtDetailBody').innerHTML = empireErrorHtml(err.message);
  });
}

function dtCloseDetail_() {
  document.getElementById('dtDetail').classList.remove('show');
  _dtDetail = null;
}

function dtShowDetail_(task) {
  _dtDetail = task;
  var idx = -1;
  _dtTasks.forEach(function (t, i) { if (t.id === task.id) idx = i; });
  var slim = {};
  Object.keys(task).forEach(function (k) { if (k !== 'events' && k !== 'photos') slim[k] = task[k]; });
  if (idx !== -1) _dtTasks[idx] = slim;
  else _dtTasks.unshift(slim);
  if (_dtMode === 'desk') dtRenderDeskList_();
  else dtRenderPhoneList_();
  dtRenderDetail_();
}

function dtRenderDetail_() {
  var t = _dtDetail;
  if (!t) return;
  var me = dtMe_();
  var isAssignee = t.assignedTo === me;
  var canWorkDept = dtWorkDepts_().indexOf(t.dept) !== -1;
  var workerActive = _dtMode === 'phone' && canWorkDept && isAssignee && t.status === 'in_progress';
  var senderMode = _dtMode === 'desk' && dtCanSendWrite_();
  document.getElementById('dtDetailTitle').textContent = t.ref + ' — ' + (DT_STATUS_LABEL[t.status] || t.status);

  var h = '<h2>' + dtEsc_(dtLoc_(t) || 'Task') + '</h2>';
  h += '<div class="dt-meta">' + dtDeptBadge_(t.dept) + ' ' + dtStatusBadge_(t.status) +
    (t.refundable ? ' <span class="dt-refund-badge">Refundable</span>' : '') +
    ' <span class="dt-prio dt-prio-' + dtEsc_(t.priority) + '">' + dtEsc_(DT_PRIORITY_LABEL[t.priority] || t.priority) + '</span>' +
    ' <span>Project: ' + dtEsc_(DT_PROJECT_NAMES[t.project] || t.project || '—') + '</span>' +
    ' <span>Sent by ' + dtEsc_(dtPretty_(t.createdBy)) + ' · ' + dtEsc_(dtWhen_(t.sentAt || t.createdAt)) + '</span>' +
    (t.assignedTo ? ' <span>Taken by ' + dtEsc_(dtPretty_(t.assignedTo)) + '</span>' : '') + '</div>';
  h += '<p class="dt-visit-box' + (t.visitAt ? ' dt-has-visit' : '') + '">🕒 Visit: <strong>' + dtEsc_(dtVisit_(t)) + '</strong></p>';
  if (t.note) h += '<p class="dt-note-box">' + dtEsc_(t.note) + '</p>';

  if (_dtMode === 'phone' && canWorkDept && t.status === 'open' && !t.assignedTo) {
    h += '<button type="button" class="dt-primary dt-wide" onclick="dtAccept_()">Accept task</button>';
  }

  h += '<h3>Issues (' + dtEsc_(dtProgress_(t)) + ')</h3><div class="dt-items">';
  (t.items || []).forEach(function (it) {
    h += '<div class="dt-item dt-item-' + dtEsc_(it.status) + '">' +
      '<div class="dt-item-top"><strong>' + dtEsc_(it.issueLabel) + '</strong>' + dtItemBadge_(it.status) + '</div>';
    if (it.note) h += '<div class="dt-item-note">' + dtEsc_(it.note) + '</div>';
    if (it.workerNote) h += '<div class="dt-item-wnote">Worker: ' + dtEsc_(it.workerNote) + '</div>';
    if (it.completedBy) h += '<div class="dt-item-by">' + dtEsc_(dtPretty_(it.completedBy)) + ' · ' + dtEsc_(dtWhen_(it.completedAt)) + '</div>';
    var itPhotos = (t.photos || []).filter(function (p) { return p.itemId === it.id; });
    if (itPhotos.length) h += dtPhotosHtml_(itPhotos);
    if (workerActive) {
      h += '<div class="dt-item-actions">';
      if (it.status !== 'done') h += '<button type="button" class="dt-ok" onclick="dtSetItem_(\'' + dtEsc_(it.id) + '\',\'done\')">Done</button>';
      if (it.status !== 'cant_fix') h += '<button type="button" class="dt-warn" onclick="dtSetItem_(\'' + dtEsc_(it.id) + '\',\'cant_fix\')">Can\'t fix</button>';
      if (it.status !== 'pending') h += '<button type="button" onclick="dtSetItem_(\'' + dtEsc_(it.id) + '\',\'pending\')">Undo</button>';
      h += '<button type="button" onclick="dtPickPhoto_(\'' + dtEsc_(it.id) + '\',\'after\')">📷 Photo</button>';
      h += '</div>';
    }
    h += '</div>';
  });
  h += '</div>';

  var taskPhotos = (t.photos || []).filter(function (p) { return !p.itemId; });
  if (taskPhotos.length) h += '<h3>Photos</h3>' + dtPhotosHtml_(taskPhotos);

  if (workerActive) {
    var pending = (t.items || []).filter(function (i) { return i.status === 'pending'; }).length;
    var hasAfter = (t.photos || []).some(function (p) { return p.kind === 'after'; });
    var hasInvoice = (t.photos || []).some(function (p) { return p.kind === 'invoice'; });
    h += '<label class="dt-refund-check"><input type="checkbox" onchange="dtSetRefundable_(this)"' +
      (t.refundable ? ' checked' : '') + '> Refundable — this job costs money</label>';
    h += '<div class="dt-actions">' +
      '<button type="button" onclick="dtPickPhoto_(\'\',\'before\')">📷 Before photo <span class="dt-opt">optional</span></button>' +
      '<button type="button" onclick="dtPickPhoto_(\'\',\'after\')">📷 After photo <span class="dt-req">required</span></button>' +
      (t.refundable ? '<button type="button" onclick="dtPickPhoto_(\'\',\'invoice\')">📷 Invoice photo <span class="dt-req">required</span></button>' : '') +
      '</div>';
    h += '<p class="dt-photo-need">' +
      (hasAfter ? '✅ After photo added' : '⚠️ After photo is required') +
      (t.refundable ? (hasInvoice ? ' · ✅ Invoice photo added' : ' · ⚠️ Invoice photo is required') : '') + '</p>';
    var missing = [];
    if (pending) missing.push('finish all issues (' + pending + ' left)');
    if (!hasAfter) missing.push('add an after photo');
    if (t.refundable && !hasInvoice) missing.push('add the invoice photo');
    h += '<button type="button" class="dt-primary dt-wide"' + (missing.length ? ' disabled' : '') + ' onclick="dtComplete_()">' +
      (missing.length ? 'To complete: ' + dtEsc_(missing.join(', ')) : 'Complete task') + '</button>';
  }

  if (senderMode && (t.status === 'open' || t.status === 'in_progress')) {
    h += '<div class="dt-actions"><button type="button" class="dt-danger" onclick="dtCancel_()">Cancel task</button></div>';
  }
  if (senderMode && t.status === 'done') {
    h += '<div class="dt-actions">' +
      '<button type="button" class="dt-ok" onclick="dtClose_()">Close task — completed</button>' +
      '<button type="button" class="dt-warn" onclick="dtReopen_()">Reopen — not fixed properly</button></div>';
  }
  if (senderMode && t.status === 'closed') {
    h += '<div class="dt-actions"><button type="button" class="dt-warn" onclick="dtReopen_()">Reopen — not fixed properly</button></div>';
  }

  var canNote = (_dtMode === 'desk' && dtCanSend_() && t.status !== 'cancelled') || workerActive;
  if (canNote) {
    h += '<div class="dt-note-add"><textarea id="dtNoteText" rows="2" placeholder="Add a note to this task…"></textarea>' +
      '<button type="button" onclick="dtAddNote_()">Add note</button></div>';
  }
  h += '<p id="dtDetailMsg" class="dt-msg" aria-live="polite"></p>';

  h += dtVoiceHtml_(t);

  h += '<h3>History</h3><ol class="dt-timeline">';
  (t.events || []).slice().reverse().forEach(function (ev) {
    h += '<li><span class="dt-tl-when">' + dtEsc_(dtWhen_(ev.createdAt)) + '</span> ' + dtEventText_(ev) + '</li>';
  });
  h += '</ol>';
  document.getElementById('dtDetailBody').innerHTML = h;
}

function dtPhotosHtml_(photos) {
  return '<div class="dt-photos">' + photos.map(function (p) {
    return '<figure><img src="' + dtEsc_(p.url) + '" alt="" loading="lazy" onclick="dtBigImg_(this.src)"><figcaption>' +
      dtEsc_(DT_PHOTO_LABEL[p.kind] || p.kind) + ' · ' + dtEsc_(dtPretty_(p.uploadedBy)) + '</figcaption></figure>';
  }).join('') + '</div>';
}

function dtBigImg_(src) {
  document.getElementById('dtImgBig').src = src;
  document.getElementById('dtImgModal').classList.add('show');
}

function dtEventText_(ev) {
  var who = '<strong>' + dtEsc_(dtPretty_(ev.actor)) + '</strong>';
  var p = ev.payload || {};
  var issue = p.issue ? ' “' + dtEsc_(p.issue) + '”' : '';
  switch (ev.action) {
    case 'created':
      return who + ' created the task (' + dtEsc_((p.items || []).length) + ' issues' +
        (p.visitAt ? ', visit ' + dtEsc_(dtWhen_(p.visitAt)) : ', no set time') + ')';
    case 'sent': return who + ' sent it to the ' + dtEsc_(dtDeptLabel_(p.to)) + ' department';
    case 'viewed': return who + ' opened the task';
    case 'accepted': return who + ' accepted the task';
    case 'item_updated': return who + ' marked' + issue + ' as ' + dtEsc_(DT_ITEM_LABEL[p.to] || p.to) + (p.workerNote ? ' — ' + dtEsc_(p.workerNote) : '');
    case 'completed': return who + ' completed the task' + (p.note ? ' — ' + dtEsc_(p.note) : '');
    case 'closed': return who + ' closed the task' + (p.note ? ' — ' + dtEsc_(p.note) : '');
    case 'refundable': return who + (p.to ? ' marked the task as refundable (costs money)' : ' removed the refundable mark');
    case 'reopened': return who + ' reopened the task — ' + dtEsc_(p.reason || '');
    case 'cancelled': return who + ' cancelled the task — ' + dtEsc_(p.reason || '');
    case 'note': return who + ' noted: ' + dtEsc_(p.text || '');
    case 'photo': return who + ' added a ' + dtEsc_(p.kind || '') + ' photo';
    default: return who + ' ' + dtEsc_(ev.action);
  }
}

function dtDetailAction_(action, extra, okMsg) {
  if (_dtBusy || !_dtDetail) return Promise.resolve();
  _dtBusy = true;
  dtSetMsg_('dtDetailMsg', 'Saving…');
  var body = { id: _dtDetail.id };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return dtApi_(action, body).then(function (d) {
    _dtBusy = false;
    dtShowDetail_(d.task);
    if (okMsg) dtSetMsg_('dtDetailMsg', okMsg);
  }).catch(function (err) {
    _dtBusy = false;
    dtSetMsg_('dtDetailMsg', err.message, true);
  });
}

function dtAccept_() { dtDetailAction_('acceptDtask', {}, 'Task accepted. It is in My tasks now.'); }

function dtSetItem_(itemId, status) {
  var extra = { itemId: itemId, status: status };
  if (status === 'cant_fix') {
    var why = window.prompt("Why can't it be fixed? (needs material, no access…)") || '';
    if (!why.trim()) return;
    extra.workerNote = why.trim();
  }
  dtDetailAction_('updateDtaskItem', extra);
}

function dtComplete_() {
  if (!window.confirm('Complete this task? The sender will be notified.')) return;
  dtDetailAction_('completeDtask', {}, 'Task completed.');
}

function dtCancel_() {
  var reason = window.prompt('Why cancel this task?') || '';
  if (!reason.trim()) return;
  dtDetailAction_('cancelDtask', { reason: reason.trim() }, 'Task cancelled.');
}

function dtReopen_() {
  var reason = window.prompt('What is still wrong?') || '';
  if (!reason.trim()) return;
  dtDetailAction_('reopenDtask', { reason: reason.trim() }, 'Task reopened and sent back.');
}

function dtClose_() {
  if (!window.confirm('Close this task? It will be marked completed.')) return;
  dtDetailAction_('closeDtask', {}, 'Task closed.');
}

function dtSetRefundable_(cb) {
  dtDetailAction_('setDtaskRefundable', { refundable: !!cb.checked },
    cb.checked ? 'Marked as refundable. Add the invoice photo.' : 'Refundable removed.');
}

// ---------------------------------------------------------------------------
// Voice messages (not part of the report)
// ---------------------------------------------------------------------------

var _dtVoice = null;

function dtFmtSec_(s) {
  s = Math.max(0, Math.round(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function dtVoiceHtml_(t) {
  var canRecord = t.status !== 'cancelled' && (
    (_dtMode === 'desk' && dtCanSend_()) ||
    (_dtMode === 'phone' && t.assignedTo === dtMe_() && t.status === 'in_progress')
  );
  var voices = t.voice || [];
  if (!canRecord && !voices.length) return '';
  var h = '<h3>Voice messages</h3>';
  h += '<p class="dt-hint">Voice messages are just for talking. They are not included in the report.</p>';
  if (voices.length) {
    h += '<div class="dt-voices">' + voices.map(function (v) {
      return '<div class="dt-voice"><div class="dt-voice-who">' + dtEsc_(dtPretty_(v.sentBy)) + ' · ' + dtEsc_(dtWhen_(v.createdAt)) +
        (v.durationSec ? ' · ' + dtEsc_(dtFmtSec_(v.durationSec)) : '') + '</div>' +
        '<audio controls preload="none" src="' + dtEsc_(v.url) + '"></audio></div>';
    }).join('') + '</div>';
  }
  if (canRecord) {
    var recording = !!_dtVoice;
    h += '<div class="dt-actions">' +
      '<button type="button" id="dtVoiceBtn" onclick="dtVoiceToggle_()">' +
      (recording ? '⏹ Stop and send (' + dtFmtSec_(_dtVoice.sec) + ')' : '🎤 Voice message') + '</button>' +
      '<button type="button" id="dtVoiceCancel" onclick="dtVoiceCancel_()"' + (recording ? '' : ' style="display:none"') + '>Cancel</button>' +
      '</div>';
  }
  return h;
}

function dtVoiceToggle_() {
  if (_dtVoice) { dtVoiceFinish_(true); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    dtSetMsg_('dtDetailMsg', 'Voice messages are not supported on this device.', true);
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    var mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].filter(function (m) {
      return MediaRecorder.isTypeSupported(m);
    })[0] || '';
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start();
    _dtVoice = { rec: rec, stream: stream, chunks: chunks, sec: 0 };
    dtVoiceShowRecording_();
    _dtVoice.timer = setInterval(function () {
      if (!_dtVoice) return;
      _dtVoice.sec++;
      if (_dtVoice.sec >= DT_VOICE_MAX_SEC) { dtVoiceFinish_(true); return; }
      dtVoiceShowRecording_();
    }, 1000);
  }).catch(function () {
    dtSetMsg_('dtDetailMsg', 'Allow the microphone to send a voice message.', true);
  });
}

function dtVoiceShowRecording_() {
  var btn = document.getElementById('dtVoiceBtn');
  var cancel = document.getElementById('dtVoiceCancel');
  if (btn && _dtVoice) btn.textContent = '⏹ Stop and send (' + dtFmtSec_(_dtVoice.sec) + ')';
  if (cancel) cancel.style.display = '';
}

function dtVoiceCancel_() {
  dtVoiceFinish_(false);
}

function dtVoiceFinish_(send) {
  var v = _dtVoice;
  if (!v) return;
  _dtVoice = null;
  clearInterval(v.timer);
  v.stream.getTracks().forEach(function (tr) { tr.stop(); });
  var btn = document.getElementById('dtVoiceBtn');
  if (btn) btn.textContent = '🎤 Voice message';
  var cancel = document.getElementById('dtVoiceCancel');
  if (cancel) cancel.style.display = 'none';
  v.rec.onstop = function () {
    if (!send || !_dtDetail) return;
    if (v.sec < 1 || !v.chunks.length) {
      dtSetMsg_('dtDetailMsg', 'Voice message was too short. Hold it a little longer.', true);
      return;
    }
    var blob = new Blob(v.chunks, { type: v.rec.mimeType || 'audio/webm' });
    var dept = _dtDetail.dept;
    dtSetMsg_('dtDetailMsg', 'Sending voice…');
    empireUploadAudioAsync(blob, 'dtasks/' + dept + '/voice').then(function (url) {
      if (!url) {
        dtSetMsg_('dtDetailMsg', (typeof _lastEmpireUploadError !== 'undefined' && _lastEmpireUploadError) || 'Voice upload failed.', true);
        return;
      }
      dtDetailAction_('addDtaskVoice', { url: url, durationSec: v.sec }, 'Voice message sent.');
    });
  };
  if (v.rec.state !== 'inactive') v.rec.stop();
}

function dtAddNote_() {
  var el = document.getElementById('dtNoteText');
  var text = el ? el.value.trim() : '';
  if (!text) { dtSetMsg_('dtDetailMsg', 'Write a note first.', true); return; }
  dtDetailAction_('addDtaskNote', { text: text }, 'Note added.');
}

function dtPickPhoto_(itemId, kind) {
  _dtPhotoTarget = { itemId: itemId || '', kind: kind || 'after' };
  var useCamera = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  document.getElementById(useCamera ? 'dtPhotoCamera' : 'dtPhotoGallery').click();
}

function dtHandlePhotoFile_(ev) {
  var input = ev.target;
  var file = input.files && input.files[0];
  input.value = '';
  if (!file || !_dtPhotoTarget || !_dtDetail) return;
  var target = _dtPhotoTarget;
  _dtPhotoTarget = null;
  dtSetMsg_('dtDetailMsg', 'Uploading photo…');
  empireCompressImage(file, 'dtasks/' + _dtDetail.dept, function (url) {
    if (!url) {
      dtSetMsg_('dtDetailMsg', (typeof _lastEmpireUploadError !== 'undefined' && _lastEmpireUploadError) || 'Photo upload failed.', true);
      return;
    }
    dtDetailAction_('addDtaskPhoto', { url: url, kind: target.kind, itemId: target.itemId }, 'Photo added.');
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(function dtBoot_() {
  function run() {
    empireAuthPageBoot({ dept: DT_LOGIN_DEPT, sendToHomeLogin: false, onEnter: dtEnter_ });
    if (empireGetToken() && typeof empireAuthRefreshPerms === 'function') {
      empireAuthRefreshPerms(function () {
        if (_dtMode) {
          document.getElementById('dtToPhoneBtn').style.display = (_dtMode === 'desk' && dtCanWork_()) ? '' : 'none';
          document.getElementById('dtToDeskBtn').style.display = (_dtMode === 'phone' && dtCanSend_()) ? '' : 'none';
        }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && _dtMode && !_dtBusy) dtLoadTasks_(false);
  });
})();
