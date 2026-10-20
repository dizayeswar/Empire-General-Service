/* A.S.A.A.S Leave Request — fill, save, confirm → Line Manager → Director e-signatures → Completed Requests. */
(function () {
  var TW = 56.6929; // twips per mm
  function mm(tw) { return (tw / TW).toFixed(2) + 'mm'; }
  function f(key, cls) { return '<div class="alv-f' + (cls ? ' ' + cls : '') + '" data-k="' + key + '" contenteditable="true"></div>'; }
  function date(key) {
    return '<div class="alv-f" data-k="' + key + '" contenteditable="true" data-ph="Click or tap to enter a date."></div>';
  }
  var LEAVE_TYPES = ['Annual leave', 'Sick Leave', 'Unpaid Leave', 'Bereavement Leave', 'Marriage leave', 'Other Leave'];

  // One block = label row + bordered table. Tops and row heights in mm, measured from Word's PDF.
  function block(topMm, label, labelMm, gridTw, rows, labelDropMm) {
    var width = gridTw.reduce(function (a, b) { return a + b; }, 0);
    var cols = gridTw.map(function (w) { return '<col style="width:' + mm(w) + '">'; }).join('');
    var body = rows.map(function (r) {
      return '<tr style="height:' + r.h + 'mm">' + r.cells.map(function (c) {
        return '<td' + (c.span ? ' colspan="' + c.span + '"' : '') + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + (c.html || '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="alv-block" style="top:' + topMm + 'mm;width:' + mm(width) + '">' +
      '<div class="alv-label" style="height:' + labelMm + 'mm' + (labelDropMm ? ';transform:translateY(' + labelDropMm + 'mm)' : '') + '">' + label + '</div>' +
      '<table class="alv-t" style="width:' + mm(width) + '"><colgroup>' + cols + '</colgroup>' + body + '</table></div>';
  }
  function C(html, extra) { var o = { html: html }; for (var k in extra) o[k] = extra[k]; return o; }

  function sheetHtml() {
    var typeSel = '<select class="alv-sel" data-k="leaveType">' +
      LEAVE_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select>';
    var ent = ['Annual Leave', 'Sick leave', 'Unpaid Leave', 'Bereavement', 'Marriage Leave', 'Other'];
    var entRows = [{ h: 7.43, cells: ['Type of Leave', 'Annual Balance', 'Available balance', 'Days requested', 'Remaining Balance'].map(function (t) { return C(t, { cls: 'c' }); }) }]
      .concat(ent.map(function (t, i) {
        return { h: 7.43, cells: [C(t)].concat(['annual', 'available', 'requested', 'remaining'].map(function (col) { return C(f('ent' + i + '_' + col)); })) };
      }));

    return '' +
      '<img class="alv-logo" src="assets/asaas-logo.png" alt="A.S.A.A.S">' +
      '<div class="alv-title">Leave Request</div>' +
      block(40.64, 'Employees’ Detail:', 9.56, [2396, 2644, 2520, 2429], [
        { h: 7.87, cells: [C('Name'), C(f('name')), C('Ref. No.'), C(f('refNo'))] },
        { h: 7.87, cells: [C('Code'), C(f('code')), C('Department'), C(f('department'))] },
        { h: 7.87, cells: [C('Job Title'), C(f('jobTitle')), C('Replacement'), C(f('replacement'))] }
      ]) +
      block(77.95, 'Absence Detail:', 8.49, [3420, 3060, 3510], [
        { h: 6.53, cells: [C('Start Date', { cls: 'c' }), C('End Date', { cls: 'c' }), C('Number of days out of the office', { cls: 'c' })] },
        { h: 6.53, cells: [C(date('startDate'), { cls: 'c' }), C(date('endDate'), { cls: 'c' }), C(f('days'), { cls: 'c' })] },
        { h: 6.53, cells: [C('Type of Leave'), C(typeSel, { span: 2 })] },
        { h: 10.55, cells: [C('Employee Signature'), C('', { span: 2 })] }
      ]) +
      block(120.9, 'Approvals:', 8.01, [1710, 3240, 1620, 3420], [
        { h: 11.58, cells: [C('Line Manager', { cls: 'c' }), C('<div class="alv-stamp" data-sig="line"></div>', { cls: 'sig' }), C('Director', { cls: 'c' }), C('<div class="alv-stamp" data-sig="director"></div>', { cls: 'sig' })] }
      ]) +
      block(146.57, 'Leave Entitlement Detail:', 8.78, [1637, 1983, 2173, 1901, 2260], entRows) +
      block(219.93, 'Human Resources Dept. Comment:', 8.78, [4950, 5040], [
        { h: 23.17, cells: [C(f('hrComment', 'alv-comment'), { span: 2, cls: 'top' })] },
        { h: 9.06, cells: [C('Signature'), C('Date', { cls: 'solid-l' })] }
      ], -2.4);
  }

  function fit() {
    var stage = document.getElementById('asaasLeaveStage');
    var scaleEl = document.getElementById('asaasLeaveScale');
    if (!stage || !scaleEl || !stage.offsetParent) return;
    var sheet = scaleEl.firstElementChild;
    var s = Math.min(1, stage.clientWidth / sheet.offsetWidth);
    scaleEl.style.transform = 'scale(' + s + ')';
    stage.style.height = (sheet.offsetHeight * s) + 'px';
  }
  window.asaasLeaveFit_ = fit;

  window.asaasLeavePrint_ = function () {
    if (document.activeElement) document.activeElement.blur();
    document.body.classList.add('alv-printing');
    window.print();
  };
  window.addEventListener('afterprint', function () { document.body.classList.remove('alv-printing'); });

  // ---- form data ----
  // _cur: the request open on the form ('' id = new form). editable = saved/rejected; signer turn = may confirm & sign.
  var _cur = { id: '', status: '', editable: true };
  var _all = [];
  var _signer = { role: '', hasSignature: false };
  var _busy = false;

  var STATUS_TEXT = {
    saved: 'Saved',
    pending_line: 'Waiting for Line Manager',
    pending_director: 'Waiting for Director',
    completed: 'Completed',
    rejected: 'Rejected'
  };

  function fields() { return document.querySelectorAll('#asaasLeaveSheet [data-k]'); }
  function readForm() {
    var out = {};
    fields().forEach(function (el) {
      out[el.getAttribute('data-k')] = el.tagName === 'SELECT' ? el.value : el.innerText.replace(/\n+$/, '');
    });
    return out;
  }
  function fillForm(data) {
    data = data || {};
    fields().forEach(function (el) {
      var v = data[el.getAttribute('data-k')];
      if (el.tagName === 'SELECT') { if (v) el.value = v; }
      else el.textContent = v || '';
    });
  }
  function setReadOnly(ro) {
    var sheet = document.getElementById('asaasLeaveSheet');
    if (sheet) sheet.classList.toggle('alv-ro', ro);
    fields().forEach(function (el) {
      if (el.tagName === 'SELECT') el.tabIndex = ro ? -1 : 0;
      else el.setAttribute('contenteditable', ro ? 'false' : 'true');
    });
  }
  function setStamp(box, src) {
    var el = document.querySelector('#asaasLeaveSheet [data-sig="' + box + '"]');
    if (el) el.innerHTML = src ? '<img src="' + esc(src) + '" alt="">' : '';
  }
  function isBlank(data) {
    return !Object.keys(data).some(function (k) { return k !== 'leaveType' && String(data[k] || '').trim(); });
  }
  function setStatus(msg, isError) {
    var el = document.getElementById('asaasLeaveStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? '#C5504F' : '';
  }
  function myTurn(r) {
    return !!r && ((r.status === 'pending_line' && _signer.role === 'line') ||
      (r.status === 'pending_director' && _signer.role === 'director'));
  }
  function show(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; }
  function syncToolbar() {
    var turn = myTurn(_cur);
    show('asaasLeaveSaveBtn', _cur.editable);
    show('asaasLeaveSignBtn', turn);
    show('asaasLeaveRejectBtn', turn);
    var clr = document.getElementById('asaasLeaveClearBtn');
    if (clr) clr.textContent = _cur.id ? 'New form' : 'Clear form';
  }
  function curNote() {
    var r = _cur;
    if (!r.id) return '';
    var who = r.employeeName ? ' — ' + r.employeeName : '';
    if (r.status === 'rejected') return 'Rejected by ' + (r.rejectedBy || '') + ': ' + (r.rejectReason || '') + '. Fix it, Save, then Confirm again from Saved Requests.';
    if (r.editable) return 'Editing saved request' + who + '. Save updates it.';
    if (myTurn(r)) return (STATUS_TEXT[r.status] || '') + who + '. Check the paper, then Confirm & sign or Reject.';
    return (STATUS_TEXT[r.status] || '') + who + ' — read only.';
  }

  function newForm() {
    _cur = { id: '', status: '', editable: true };
    render();
    setStatus('');
    syncToolbar();
  }
  window.asaasLeaveClear_ = function () {
    if (_cur.editable && !isBlank(readForm()) && !confirm(_cur.id ? 'Start a new empty form?' : 'Clear everything on this form?')) return;
    newForm();
  };

  function api(body, tries) {
    body.token = empireGetToken();
    return fetchJSONRetry(body, tries || 1, 30000).then(function (d) {
      if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Something went wrong.');
      return d;
    });
  }

  window.asaasLeaveSave_ = function () {
    if (_busy || !_cur.editable) return;
    var data = readForm();
    if (isBlank(data)) { setStatus('The form is empty — fill it before saving.', true); return; }
    _busy = true;
    setStatus('Saving…');
    api({ action: 'saveAsaasLeaveRequest', id: _cur.id, form: data })
      .then(function () { newForm(); asaasLeaveShowTab_('saved'); })
      .catch(function (e) { setStatus('Not saved: ' + e.message, true); })
      .then(function () { _busy = false; });
  };

  window.asaasLeaveSign_ = function () {
    if (_busy || !myTurn(_cur)) return;
    if (!_signer.hasSignature) { setStatus('Your account has no e-signature yet. Ask the admin to upload it in Admin → Users.', true); return; }
    if (!confirm('Confirm this leave request and put your e-signature on it?')) return;
    _busy = true;
    setStatus('Signing…');
    api({ action: 'signAsaasLeaveRequest', id: _cur.id })
      .then(function (d) { newForm(); asaasLeaveShowTab_(d.status === 'completed' ? 'completed' : 'sign'); })
      .catch(function (e) { setStatus('Not signed: ' + e.message, true); })
      .then(function () { _busy = false; });
  };

  window.asaasLeaveReject_ = function () {
    if (_busy || !myTurn(_cur)) return;
    var reason = prompt('Why are you rejecting this request?');
    if (reason == null) return;
    if (!reason.trim()) { setStatus('Write a reason to reject.', true); return; }
    _busy = true;
    setStatus('Rejecting…');
    api({ action: 'rejectAsaasLeaveRequest', id: _cur.id, reason: reason.trim() })
      .then(function () { newForm(); asaasLeaveShowTab_('sign'); })
      .catch(function (e) { setStatus('Not rejected: ' + e.message, true); })
      .then(function () { _busy = false; });
  };

  // ---- lists ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function find(id) { return _all.filter(function (x) { return x.id === id; })[0]; }
  function statusCell(r) {
    var t = esc(STATUS_TEXT[r.status] || r.status);
    if (r.status === 'rejected') return '<span style="color:#C5504F">' + t + '</span><br><small>' + esc(r.rejectReason) + '</small>';
    return t;
  }
  function btn(attr, id, label, color) {
    return '<button ' + attr + '="' + esc(id) + '"' + (color ? ' style="color:' + color + '"' : '') + '>' + label + '</button> ';
  }

  var LISTS = {
    saved: {
      host: 'asaasLeaveSavedList', search: 'asaasLeaveSearch',
      pick: function (r) { return r.status !== 'completed'; },
      empty: ['No saved requests yet', 'Fill a Leave Request and press Save.'],
      head: '<th>Name</th><th>Type of Leave</th><th>Start</th><th>End</th><th>Status</th><th>Saved</th><th></th>',
      row: function (r) {
        var canEdit = r.status === 'saved' || r.status === 'rejected';
        return '<td>' + esc(r.employeeName || '—') + '</td><td>' + esc(r.leaveType) + '</td><td>' + esc(r.startDate) + '</td><td>' + esc(r.endDate) +
          '</td><td>' + statusCell(r) + '</td><td>' + esc(when(r.updatedAt || r.createdAt)) + '</td><td style="white-space:nowrap">' +
          btn('data-open', r.id, 'Open') + (canEdit ? btn('data-confirm', r.id, 'Confirm', '#1a7f37') + btn('data-del', r.id, 'Delete', '#C5504F') : '') + '</td>';
      }
    },
    sign: {
      host: 'asaasLeaveSignList',
      pick: function (r) { return myTurn(r); },
      empty: ['Nothing to sign', 'Requests waiting for your e-signature show here.'],
      head: '<th>Name</th><th>Type of Leave</th><th>Start</th><th>End</th><th>Confirmed by</th><th>Line Manager</th><th></th>',
      row: function (r) {
        return '<td>' + esc(r.employeeName || '—') + '</td><td>' + esc(r.leaveType) + '</td><td>' + esc(r.startDate) + '</td><td>' + esc(r.endDate) +
          '</td><td>' + esc(r.confirmedBy) + '<br><small>' + esc(when(r.confirmedAt)) + '</small></td><td>' +
          (r.lineSignedBy ? esc(r.lineSignedBy) + '<br><small>' + esc(when(r.lineSignedAt)) + '</small>' : '—') +
          '</td><td style="white-space:nowrap">' + btn('data-open', r.id, 'Open') + '</td>';
      }
    },
    completed: {
      host: 'asaasLeaveCompletedList', search: 'asaasLeaveCompletedSearch',
      pick: function (r) { return r.status === 'completed'; },
      empty: ['No completed requests yet', 'Papers signed by the Line Manager and the Director show here.'],
      head: '<th>Name</th><th>Type of Leave</th><th>Start</th><th>End</th><th>Line Manager</th><th>Director</th><th></th>',
      row: function (r) {
        return '<td>' + esc(r.employeeName || '—') + '</td><td>' + esc(r.leaveType) + '</td><td>' + esc(r.startDate) + '</td><td>' + esc(r.endDate) +
          '</td><td>' + esc(r.lineSignedBy) + '<br><small>' + esc(when(r.lineSignedAt)) + '</small></td><td>' +
          esc(r.directorSignedBy) + '<br><small>' + esc(when(r.directorSignedAt)) + '</small></td><td style="white-space:nowrap">' +
          btn('data-open', r.id, 'Open') + '</td>';
      }
    }
  };

  function renderList(name) {
    var L = LISTS[name];
    var host = document.getElementById(L.host);
    if (!host) return;
    var mine = _all.filter(L.pick);
    var q = L.search ? String((document.getElementById(L.search) || {}).value || '').trim().toLowerCase() : '';
    var rows = mine.filter(function (r) {
      return !q || [r.employeeName, r.leaveType, r.startDate, r.endDate, r.createdBy, STATUS_TEXT[r.status]].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    if (!mine.length) { host.innerHTML = empireEmptyHtml(L.empty[0], L.empty[1]); return; }
    if (!rows.length) { host.innerHTML = empireEmptyHtml('No match', 'Try another name or date.'); return; }
    host.innerHTML = '<div style="overflow-x:auto"><table><thead><tr>' + L.head + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + L.row(r) + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function renderAll() {
    Object.keys(LISTS).forEach(renderList);
    var n = _all.filter(myTurn).length;
    show('asaasLeaveTab-sign', !!_signer.role);
    var badge = document.getElementById('asaasLeaveSignCount');
    if (badge) badge.textContent = n ? ' (' + n + ')' : '';
  }
  function loadAll(name) {
    var host = name && LISTS[name] && document.getElementById(LISTS[name].host);
    if (host && !_all.length) host.innerHTML = empireLoadingHtml('Loading…');
    return api({ action: 'getAsaasLeaveRequests' }, 2)
      .then(function (d) {
        _all = d.requests || [];
        _signer = d.signer || { role: '', hasSignature: false };
        renderAll();
      })
      .catch(function (e) { if (host) host.innerHTML = empireErrorHtml('Could not load: ' + e.message); });
  }
  window.asaasLeaveRenderList_ = renderList;
  window.asaasLeaveReload_ = function () { loadAll(); };

  function openRequest(id) {
    setStatus('Opening…');
    asaasLeaveShowTab_('form', true);
    api({ action: 'getAsaasLeaveRequest', id: id }, 2)
      .then(function (d) {
        var r = d.request;
        _cur = r;
        _cur.editable = r.status === 'saved' || r.status === 'rejected';
        render();
        fillForm(r.form);
        setStamp('line', r.lineSignature);
        setStamp('director', r.directorSignature);
        setReadOnly(!_cur.editable);
        syncToolbar();
        setStatus(curNote(), r.status === 'rejected');
      })
      .catch(function (e) { setStatus('Could not open: ' + e.message, true); });
  }
  function confirmRequest(id) {
    var r = find(id);
    if (!r || !confirm('Confirm the request for ' + (r.employeeName || 'this employee') + ' and send it to the Line Manager?\nIt can no longer be changed after this.')) return;
    api({ action: 'confirmAsaasLeaveRequest', id: id })
      .then(function () { if (_cur.id === id) newForm(); return loadAll(); })
      .catch(function (e) { alert('Not confirmed: ' + e.message); });
  }
  function deleteRequest(id) {
    var r = find(id);
    if (!r || !confirm('Delete the request for ' + (r.employeeName || 'this employee') + '?')) return;
    api({ action: 'deleteAsaasLeaveRequest', id: id })
      .then(function () {
        if (_cur.id === id) newForm();
        _all = _all.filter(function (x) { return x.id !== id; });
        renderAll();
      })
      .catch(function (e) { alert('Not deleted: ' + e.message); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.alv-list button');
    if (!b) return;
    if (b.hasAttribute('data-open')) openRequest(b.getAttribute('data-open'));
    if (b.hasAttribute('data-confirm')) confirmRequest(b.getAttribute('data-confirm'));
    if (b.hasAttribute('data-del')) deleteRequest(b.getAttribute('data-del'));
  });

  var TABS = ['form', 'saved', 'sign', 'completed'];
  window.asaasLeaveShowTab_ = function (tab, noLoad) {
    TABS.forEach(function (t) {
      var pane = document.getElementById('asaasLeavePane-' + t);
      var b = document.getElementById('asaasLeaveTab-' + t);
      if (pane) pane.classList.toggle('active', t === tab);
      if (b) b.classList.toggle('active', t === tab);
    });
    if (tab === 'form') fit();
    else if (!noLoad) loadAll(tab);
  };
  window.asaasLeaveBoot_ = function () { loadAll(); };

  // An emptied box keeps a <br>; clear it so the grey date hint comes back.
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('alv-f') && !el.innerText.trim()) el.innerHTML = '';
  });

  function render() {
    var sheet = document.getElementById('asaasLeaveSheet');
    if (!sheet) return;
    sheet.innerHTML = sheetHtml();
    sheet.classList.remove('alv-ro');
    fit();
  }

  window.addEventListener('resize', fit);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
