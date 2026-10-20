/* A.S.A.A.S Leave Request — fill on screen, print on A4, save to Saved Requests. */
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
        { h: 11.58, cells: [C('Line Manager', { cls: 'c' }), C(''), C('Director', { cls: 'c' }), C('')] }
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
  var _editingId = '';
  var _saved = [];
  var _saving = false;

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
  function isBlank(data) {
    return !Object.keys(data).some(function (k) { return k !== 'leaveType' && String(data[k] || '').trim(); });
  }
  function setStatus(msg, isError) {
    var el = document.getElementById('asaasLeaveStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? '#C5504F' : '';
  }
  function editingNote() {
    var r = _saved.filter(function (x) { return x.id === _editingId; })[0];
    setStatus(_editingId ? 'Editing saved request' + (r && r.employeeName ? ' — ' + r.employeeName : '') + '. Save updates it; Clear form starts a new one.' : '');
  }

  window.asaasLeaveClear_ = function () {
    if (!confirm('Clear everything on this form?')) return;
    _editingId = '';
    render();
    editingNote();
  };

  window.asaasLeaveSave_ = function () {
    if (_saving) return;
    var data = readForm();
    if (isBlank(data)) { setStatus('The form is empty — fill it before saving.', true); return; }
    _saving = true;
    setStatus('Saving…');
    fetchJSONRetry({ action: 'saveAsaasLeaveRequest', token: empireGetToken(), id: _editingId, form: data }, 1, 30000)
      .then(function (d) {
        if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Save failed.');
        _editingId = '';
        render();
        setStatus('');
        asaasLeaveShowTab_('saved');
      })
      .catch(function (e) { setStatus('Not saved: ' + (e.message || e), true); })
      .then(function () { _saving = false; });
  };

  // ---- Saved Requests ----
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
  function renderSaved() {
    var host = document.getElementById('asaasLeaveSavedList');
    if (!host) return;
    var q = String((document.getElementById('asaasLeaveSearch') || {}).value || '').trim().toLowerCase();
    var rows = _saved.filter(function (r) {
      return !q || [r.employeeName, r.leaveType, r.startDate, r.endDate, r.createdBy].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    if (!_saved.length) { host.innerHTML = empireEmptyHtml('No saved requests yet', 'Fill a Leave Request and press Save.'); return; }
    if (!rows.length) { host.innerHTML = empireEmptyHtml('No match', 'Try another name or date.'); return; }
    host.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>Name</th><th>Type of Leave</th><th>Start</th><th>End</th><th>Saved by</th><th>Saved</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.employeeName || '—') + '</td><td>' + esc(r.leaveType) + '</td><td>' + esc(r.startDate) + '</td><td>' + esc(r.endDate) +
          '</td><td>' + esc(r.updatedBy || r.createdBy) + '</td><td>' + esc(when(r.updatedAt || r.createdAt)) + '</td>' +
          '<td style="white-space:nowrap"><button data-open="' + esc(r.id) + '">Open</button> ' +
          '<button data-del="' + esc(r.id) + '" style="color:#C5504F">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function loadSaved() {
    var host = document.getElementById('asaasLeaveSavedList');
    if (host && !_saved.length) host.innerHTML = empireLoadingHtml('Loading saved requests…');
    return fetchJSONRetry({ action: 'getAsaasLeaveRequests', token: empireGetToken() }, 2, 30000)
      .then(function (d) {
        if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Could not load.');
        _saved = d.requests || [];
        renderSaved();
      })
      .catch(function (e) { if (host) host.innerHTML = empireErrorHtml('Could not load saved requests: ' + (e.message || e)); });
  }
  window.asaasLeaveRenderSaved_ = renderSaved;
  window.asaasLeaveReloadSaved_ = loadSaved;

  function openSaved(id) {
    var r = _saved.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    _editingId = id;
    render();
    fillForm(r.form);
    asaasLeaveShowTab_('form');
    editingNote();
  }
  function deleteSaved(id) {
    var r = _saved.filter(function (x) { return x.id === id; })[0];
    if (!r || !confirm('Delete the saved request for ' + (r.employeeName || 'this employee') + '?')) return;
    fetchJSONRetry({ action: 'deleteAsaasLeaveRequest', token: empireGetToken(), id: id }, 1, 30000)
      .then(function (d) {
        if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Delete failed.');
        if (_editingId === id) { _editingId = ''; editingNote(); }
        _saved = _saved.filter(function (x) { return x.id !== id; });
        renderSaved();
      })
      .catch(function (e) { alert('Not deleted: ' + (e.message || e)); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#asaasLeaveSavedList button');
    if (!b) return;
    if (b.hasAttribute('data-open')) openSaved(b.getAttribute('data-open'));
    if (b.hasAttribute('data-del')) deleteSaved(b.getAttribute('data-del'));
  });

  window.asaasLeaveShowTab_ = function (tab) {
    ['form', 'saved'].forEach(function (t) {
      var pane = document.getElementById('asaasLeavePane-' + t);
      var btn = document.getElementById('asaasLeaveTab-' + t);
      if (pane) pane.classList.toggle('active', t === tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'form') fit();
    if (tab === 'saved') loadSaved();
  };

  // An emptied box keeps a <br>; clear it so the grey date hint comes back.
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('alv-f') && !el.innerText.trim()) el.innerHTML = '';
  });

  function render() {
    var sheet = document.getElementById('asaasLeaveSheet');
    if (!sheet) return;
    sheet.innerHTML = sheetHtml();
    fit();
  }

  window.addEventListener('resize', fit);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
