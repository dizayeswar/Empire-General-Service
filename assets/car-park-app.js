/* Car Park — security reports wrong parking on the phone; the portal keeps apartments, cars and warnings */
var CP_LOGIN_DEPT = 'car park';
var CP_PORTAL_KEY = 'car_park';
var CP_SECURITY_KEY = 'car_park_security';
var CP_PROJECTS = [
  { key: 'ra', short: 'RA', name: 'Royal Apartment' },
  { key: 'ww', short: 'WW', name: 'West Wing' },
  { key: 'wd', short: 'WD', name: 'West Diamond' },
  { key: 'es', short: 'ES', name: 'Empire Square' }
];
var CP_VIOLATIONS = [
  { key: 'two_spots', icon: '🅿️🅿️', label: 'Took two spots' },
  { key: 'blocking', icon: '⛔', label: 'Blocking road / entrance' }
];
var CP_WA_LABEL = {
  sent: 'Sent', pending: 'Sending…', failed: 'Failed', no_phone: 'No phone',
  no_apartment: 'Plate not found', not_configured: 'WhatsApp not set up'
};
// Meta's Utility price per delivered message to Iraq (+964), USD, rate card from 1 Oct 2026. Only an estimate; Meta Insights has the real bill.
var CP_WA_PRICE_USD = 0.0079;
// Each warning is 3 messages: English, Kurdish, Arabic.
var CP_WA_MSGS_PER_WARNING = 3;
var CP_MAX_PLATES = 5;
var CP_POLL_MS = 60000;

var _cpMode = '';
var _cpApts = [];
var _cpReports = [];
var _cpCanWrite = false;
var _cpPollTimer = null;
var _cpPh = { project: '', photoUrl: '', photoBlob: null, photoAt: '', photoBusy: false, violation: '', busy: false };
var _cpLookupTimer = null;
var _cpLookupSeq = 0;

function cpEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function cpMe_() { return String(empireGetUser() || '').trim().toLowerCase(); }
function cpIsAdmin_() { return typeof empireIsAdminRole === 'function' && empireIsAdminRole(); }
function cpCanPortal_() { return cpIsAdmin_() || empireModuleLevel(CP_PORTAL_KEY) !== 'none'; }
function cpCanSecurity_() { return cpIsAdmin_() || empireModuleLevel(CP_SECURITY_KEY) === 'write'; }
function cpPretty_(u) {
  return String(u || '').split(/[_.\s]+/).filter(Boolean).map(function (p) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
}
function cpWhen_(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  var z = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function cpOrdinal_(n) {
  var s = ['th', 'st', 'nd', 'rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function cpProjectShort_(k) {
  for (var i = 0; i < CP_PROJECTS.length; i++) if (CP_PROJECTS[i].key === k) return CP_PROJECTS[i].short;
  return String(k || '').toUpperCase();
}
function cpWarnBadge_(n) {
  if (!n) return '<span class="cp-warn cp-warn-0">No apartment</span>';
  var cls = n >= 3 ? 3 : n;
  return '<span class="cp-warn cp-warn-' + cls + '">' + cpEsc_(cpOrdinal_(n)) + ' warning</span>';
}
function cpWaBadge_(r) {
  var st = r.waStatus || 'pending';
  return '<span class="cp-wa cp-wa-' + cpEsc_(st) + '">' + (st === 'sent' ? '✓ ' : '') + cpEsc_(CP_WA_LABEL[st] || st) + '</span>';
}
function cpWaProblem_(r) { return r.waStatus !== 'sent'; }
function cpViolationLabel_(k) {
  for (var i = 0; i < CP_VIOLATIONS.length; i++) if (CP_VIOLATIONS[i].key === k) return CP_VIOLATIONS[i].label;
  return k;
}
function cpNormPlate_(s) {
  return String(s || '').replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
    .toUpperCase().replace(/[^0-9A-Z؀-ۿ]/g, '');
}
function cpSetMsg_(id, text, isError) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('dt-msg-error', !!isError);
}

function cpApi_(action, extra) {
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

function cpHandleLogin_(e) {
  empireAuthLogin(e, 'auto', { onSuccess: function () { cpEnter_(); } }).catch(function () {});
}

function cpLogout_() {
  if (_cpPollTimer) clearInterval(_cpPollTimer);
  if (_cpMode === 'phone' && typeof empireAuthWorkerLogout === 'function') {
    empireAuthWorkerLogout({ requirePassword: true, reload: true });
    return;
  }
  empireAuthLogout({ reload: true });
}

function cpEnter_() {
  document.getElementById('loginPage').classList.remove('show');
  empireAuthMarkLoginVisible(false);
  if (!cpCanPortal_() && !cpCanSecurity_()) {
    document.getElementById('loginPage').classList.add('show');
    empireAuthMarkLoginVisible(true);
    empireShowLoginMessage(document.getElementById('loginMessage'), 'This account has no Car Park access. Ask an admin to enable it.', true);
    return;
  }
  var saved = '';
  try { saved = localStorage.getItem('cp_mode_' + cpMe_()) || ''; } catch (e) {}
  var mode = cpCanPortal_() ? 'desk' : 'phone';
  if (saved === 'phone' && cpCanSecurity_()) mode = 'phone';
  if (saved === 'desk' && cpCanPortal_()) mode = 'desk';
  cpSwitchMode_(mode);
}

function cpSwitchMode_(mode) {
  _cpMode = mode;
  try { localStorage.setItem('cp_mode_' + cpMe_(), mode); } catch (e) {}
  document.getElementById('cpDeskApp').classList.toggle('show', mode === 'desk');
  document.getElementById('cpPhoneApp').classList.toggle('show', mode === 'phone');
  document.getElementById('cpToPhoneBtn').style.display = (mode === 'desk' && cpCanSecurity_()) ? '' : 'none';
  document.getElementById('cpToDeskBtn').style.display = (mode === 'phone' && cpCanPortal_()) ? '' : 'none';
  document.getElementById('cpDeskWho').textContent = 'Signed in as ' + cpPretty_(cpMe_());
  if (_cpPollTimer) clearInterval(_cpPollTimer);
  if (mode === 'desk') {
    cpFillProjectSelects_();
    cpLoadAll_(true);
    _cpPollTimer = setInterval(function () { if (!document.hidden) cpLoadReports_(false); }, CP_POLL_MS);
  } else {
    cpPhoneInit_();
    cpLoadReports_(true);
  }
}

// ---------------------------------------------------------------------------
// Desk: data
// ---------------------------------------------------------------------------

function cpFillProjectSelects_() {
  ['cpDashProject', 'cpRepProject', 'cpAptProject'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el.options.length) return;
    el.innerHTML = '<option value="">All projects</option>' + CP_PROJECTS.map(function (p) {
      return '<option value="' + p.key + '">' + p.short + ' — ' + cpEsc_(p.name) + '</option>';
    }).join('');
  });
}

function cpLoadAll_(showLoading) {
  if (showLoading && !_cpApts.length) {
    ['cpDash', 'cpReportList', 'cpAptList'].forEach(function (id) { document.getElementById(id).innerHTML = empireLoadingHtml(); });
  }
  return Promise.all([cpApi_('getCarparkApartments'), cpApi_('getCarparkReports')]).then(function (res) {
    _cpApts = res[0].apartments || [];
    _cpCanWrite = !!res[0].canWrite;
    _cpReports = res[1].reports || [];
    document.getElementById('cpImportBtn').style.display = _cpCanWrite ? '' : 'none';
    document.getElementById('cpTabBin').style.display = cpIsAdmin_() ? '' : 'none';
    cpRenderDesk_();
  }).catch(function (err) {
    ['cpDash', 'cpReportList', 'cpAptList'].forEach(function (id) { document.getElementById(id).innerHTML = empireErrorHtml(err.message); });
  });
}

function cpLoadReports_(showLoading) {
  var host = _cpMode === 'desk' ? null : document.getElementById('cpPhList');
  if (host && showLoading) host.innerHTML = empireLoadingHtml();
  return cpApi_('getCarparkReports').then(function (d) {
    _cpReports = d.reports || [];
    if (_cpMode === 'desk') cpRenderDesk_();
    else cpRenderPhoneList_();
  }).catch(function (err) {
    if (host && showLoading) {
      host.innerHTML = cpIsNetErr_(err)
        ? empireEmptyHtml('📵 No internet', 'Your recent reports will show when you are connected.')
        : empireErrorHtml(err.message);
    }
  });
}

function cpRenderDesk_() {
  var problems = _cpReports.filter(cpWaProblem_).length;
  var b = document.getElementById('cpProblemCount');
  b.textContent = String(problems);
  b.style.display = problems ? '' : 'none';
  cpRenderDash_();
  cpRenderReports_();
  cpRenderApts_();
}

function cpDeskTab_(tab) {
  [['dash', 'cpTabDash', 'cpPaneDash'], ['reports', 'cpTabReports', 'cpPaneReports'], ['apts', 'cpTabApts', 'cpPaneApts'], ['bin', 'cpTabBin', 'cpPaneBin']].forEach(function (t) {
    document.getElementById(t[1]).classList.toggle('active', t[0] === tab);
    document.getElementById(t[2]).classList.toggle('active', t[0] === tab);
  });
  if (tab === 'bin') cpLoadBin_(true);
}

// ---------------------------------------------------------------------------
// Desk: recycle bin (deleted reports, admins only)
// ---------------------------------------------------------------------------

var _cpBin = [];

function cpLoadBin_(showLoading) {
  var host = document.getElementById('cpBinList');
  if (showLoading) host.innerHTML = empireLoadingHtml();
  return cpApi_('getDeletedCarparkReports').then(function (d) {
    _cpBin = d.reports || [];
    cpRenderBin_();
  }).catch(function (err) { host.innerHTML = empireErrorHtml(err.message); });
}

function cpRenderBin_() {
  var q = document.getElementById('cpBinSearch').value.trim().toLowerCase();
  var qPlate = cpNormPlate_(q);
  var rows = _cpBin.filter(function (r) {
    if (!q) return true;
    if (qPlate && cpNormPlate_(r.plate).indexOf(qPlate) !== -1) return true;
    return [r.apartmentCode, r.deletedBy, cpPretty_(r.deletedBy), r.reportedBy, cpPretty_(r.reportedBy), r.violationLabel, '#' + r.num].join(' ').toLowerCase().indexOf(q) !== -1;
  });
  var host = document.getElementById('cpBinList');
  if (!rows.length) {
    host.innerHTML = empireEmptyHtml(_cpBin.length ? 'No deleted reports match' : 'Recycle bin is empty', _cpBin.length ? 'Change the search.' : 'Deleted reports will show here.');
    return;
  }
  var h = '<div class="dt-table-wrap"><table><thead><tr><th>#</th><th>Photo</th><th>Reported</th><th>Plate</th><th>Apartment</th><th>What</th><th>Warning</th><th>Deleted</th><th></th></tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr>' +
      '<td><strong>' + r.num + '</strong></td>' +
      '<td>' + (r.photoUrl ? '<a href="' + cpEsc_(r.photoUrl) + '" target="_blank" rel="noopener"><img class="cp-thumb" src="' + cpEsc_(r.photoUrl) + '" alt="" loading="lazy"></a>' : '') + '</td>' +
      '<td>' + cpEsc_(cpWhen_(r.createdAt)) + '<div class="dt-sub">' + cpEsc_(cpPretty_(r.reportedBy)) + '</div></td>' +
      '<td><span class="cp-plate">' + cpEsc_(r.plate) + '</span></td>' +
      '<td>' + (r.apartmentCode ? '<strong>' + cpEsc_(r.apartmentCode) + '</strong>' : '<span class="dt-sub">' + cpProjectShort_(r.project) + ' · not found</span>') + '</td>' +
      '<td>' + cpEsc_(r.violationLabel) + '</td>' +
      '<td>' + cpWarnBadge_(r.warningNo) + '</td>' +
      '<td>' + cpEsc_(cpWhen_(r.deletedAt)) + '<div class="dt-sub">' + cpEsc_(cpPretty_(r.deletedBy) || '—') + '</div></td>' +
      '<td><button type="button" class="dt-primary" onclick="cpRestoreReport_(\'' + cpEsc_(r.id) + '\', this)">Restore</button></td></tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}

function cpRestoreReport_(id, btn) {
  if (!confirm('Restore this report? It will count as a warning again. WhatsApp is not sent again.')) return;
  if (btn) btn.disabled = true;
  cpSetMsg_('cpBinMsg', 'Restoring…');
  cpApi_('restoreCarparkReport', { id: id }).then(function (d) {
    cpSetMsg_('cpBinMsg', 'Report #' + ((d.report && d.report.num) || '') + ' restored.');
    _cpBin = _cpBin.filter(function (r) { return r.id !== id; });
    cpRenderBin_();
    cpLoadAll_(false);
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    cpSetMsg_('cpBinMsg', err.message, true);
  });
}

// ---------------------------------------------------------------------------
// Desk: dashboard
// ---------------------------------------------------------------------------

function cpRangeStart_(range) {
  var now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === '7' || range === '30') return new Date(now.getTime() - Number(range) * 86400000);
  return null;
}

function cpRenderDash_() {
  var range = document.getElementById('cpDashRange').value;
  var proj = document.getElementById('cpDashProject').value;
  var start = cpRangeStart_(range);
  var rows = _cpReports.filter(function (r) {
    if (proj && r.project !== proj) return false;
    return !start || new Date(r.createdAt) >= start;
  });
  var c = { total: rows.length, w1: 0, w2: 0, w3: 0, none: 0, sent: 0, problem: 0 };
  var byProject = {};
  var byViolation = {};
  rows.forEach(function (r) {
    if (!r.warningNo) c.none++;
    else if (r.warningNo === 1) c.w1++;
    else if (r.warningNo === 2) c.w2++;
    else c.w3++;
    if (r.waStatus === 'sent') c.sent++; else c.problem++;
    var p = byProject[r.project] || (byProject[r.project] = { w1: 0, w2: 0, w3: 0, none: 0, total: 0 });
    p.total++;
    if (!r.warningNo) p.none++; else if (r.warningNo === 1) p.w1++; else if (r.warningNo === 2) p.w2++; else p.w3++;
    byViolation[r.violation] = (byViolation[r.violation] || 0) + 1;
  });

  var stat = function (v, label, cls, onclick) {
    return '<div class="stat-box cp-stat ' + (cls || '') + '"' + (onclick ? ' onclick="' + onclick + '" style="cursor:pointer"' : '') + '>' +
      '<div class="stat-value">' + v + '</div><div class="stat-label">' + cpEsc_(label) + '</div></div>';
  };
  var h = '<div class="stats">' +
    stat(c.total, 'Reports', '') +
    stat(c.w1, '1st warnings', 'cp-stat-1', "cpJumpReports_('1')") +
    stat(c.w2, '2nd warnings', 'cp-stat-2', "cpJumpReports_('2')") +
    stat(c.w3, '3rd+ warnings', 'cp-stat-3', "cpJumpReports_('3')") +
    stat(c.sent, 'WhatsApp sent', 'cp-stat-ok') +
    stat(c.problem, 'Not sent', c.problem ? 'cp-stat-bad' : '', "cpJumpReports_('problem')") +
    '</div>';

  // WhatsApp messages & cost: admins only.
  if (cpIsAdmin_()) {
    // WhatsApp messages counted by the day they were sent (a resend counts on its own day).
    var waSentSince = function (from) {
      return _cpReports.filter(function (r) {
        if (r.waStatus !== 'sent' || !r.waSentAt) return false;
        if (proj && r.project !== proj) return false;
        return !from || new Date(r.waSentAt) >= from;
      }).length;
    };
    var waCost = function (n) { var usd = n * CP_WA_MSGS_PER_WARNING * CP_WA_PRICE_USD; return '$' + usd.toFixed(usd && usd < 1 ? 3 : 2); };
    var waToday = waSentSince(cpRangeStart_('today'));
    var waMonth = waSentSince(cpRangeStart_('month'));
    var waPeriod = waSentSince(start);
    var periodLabel = document.getElementById('cpDashRange').selectedOptions[0].textContent;
    h += '<h3>WhatsApp messages &amp; cost</h3><div class="stats">' +
      stat(waToday, 'Sent today · ' + waCost(waToday), 'cp-stat-ok') +
      stat(waMonth, 'Sent this month · ' + waCost(waMonth), 'cp-stat-ok') +
      (range === 'today' || range === 'month' ? '' : stat(waPeriod, 'Sent · ' + periodLabel + ' · ' + waCost(waPeriod), 'cp-stat-ok')) +
      '</div><p class="dt-hint">Counts are warnings. Each warning is ' + CP_WA_MSGS_PER_WARNING + ' messages (English, Kurdish, Arabic), estimated at $' + CP_WA_PRICE_USD + ' each (Meta, Iraq, Utility). The real bill is in WhatsApp Manager → Insights → Message pricing, about a day later. Deleted reports are not counted here.</p>';
  }

  h += '<h3>By project</h3><div class="dt-table-wrap"><table><thead><tr><th>Project</th><th>1st</th><th>2nd</th><th>3rd+</th><th>Plate not found</th><th>Total</th></tr></thead><tbody>';
  CP_PROJECTS.forEach(function (p) {
    if (proj && p.key !== proj) return;
    var x = byProject[p.key] || { w1: 0, w2: 0, w3: 0, none: 0, total: 0 };
    h += '<tr><td><strong>' + p.short + '</strong> <span class="dt-sub">' + cpEsc_(p.name) + '</span></td><td>' + x.w1 + '</td><td>' + x.w2 + '</td><td>' + x.w3 + '</td><td>' + x.none + '</td><td><strong>' + x.total + '</strong></td></tr>';
  });
  h += '</tbody></table></div>';

  h += '<h3>By type</h3><div class="stats">' + CP_VIOLATIONS.map(function (v) {
    return stat(byViolation[v.key] || 0, v.label, '');
  }).join('') + '</div>';

  // Apartments at each warning level right now (all-time count, not just this period).
  var level = { 1: 0, 2: 0, 3: 0 };
  var worst = [];
  _cpApts.forEach(function (a) {
    if (proj && a.project !== proj) return;
    if (!a.warnings) return;
    level[Math.min(a.warnings, 3)]++;
    worst.push(a);
  });
  h += '<h3>Apartments by warning level (all time)</h3><div class="stats">' +
    stat(level[1], 'On 1st warning', 'cp-stat-1') + stat(level[2], 'On 2nd warning', 'cp-stat-2') + stat(level[3], 'On 3rd+ warning', 'cp-stat-3') + '</div>';
  worst.sort(function (a, b) { return b.warnings - a.warnings || String(b.lastWarningAt).localeCompare(String(a.lastWarningAt)); });
  if (worst.length) {
    h += '<h3>Most warned apartments</h3><div class="dt-table-wrap"><table><thead><tr><th>Apartment</th><th>Warnings</th><th>Last</th><th>Phone</th><th>Cars</th></tr></thead><tbody>';
    worst.slice(0, 15).forEach(function (a) {
      h += '<tr class="issue-row" onclick="cpOpenApt_(\'' + cpEsc_(a.code) + '\')"><td><strong>' + cpEsc_(a.code) + '</strong></td><td>' + cpWarnBadge_(a.warnings) + '</td><td>' + cpEsc_(cpWhen_(a.lastWarningAt)) + '</td><td>' + cpEsc_(a.phone || '—') + '</td><td>' + cpEsc_(a.plates.join(', ') || '—') + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  document.getElementById('cpDash').innerHTML = h;
}

function cpJumpReports_(filter) {
  document.getElementById('cpRepProject').value = document.getElementById('cpDashProject').value;
  document.getElementById('cpRepWarn').value = filter === 'problem' ? '' : filter;
  document.getElementById('cpRepWa').value = filter === 'problem' ? 'problem' : '';
  cpDeskTab_('reports');
  cpRenderReports_();
}

// ---------------------------------------------------------------------------
// Desk: reports
// ---------------------------------------------------------------------------

function cpRenderReports_() {
  var proj = document.getElementById('cpRepProject').value;
  var warn = document.getElementById('cpRepWarn').value;
  var wa = document.getElementById('cpRepWa').value;
  var q = document.getElementById('cpRepSearch').value.trim().toLowerCase();
  var qPlate = cpNormPlate_(q);
  var rows = _cpReports.filter(function (r) {
    if (proj && r.project !== proj) return false;
    if (warn === '0' && r.warningNo) return false;
    if (warn === '1' && r.warningNo !== 1) return false;
    if (warn === '2' && r.warningNo !== 2) return false;
    if (warn === '3' && r.warningNo < 3) return false;
    if (wa === 'sent' && r.waStatus !== 'sent') return false;
    if (wa === 'problem' && !cpWaProblem_(r)) return false;
    if (!q) return true;
    if (qPlate && cpNormPlate_(r.plate).indexOf(qPlate) !== -1) return true;
    return [r.apartmentCode, r.reportedBy, cpPretty_(r.reportedBy), r.violationLabel, '#' + r.num].join(' ').toLowerCase().indexOf(q) !== -1;
  });
  var host = document.getElementById('cpReportList');
  if (!rows.length) {
    host.innerHTML = empireEmptyHtml('No reports match', _cpReports.length ? 'Change the filters.' : 'Reports from security will show here.');
    return;
  }
  var h = '<div class="dt-table-wrap"><table><thead><tr><th>#</th><th>Photo</th><th>When</th><th>Plate</th><th>Apartment</th><th>What</th><th>Warning</th><th>WhatsApp</th><th>Security</th></tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr class="issue-row" onclick="cpOpenReport_(\'' + cpEsc_(r.id) + '\')">' +
      '<td><strong>' + r.num + '</strong></td>' +
      '<td>' + (r.photoUrl ? '<img class="cp-thumb" src="' + cpEsc_(r.photoUrl) + '" alt="" loading="lazy">' : '') + '</td>' +
      '<td>' + cpEsc_(cpWhen_(r.createdAt)) + '</td>' +
      '<td><span class="cp-plate">' + cpEsc_(r.plate) + '</span></td>' +
      '<td>' + (r.apartmentCode ? '<strong>' + cpEsc_(r.apartmentCode) + '</strong>' : '<span class="dt-sub">' + cpProjectShort_(r.project) + ' · not found</span>') + '</td>' +
      '<td>' + cpEsc_(r.violationLabel) + '</td>' +
      '<td>' + cpWarnBadge_(r.warningNo) + '</td>' +
      '<td>' + cpWaBadge_(r) + '</td>' +
      '<td>' + cpEsc_(cpPretty_(r.reportedBy)) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}

function cpFindReport_(id) {
  for (var i = 0; i < _cpReports.length; i++) if (_cpReports[i].id === id) return _cpReports[i];
  return null;
}
function cpFindApt_(code) {
  for (var i = 0; i < _cpApts.length; i++) if (_cpApts[i].code === code) return _cpApts[i];
  return null;
}

function cpOpenModal_(html) {
  document.getElementById('cpModalBody').innerHTML = html;
  document.getElementById('cpModal').classList.add('show');
}
function cpCloseModal_() { document.getElementById('cpModal').classList.remove('show'); }
function cpBigImg_(src) {
  document.getElementById('cpImgBig').src = src;
  document.getElementById('cpImgModal').classList.add('show');
}

function cpOpenReport_(id) {
  var r = cpFindReport_(id);
  if (!r) return;
  var apt = r.apartmentCode ? cpFindApt_(r.apartmentCode) : null;
  var h = '<h2>Report #' + r.num + '</h2>';
  if (r.photoUrl) h += '<img class="cp-detail-photo" src="' + cpEsc_(r.photoUrl) + '" alt="" onclick="cpBigImg_(this.src)">';
  h += '<div class="cp-kv">' +
    '<div><span>Plate</span><strong class="cp-plate">' + cpEsc_(r.plate) + '</strong></div>' +
    '<div><span>Project</span><strong>' + cpProjectShort_(r.project) + '</strong></div>' +
    '<div><span>Apartment</span><strong>' + cpEsc_(r.apartmentCode || 'Not found') + '</strong></div>' +
    '<div><span>What</span><strong>' + cpEsc_(r.violationLabel) + '</strong></div>' +
    '<div><span>Warning</span>' + cpWarnBadge_(r.warningNo) + '</div>' +
    '<div><span>WhatsApp</span>' + cpWaBadge_(r) + '</div>' +
    '<div><span>Phone</span><strong>' + cpEsc_(apt ? (apt.phone || 'none') : '—') + '</strong></div>' +
    '<div><span>Reported</span><strong>' + cpEsc_(cpWhen_(r.createdAt)) + ' · ' + cpEsc_(cpPretty_(r.reportedBy)) + '</strong></div>' +
    (r.waSentAt ? '<div><span>Sent at</span><strong>' + cpEsc_(cpWhen_(r.waSentAt)) + '</strong></div>' : '') +
    '</div>';
  if (r.waError) h += '<p class="cp-error-box">' + cpEsc_(r.waError) + '</p>';
  if (r.waStatus === 'no_phone') h += '<p class="dt-hint">This apartment has no phone number. Add it under Apartments &amp; cars, then press Send WhatsApp.</p>';

  if (_cpCanWrite) {
    if (!r.apartmentCode) {
      h += '<h3>Link to an apartment</h3><p class="dt-hint">The plate is not saved on any apartment. Pick the apartment; its warning count goes up and the WhatsApp is sent.</p>' +
        '<div class="form-row"><div class="form-group"><input type="text" id="cpLinkCode" list="cpAptCodes" placeholder="e.g. ' + cpProjectShort_(r.project) + '-A1-G-1" autocomplete="off"></div></div>' +
        '<datalist id="cpAptCodes">' + _cpApts.filter(function (a) { return a.project === r.project; }).map(function (a) { return '<option value="' + cpEsc_(a.code) + '">'; }).join('') + '</datalist>' +
        '<label class="dt-refund-check"><input type="checkbox" id="cpLinkSave" checked> Also save plate ' + cpEsc_(r.plate) + ' on that apartment</label>' +
        '<div class="dt-actions"><button type="button" class="dt-primary" onclick="cpLinkReport_(\'' + cpEsc_(r.id) + '\')">Link and send WhatsApp</button></div>';
    } else {
      h += '<div class="dt-actions">' +
        (r.waStatus !== 'sent'
          ? '<button type="button" class="dt-primary" onclick="cpResend_(\'' + cpEsc_(r.id) + '\', false)">Send WhatsApp</button>'
          : '<button type="button" onclick="cpResend_(\'' + cpEsc_(r.id) + '\', true)">Send WhatsApp again</button>') +
        '<button type="button" onclick="cpOpenApt_(\'' + cpEsc_(r.apartmentCode) + '\')">Open apartment</button></div>';
    }
    h += '<div class="dt-actions"><button type="button" class="dt-danger" onclick="cpDeleteReport_(\'' + cpEsc_(r.id) + '\')">Delete report</button></div>';
  }
  h += '<p id="cpModalMsg" class="dt-msg" aria-live="polite"></p>';
  cpOpenModal_(h);
}

function cpReplaceReport_(rep) {
  for (var i = 0; i < _cpReports.length; i++) if (_cpReports[i].id === rep.id) _cpReports[i] = rep;
}

function cpReportAction_(action, extra, okMsg) {
  cpSetMsg_('cpModalMsg', 'Working…');
  return cpApi_(action, extra).then(function (d) {
    if (d.report) cpReplaceReport_(d.report);
    return cpLoadAll_(false).then(function () {
      if (d.report) cpOpenReport_(d.report.id);
      var r = d.report;
      if (r && r.waStatus !== 'sent') cpSetMsg_('cpModalMsg', 'Saved, but WhatsApp: ' + (CP_WA_LABEL[r.waStatus] || r.waStatus), true);
      else cpSetMsg_('cpModalMsg', okMsg);
    });
  }).catch(function (err) { cpSetMsg_('cpModalMsg', err.message, true); });
}

function cpResend_(id, force) {
  if (force && !confirm('This warning was already sent. Send it again?')) return;
  cpReportAction_('resendCarparkWhatsApp', { id: id, force: !!force }, 'WhatsApp sent.');
}

function cpLinkReport_(id) {
  var code = document.getElementById('cpLinkCode').value.trim().toUpperCase();
  if (!code) { cpSetMsg_('cpModalMsg', 'Write the apartment.', true); return; }
  cpReportAction_('linkCarparkReport', { id: id, apartmentCode: code, savePlate: document.getElementById('cpLinkSave').checked }, 'Linked and WhatsApp sent.');
}

function cpDeleteReport_(id) {
  if (!confirm('Delete this report? It will no longer count as a warning. You can restore it from the Recycle bin.')) return;
  cpSetMsg_('cpModalMsg', 'Deleting…');
  cpApi_('deleteCarparkReport', { id: id }).then(function () {
    cpCloseModal_();
    cpLoadAll_(false);
  }).catch(function (err) { cpSetMsg_('cpModalMsg', err.message, true); });
}

// ---------------------------------------------------------------------------
// Desk: apartments
// ---------------------------------------------------------------------------

function cpRenderApts_() {
  var proj = document.getElementById('cpAptProject').value;
  var show = document.getElementById('cpAptShow').value;
  var q = document.getElementById('cpAptSearch').value.trim().toLowerCase();
  var qPlate = cpNormPlate_(q);
  var qDigits = q.replace(/\D/g, '');
  var rows = _cpApts.filter(function (a) {
    if (proj && a.project !== proj) return false;
    if (show === 'phone' && !a.phone) return false;
    if (show === 'nophone' && a.phone) return false;
    if (show === 'cars' && !a.plates.length) return false;
    if (show === 'nocars' && a.plates.length) return false;
    if (show === 'warned' && !a.warnings) return false;
    if (!q) return true;
    if (String(a.code).toLowerCase().indexOf(q) !== -1) return true;
    if (String(a.ownerName).toLowerCase().indexOf(q) !== -1) return true;
    if (qDigits.length >= 4 && String(a.phone).replace(/\D/g, '').indexOf(qDigits) !== -1) return true;
    return !!qPlate && a.plates.some(function (p) { return cpNormPlate_(p).indexOf(qPlate) !== -1; });
  });
  var withPhone = _cpApts.filter(function (a) { return a.phone; }).length;
  var withCars = _cpApts.filter(function (a) { return a.plates.length; }).length;
  var host = document.getElementById('cpAptList');
  var h = '<p class="dt-hint">' + _cpApts.length + ' apartments · ' + withPhone + ' with phone · ' + withCars + ' with cars · showing ' + rows.length + '</p>';
  if (!rows.length) { host.innerHTML = h + empireEmptyHtml('No apartments match', 'Change the filters.'); return; }
  var limit = 300;
  h += '<div class="dt-table-wrap"><table><thead><tr><th>Apartment</th><th>Phone</th><th>Owner</th><th>Cars</th><th>Warnings</th></tr></thead><tbody>';
  rows.slice(0, limit).forEach(function (a) {
    h += '<tr class="issue-row" onclick="cpOpenApt_(\'' + cpEsc_(a.code) + '\')">' +
      '<td><strong>' + cpEsc_(a.code) + '</strong></td>' +
      '<td>' + (a.phone ? cpEsc_(a.phone) : '<span class="dt-sub">—</span>') + '</td>' +
      '<td>' + cpEsc_(a.ownerName || '') + '</td>' +
      '<td>' + (a.plates.length ? a.plates.map(function (p) { return '<span class="cp-plate">' + cpEsc_(p) + '</span>'; }).join(' ') : '<span class="dt-sub">—</span>') + '</td>' +
      '<td>' + (a.warnings ? cpWarnBadge_(a.warnings) : '') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  if (rows.length > limit) h += '<p class="dt-hint">Showing the first ' + limit + '. Search or filter to find others.</p>';
  host.innerHTML = h;
}

function cpOpenApt_(code) {
  var a = cpFindApt_(code);
  if (!a) return;
  var ro = _cpCanWrite ? '' : ' disabled';
  var plates = a.plates.slice();
  while (plates.length < 3) plates.push('');
  var h = '<h2>' + cpEsc_(a.code) + '</h2>' +
    '<div class="form-row"><div class="form-group"><label for="cpAptPhone">WhatsApp phone</label><input type="tel" id="cpAptPhone" value="' + cpEsc_(a.phone) + '" placeholder="0750 123 4567"' + ro + '></div>' +
    '<div class="form-group"><label for="cpAptOwner">Owner / tenant name</label><input type="text" id="cpAptOwner" value="' + cpEsc_(a.ownerName) + '"' + ro + '></div></div>' +
    '<label>Car plates</label><div id="cpAptPlates" class="cp-plates-edit">' +
    plates.map(function (p, i) { return '<input type="text" class="cp-plate-edit" value="' + cpEsc_(p) + '" placeholder="Car ' + (i + 1) + '" autocapitalize="characters"' + ro + '>'; }).join('') +
    '</div>' +
    (_cpCanWrite ? '<button type="button" class="cp-link-btn" onclick="cpAddPlateInput_()">+ Add another car</button>' : '') +
    '<div class="form-group"><label for="cpAptNote">Note</label><textarea id="cpAptNote" rows="2"' + ro + '>' + cpEsc_(a.note) + '</textarea></div>';
  if (_cpCanWrite) h += '<div class="dt-actions"><button type="button" class="dt-primary" onclick="cpSaveApt_(\'' + cpEsc_(a.code) + '\')">Save</button></div>';
  h += '<p id="cpModalMsg" class="dt-msg" aria-live="polite"></p>';

  var reps = _cpReports.filter(function (r) { return r.apartmentCode === a.code; });
  h += '<h3>Warnings (' + a.warnings + ')</h3>';
  if (!reps.length) h += '<p class="dt-hint">No reports for this apartment.</p>';
  else {
    h += '<div class="dt-table-wrap"><table><tbody>' + reps.map(function (r) {
      return '<tr class="issue-row" onclick="cpOpenReport_(\'' + cpEsc_(r.id) + '\')"><td>' + cpEsc_(cpWhen_(r.createdAt)) + '</td><td><span class="cp-plate">' + cpEsc_(r.plate) + '</span></td><td>' + cpEsc_(r.violationLabel) + '</td><td>' + cpWarnBadge_(r.warningNo) + '</td><td>' + cpWaBadge_(r) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  cpOpenModal_(h);
}

function cpAddPlateInput_() {
  var box = document.getElementById('cpAptPlates');
  if (box.children.length >= CP_MAX_PLATES) { cpSetMsg_('cpModalMsg', 'At most ' + CP_MAX_PLATES + ' cars per apartment.', true); return; }
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'cp-plate-edit';
  inp.placeholder = 'Car ' + (box.children.length + 1);
  inp.setAttribute('autocapitalize', 'characters');
  box.appendChild(inp);
  inp.focus();
}

function cpSaveApt_(code) {
  var plates = Array.prototype.map.call(document.querySelectorAll('#cpAptPlates .cp-plate-edit'), function (i) { return i.value.trim(); })
    .filter(Boolean);
  cpSetMsg_('cpModalMsg', 'Saving…');
  cpApi_('saveCarparkApartment', {
    code: code,
    phone: document.getElementById('cpAptPhone').value.trim(),
    ownerName: document.getElementById('cpAptOwner').value.trim(),
    note: document.getElementById('cpAptNote').value.trim(),
    plates: plates
  }).then(function () {
    return cpLoadAll_(false).then(function () {
      cpOpenApt_(code);
      cpSetMsg_('cpModalMsg', 'Saved.');
    });
  }).catch(function (err) { cpSetMsg_('cpModalMsg', err.message, true); });
}

// ---------------------------------------------------------------------------
// Desk: Excel
// ---------------------------------------------------------------------------

var _cpXlsxPromise = null;
function cpLoadXlsx_() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_cpXlsxPromise) return _cpXlsxPromise;
  _cpXlsxPromise = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = function () { resolve(window.XLSX); };
    s.onerror = function () { _cpXlsxPromise = null; reject(new Error('Could not load Excel library. Check your internet connection.')); };
    document.head.appendChild(s);
  });
  return _cpXlsxPromise;
}

function cpExportApts_() {
  cpLoadXlsx_().then(function (XLSX) {
    var proj = document.getElementById('cpAptProject').value;
    var maxCars = 3;
    _cpApts.forEach(function (a) { maxCars = Math.max(maxCars, a.plates.length); });
    var head = ['Apartment', 'Project', 'Phone', 'Owner'];
    for (var i = 1; i <= maxCars; i++) head.push('Car ' + i);
    head.push('Warnings');
    var aoa = [head];
    _cpApts.forEach(function (a) {
      if (proj && a.project !== proj) return;
      var row = [a.code, cpProjectShort_(a.project), a.phone, a.ownerName];
      for (var i = 0; i < maxCars; i++) row.push(a.plates[i] || '');
      row.push(a.warnings);
      aoa.push(row);
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Apartments');
    XLSX.writeFile(wb, 'Car-Park-Apartments' + (proj ? '-' + cpProjectShort_(proj) : '') + '.xlsx');
  }).catch(function (err) { cpSetMsg_('cpAptMsg', err.message, true); });
}

function cpImportFile_(ev) {
  var file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  cpSetMsg_('cpAptMsg', 'Reading ' + file.name + '…');
  cpLoadXlsx_().then(function (XLSX) {
    return file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      var rows = [];
      json.forEach(function (r) {
        var out = { code: '', phone: '', ownerName: '', plates: [] };
        Object.keys(r).forEach(function (k) {
          var key = k.trim().toLowerCase();
          var v = String(r[k] == null ? '' : r[k]).trim();
          if (!v) return;
          if (key === 'apartment' || key === 'code' || key === 'unit' || key === 'property id') out.code = v.toUpperCase();
          else if (key === 'phone' || key === 'whatsapp' || key === 'mobile') out.phone = v;
          else if (key === 'owner' || key === 'name' || key === 'tenant') out.ownerName = v;
          else if (/^(car|plate)\s*\d*$/.test(key)) out.plates.push(v);
        });
        if (out.code) rows.push(out);
      });
      if (!rows.length) throw new Error('No rows found. The first row must have an "Apartment" column.');
      if (!confirm('Import ' + rows.length + ' apartments from ' + file.name + '?')) { cpSetMsg_('cpAptMsg', ''); return null; }
      cpSetMsg_('cpAptMsg', 'Importing ' + rows.length + ' rows…');
      return cpApi_('importCarparkApartments', { rows: rows });
    });
  }).then(function (d) {
    if (!d) return;
    var msg = 'Updated ' + d.updated + ' apartments, added ' + d.platesAdded + ' cars.';
    cpSetMsg_('cpAptMsg', msg + (d.problems && d.problems.length ? ' ' + d.problems.length + ' problems — see list.' : ''), !!(d.problems && d.problems.length));
    if (d.problems && d.problems.length) {
      cpOpenModal_('<h2>Import finished</h2><p>' + cpEsc_(msg) + '</p><h3>Problems</h3><ul class="cp-problems">' +
        d.problems.map(function (p) { return '<li>' + cpEsc_(p) + '</li>'; }).join('') + '</ul>');
    }
    return cpLoadAll_(false);
  }).catch(function (err) { cpSetMsg_('cpAptMsg', err.message, true); });
}

// ---------------------------------------------------------------------------
// Phone: security
// ---------------------------------------------------------------------------

function cpPhoneInit_() {
  try { _cpPh.project = localStorage.getItem('cp_project_' + cpMe_()) || ''; } catch (e) {}
  document.getElementById('cpPhProjects').innerHTML = CP_PROJECTS.map(function (p) {
    return '<button type="button" class="cp-opt" data-project="' + p.key + '" onclick="cpPickProject_(\'' + p.key + '\')"><strong>' + p.short + '</strong><span>' + cpEsc_(p.name) + '</span></button>';
  }).join('');
  document.getElementById('cpPhViolations').innerHTML = CP_VIOLATIONS.map(function (v) {
    return '<button type="button" class="cp-opt" data-violation="' + v.key + '" onclick="cpPickViolation_(\'' + v.key + '\')"><strong>' + v.icon + '</strong><span>' + cpEsc_(v.label) + '</span></button>';
  }).join('');
  cpPhoneSync_();
  cpPendingLoad_();
}

function cpPickProject_(k) {
  _cpPh.project = k;
  try { localStorage.setItem('cp_project_' + cpMe_(), k); } catch (e) {}
  cpPhoneSync_();
}

function cpPickViolation_(k) {
  _cpPh.violation = k;
  cpPhoneSync_();
}

function cpPhoneSync_() {
  Array.prototype.forEach.call(document.querySelectorAll('#cpPhProjects .cp-opt'), function (b) {
    b.classList.toggle('on', b.getAttribute('data-project') === _cpPh.project);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#cpPhViolations .cp-opt'), function (b) {
    b.classList.toggle('on', b.getAttribute('data-violation') === _cpPh.violation);
  });
  var plate = cpNormPlate_(document.getElementById('cpPhPlate').value);
  var ready = _cpPh.project && (_cpPh.photoUrl || _cpPh.photoBlob) && !_cpPh.photoBusy && plate.length >= 2 && _cpPh.violation && !_cpPh.busy;
  document.getElementById('cpPhSend').disabled = !ready;
}

function cpPickPhoto_() {
  var useCamera = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  document.getElementById(useCamera ? 'cpPhotoCamera' : 'cpPhotoGallery').click();
}

function cpHandlePhotoFile_(ev) {
  var input = ev.target;
  var file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  var prev = document.getElementById('cpPhPhotoPreview');
  try { prev.src = URL.createObjectURL(file); prev.style.display = ''; } catch (e) {}
  document.getElementById('cpPhPhotoBtn').style.display = 'none';
  _cpPh.photoUrl = '';
  _cpPh.photoBlob = null;
  _cpPh.photoAt = new Date().toISOString();
  _cpPh.photoBusy = true;
  var seq = ++_cpPhotoSeq;
  cpPhoneSync_();
  cpSetMsg_('cpPhPhotoMsg', 'Preparing photo…');
  cpShrinkImage_(file).then(function (blob) {
    if (seq !== _cpPhotoSeq) return;
    _cpPh.photoBlob = blob;
    if (!cpOnline_()) {
      _cpPh.photoBusy = false;
      cpSetMsg_('cpPhPhotoMsg', '📵 No internet. The photo is kept on this phone — you can still tap Send report and it will wait as pending.');
      cpPhoneSync_();
      return;
    }
    cpSetMsg_('cpPhPhotoMsg', 'Uploading photo…');
    cpUploadBlob_(blob, _cpPh.project).then(function (url) {
      if (seq !== _cpPhotoSeq) return;
      _cpPh.photoUrl = url;
      cpSetMsg_('cpPhPhotoMsg', '✓ Photo ready. Tap it to take again.');
    }).catch(function () {
      if (seq !== _cpPhotoSeq) return;
      cpSetMsg_('cpPhPhotoMsg', '📵 Photo not uploaded (no internet?). It is kept on this phone — you can still tap Send report and it will wait as pending.');
    }).then(function () {
      if (seq !== _cpPhotoSeq) return;
      _cpPh.photoBusy = false;
      cpPhoneSync_();
    });
  }).catch(function (err) {
    if (seq !== _cpPhotoSeq) return;
    _cpPh.photoBusy = false;
    cpSetMsg_('cpPhPhotoMsg', (err && err.message ? err.message : 'Could not read the photo.') + ' Tap to take it again.', true);
    cpPhoneSync_();
  });
}

function cpOnPlateInput_() {
  cpPhoneSync_();
  if (_cpLookupTimer) clearTimeout(_cpLookupTimer);
  var el = document.getElementById('cpPhLookup');
  var plate = cpNormPlate_(document.getElementById('cpPhPlate').value);
  if (plate.length < 3) { el.textContent = ''; el.className = 'cp-lookup'; return; }
  _cpLookupTimer = setTimeout(function () {
    var seq = ++_cpLookupSeq;
    el.textContent = 'Checking plate…';
    el.className = 'cp-lookup';
    cpApi_('lookupCarparkPlate', { plate: plate }).then(function (d) {
      if (seq !== _cpLookupSeq) return;
      if (d.found) {
        el.innerHTML = '✓ Plate is registered · this will be the <strong>' + cpEsc_(cpOrdinal_(d.nextWarning)) + ' warning</strong>';
        el.className = 'cp-lookup cp-lookup-found cp-lookup-w' + Math.min(d.nextWarning, 3);
      } else {
        el.textContent = 'Plate is not on any apartment. You can still send — the office will link it.';
        el.className = 'cp-lookup cp-lookup-miss';
      }
    }).catch(function () { if (seq === _cpLookupSeq) el.textContent = ''; });
  }, 450);
}

function cpSendReport_() {
  if (_cpPh.busy) return;
  _cpPh.busy = true;
  cpPhoneSync_();
  var btn = document.getElementById('cpPhSend');
  btn.textContent = 'Sending…';
  var res = document.getElementById('cpPhResult');
  res.style.display = 'none';
  var item = {
    id: 'cp' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    user: cpMe_(),
    project: _cpPh.project,
    plate: document.getElementById('cpPhPlate').value.trim(),
    violation: _cpPh.violation,
    photoUrl: _cpPh.photoUrl,
    photoBlob: _cpPh.photoBlob,
    seenAt: _cpPh.photoAt || new Date().toISOString(),
    savedAt: new Date().toISOString(),
    triedAt: '',
    error: ''
  };
  var queueIt = function (why) {
    return cpPendingSave_(item, why).then(function () {
      res.className = 'cp-result cp-result-warn';
      res.innerHTML = '<strong>📵 Saved on this phone — not sent yet.</strong><br>No internet. It is under <strong>Waiting to send</strong>. When you have internet, tap Try again or Send all.';
      res.style.display = '';
      cpPhoneReset_();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    }).catch(function (err) {
      res.className = 'cp-result cp-result-bad';
      res.textContent = 'No internet, and the report could not be saved on this phone: ' + (err && err.message ? err.message : err);
      res.style.display = '';
    });
  };
  var go;
  if (!cpOnline_()) {
    go = queueIt('No internet');
  } else {
    go = cpPendingTry_(item).then(function (d) {
      cpShowReportResult_(d.report);
      cpPhoneReset_();
      cpLoadReports_(false);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    }).catch(function (err) {
      if (cpIsNetErr_(err)) return queueIt(err.message);
      res.className = 'cp-result cp-result-bad';
      res.textContent = err.message;
      res.style.display = '';
    });
  }
  go.then(function () {
    _cpPh.busy = false;
    btn.textContent = 'Send report';
    cpPhoneSync_();
  });
}

function cpShowReportResult_(r) {
  var res = document.getElementById('cpPhResult');
  var h;
  if (!r.warningNo) {
    h = '<strong>Report #' + r.num + ' saved.</strong><br>Plate ' + cpEsc_(r.plate) + ' is not on any apartment — the office will link it and send the warning.';
    res.className = 'cp-result cp-result-warn';
  } else if (r.waStatus === 'sent') {
    h = '<strong>✓ Report #' + r.num + ' sent.</strong><br>The apartment got its <strong>' + cpEsc_(cpOrdinal_(r.warningNo)) + ' warning</strong> on WhatsApp.';
    res.className = 'cp-result cp-result-ok';
  } else {
    h = '<strong>Report #' + r.num + ' saved</strong> (' + cpEsc_(cpOrdinal_(r.warningNo)) + ' warning).<br>WhatsApp: ' + cpEsc_(CP_WA_LABEL[r.waStatus] || r.waStatus) + ' — the office will follow up.';
    res.className = 'cp-result cp-result-warn';
  }
  res.innerHTML = h;
  res.style.display = '';
}

function cpPhoneReset_() {
  _cpPhotoSeq++;
  _cpPh.photoUrl = '';
  _cpPh.photoBlob = null;
  _cpPh.photoAt = '';
  _cpPh.photoBusy = false;
  _cpPh.violation = '';
  document.getElementById('cpPhPlate').value = '';
  document.getElementById('cpPhLookup').textContent = '';
  document.getElementById('cpPhLookup').className = 'cp-lookup';
  document.getElementById('cpPhPhotoPreview').style.display = 'none';
  document.getElementById('cpPhPhotoBtn').style.display = '';
  cpSetMsg_('cpPhPhotoMsg', '');
}

function cpRenderPhoneList_() {
  var host = document.getElementById('cpPhList');
  if (!_cpReports.length) { host.innerHTML = empireEmptyHtml('No reports yet', 'Your reports will show here.'); return; }
  host.innerHTML = _cpReports.slice(0, 30).map(function (r) {
    return '<div class="dt-card cp-card">' +
      (r.photoUrl ? '<img class="cp-card-img" src="' + cpEsc_(r.photoUrl) + '" alt="" loading="lazy" onclick="cpBigImg_(this.src)">' : '') +
      '<div class="cp-card-body"><div class="dt-card-top"><span class="cp-plate">' + cpEsc_(r.plate) + '</span>' + cpWarnBadge_(r.warningNo) + '</div>' +
      '<div class="dt-card-issues">' + cpProjectShort_(r.project) + (r.warningNo ? '' : ' · plate not found') + ' · ' + cpEsc_(cpViolationLabel_(r.violation)) + '</div>' +
      '<div class="dt-card-meta">#' + r.num + ' · ' + cpEsc_(cpWhen_(r.createdAt)) + ' · ' + cpWaBadge_(r) + '</div></div></div>';
  }).join('');
}

// ---------------------------------------------------------------------------
// Phone: reports waiting to send (no internet). Kept in this phone's IndexedDB.
// They are sent one at a time, only when security taps Try again / Send all.
// ---------------------------------------------------------------------------

var CP_PENDING_DB = 'empire_carpark_pending';
var _cpPendingDb = null;
var _cpPending = [];
var _cpPendingBusy = false;
var _cpPhotoSeq = 0;

function cpOnline_() { return typeof navigator === 'undefined' || navigator.onLine !== false; }

/** A network problem (no internet / timeout), not the server saying no. */
function cpIsNetErr_(err) {
  if (!cpOnline_()) return true;
  var m = String((err && err.message) || err || '');
  return /load failed|failed to fetch|networkerror|network request|took too long|timed out|internet|offline|^HTTP 5\d\d|^HTTP 0/i.test(m);
}

function cpShrinkImage_(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onerror = function () { reject(new Error('Could not read the photo.')); };
    r.onload = function (e) {
      var img = new Image();
      img.onerror = function () { reject(new Error('Could not open the photo.')); };
      img.onload = function () {
        var k = Math.min(1, 1400 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not compress the photo.')); }, 'image/jpeg', 0.7);
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
}

function cpUploadBlob_(blob, project) {
  return new Promise(function (resolve, reject) {
    empireUploadPhoto(blob, 'carpark/' + (project || 'all'), function (url) {
      if (url) resolve(url);
      else reject(new Error((typeof _lastEmpireUploadError !== 'undefined' && _lastEmpireUploadError) || 'Photo upload failed.'));
    });
  });
}

function cpPendingDb_() {
  if (_cpPendingDb) return _cpPendingDb;
  _cpPendingDb = new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error('This phone cannot save reports offline.')); return; }
    var req = indexedDB.open(CP_PENDING_DB, 1);
    req.onupgradeneeded = function (e) { e.target.result.createObjectStore('reports', { keyPath: 'id' }); };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function () { reject(req.error || new Error('Could not open phone storage.')); };
  });
  _cpPendingDb.catch(function () { _cpPendingDb = null; });
  return _cpPendingDb;
}

function cpPendingTx_(mode, fn) {
  return cpPendingDb_().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('reports', mode);
      var out = fn(tx.objectStore('reports'));
      tx.oncomplete = function () { resolve(out && 'result' in out ? out.result : undefined); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Phone storage is full.')); };
    });
  });
}

function cpBlobToDataUrl_(blob) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error); };
    r.readAsDataURL(blob);
  });
}

function cpDataUrlToBlob_(dataUrl) {
  var parts = String(dataUrl).split(',');
  var bin = atob(parts[1] || '');
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: 'image/jpeg' });
}

/** Save a report on the phone (photo stored as text so every phone browser keeps it). */
function cpPendingSave_(item, why) {
  var rec = {
    id: item.id, user: item.user, project: item.project, plate: item.plate, violation: item.violation,
    seenAt: item.seenAt || item.savedAt, photoUrl: item.photoUrl || '', photoData: '', savedAt: item.savedAt, triedAt: item.triedAt || '', error: why || item.error || ''
  };
  var prep = (!rec.photoUrl && item.photoBlob) ? cpBlobToDataUrl_(item.photoBlob).then(function (d) { rec.photoData = d; })
    : (item.photoData ? Promise.resolve(rec.photoData = item.photoData) : Promise.resolve());
  return prep.then(function () {
    return cpPendingTx_('readwrite', function (st) { st.put(rec); });
  }).then(function () { return cpPendingLoad_(); });
}

function cpPendingDelete_(id) {
  return cpPendingTx_('readwrite', function (st) { st.delete(id); }).then(function () { return cpPendingLoad_(); });
}

function cpPendingLoad_() {
  return cpPendingTx_('readonly', function (st) { return st.getAll(); }).then(function (rows) {
    var me = cpMe_();
    _cpPending = (rows || []).filter(function (r) { return r.user === me; })
      .sort(function (a, b) { return a.savedAt < b.savedAt ? -1 : 1; });
    cpRenderPending_();
    return _cpPending;
  }).catch(function () { _cpPending = []; cpRenderPending_(); return _cpPending; });
}

/**
 * Send one report: upload the photo if needed, then save the report on the server.
 * If an earlier try may have reached the server (answer lost), check first so the
 * apartment never gets the same warning twice.
 */
function cpPendingTry_(item) {
  var step = Promise.resolve();
  if (!item.photoUrl) {
    var blob = item.photoBlob || (item.photoData ? cpDataUrlToBlob_(item.photoData) : null);
    if (!blob) return Promise.reject(new Error('The photo is missing. Delete this one and report again.'));
    step = cpUploadBlob_(blob, item.project).then(function (url) {
      item.photoUrl = url;
      // Remember the uploaded photo so the next try does not upload it again.
      if (item.queued) return cpPendingSave_(item, item.error).catch(function () {});
    });
  }
  return step.then(function () {
    if (!item.triedAt) return null;
    return cpApi_('getCarparkReports').then(function (d) {
      var want = cpNormPlate_(item.plate);
      var since = new Date(item.triedAt).getTime() - 5 * 60000;
      var seen = new Date(item.seenAt || item.savedAt).getTime();
      return (d.reports || []).filter(function (r) {
        if (cpNormPlate_(r.plate) !== want || r.violation !== item.violation) return false;
        var t = new Date(r.createdAt).getTime();
        // Saved with the photo time, or (server ignored it) with the time it arrived.
        return Math.abs(t - seen) < 3 * 60000 || t >= since;
      })[0] || null;
    });
  }).then(function (already) {
    if (already) return { ok: true, report: already, already: true };
    item.triedAt = item.triedAt || new Date().toISOString();
    var mark = item.queued ? cpPendingSave_(item, item.error).catch(function () {}) : Promise.resolve();
    return mark.then(function () {
      return cpApi_('addCarparkReport', { project: item.project, plate: item.plate, violation: item.violation, photoUrl: item.photoUrl, seenAt: item.seenAt || item.savedAt });
    });
  });
}

function cpPendingFind_(id) {
  for (var i = 0; i < _cpPending.length; i++) if (_cpPending[i].id === id) return _cpPending[i];
  return null;
}

/** Try one waiting report. Resolves true if it went, false if it is still waiting. */
function cpPendingSendOne_(id) {
  var item = cpPendingFind_(id);
  if (!item) return Promise.resolve(true);
  item.queued = true;
  if (!cpOnline_()) {
    cpSetMsg_('cpPhPendingMsg', '📵 Still no internet. Try again when you are connected.', true);
    return Promise.resolve(false);
  }
  return cpPendingTry_(item).then(function (d) {
    return cpPendingDelete_(id).then(function () {
      cpShowReportResult_(d.report);
      return true;
    });
  }).catch(function (err) {
    var msg = err && err.message ? err.message : String(err);
    item.error = msg;
    return cpPendingSave_(item, msg).catch(function () {}).then(function () {
      cpSetMsg_('cpPhPendingMsg', (cpIsNetErr_(err) ? '📵 ' : '') + 'Plate ' + String(item.plate).toUpperCase() + ': ' + msg, true);
      return false;
    });
  });
}

function cpPendingRetry_(id, btn) {
  if (_cpPendingBusy) return;
  _cpPendingBusy = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  cpSetMsg_('cpPhPendingMsg', 'Sending…');
  cpPendingSendOne_(id).then(function (ok) {
    if (ok) cpSetMsg_('cpPhPendingMsg', '✓ Sent.');
    cpLoadReports_(false);
  }).then(function () {
    _cpPendingBusy = false;
    cpRenderPending_();
  });
}

/** Send every waiting report one after another; stop at the first one that fails. */
function cpPendingSendAll_() {
  if (_cpPendingBusy || !_cpPending.length) return;
  _cpPendingBusy = true;
  cpRenderPending_();
  var ids = _cpPending.map(function (r) { return r.id; });
  var sent = 0;
  var next = function (i) {
    if (i >= ids.length) return Promise.resolve(true);
    cpSetMsg_('cpPhPendingMsg', 'Sending ' + (i + 1) + ' of ' + ids.length + '…');
    return cpPendingSendOne_(ids[i]).then(function (ok) {
      if (!ok) return false;
      sent++;
      return next(i + 1);
    });
  };
  next(0).then(function (allOk) {
    if (allOk) cpSetMsg_('cpPhPendingMsg', '✓ All ' + sent + ' sent.');
    cpLoadReports_(false);
  }).then(function () {
    _cpPendingBusy = false;
    cpRenderPending_();
  });
}

function cpPendingRemove_(id) {
  if (_cpPendingBusy) return;
  if (!confirm('Delete this report from the phone? It was never sent, so it will be lost.')) return;
  cpPendingDelete_(id);
}

function cpRenderPending_() {
  var wrap = document.getElementById('cpPhPending');
  if (!wrap) return;
  wrap.style.display = _cpPending.length ? '' : 'none';
  document.getElementById('cpPhPendingCount').textContent = String(_cpPending.length);
  var all = document.getElementById('cpPhSendAll');
  all.disabled = _cpPendingBusy;
  all.textContent = _cpPending.length > 1 ? 'Send all (' + _cpPending.length + ')' : 'Send';
  all.style.display = _cpPending.length > 1 ? '' : 'none';
  document.getElementById('cpPhPendingList').innerHTML = _cpPending.map(function (r) {
    var img = r.photoUrl || r.photoData || '';
    return '<div class="dt-card cp-card cp-pending-card">' +
      (img ? '<img class="cp-card-img" src="' + cpEsc_(img) + '" alt="" onclick="cpBigImg_(this.src)">' : '') +
      '<div class="cp-card-body"><div class="dt-card-top"><span class="cp-plate">' + cpEsc_(r.plate) + '</span><span class="cp-pending-tag">⏳ Not sent</span></div>' +
      '<div class="dt-card-issues">' + cpProjectShort_(r.project) + ' · ' + cpEsc_(cpViolationLabel_(r.violation)) + '</div>' +
      '<div class="dt-card-meta">Photo ' + cpEsc_(cpWhen_(r.seenAt || r.savedAt)) + '</div>' +
      (r.error ? '<div class="cp-pending-err">' + cpEsc_(r.error) + '</div>' : '') +
      '<div class="cp-pending-btns">' +
      '<button type="button" class="dt-primary"' + (_cpPendingBusy ? ' disabled' : '') + ' onclick="cpPendingRetry_(\'' + cpEsc_(r.id) + '\', this)">Try again</button>' +
      '<button type="button"' + (_cpPendingBusy ? ' disabled' : '') + ' onclick="cpPendingRemove_(\'' + cpEsc_(r.id) + '\')">Delete</button>' +
      '</div></div></div>';
  }).join('');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(function cpBoot_() {
  function run() {
    empireAuthPageBoot({ dept: CP_LOGIN_DEPT, sendToHomeLogin: false, onEnter: cpEnter_ });
    if (empireGetToken() && typeof empireAuthRefreshPerms === 'function') {
      empireAuthRefreshPerms(function () {
        if (!_cpMode) return;
        document.getElementById('cpToPhoneBtn').style.display = (_cpMode === 'desk' && cpCanSecurity_()) ? '' : 'none';
        document.getElementById('cpToDeskBtn').style.display = (_cpMode === 'phone' && cpCanPortal_()) ? '' : 'none';
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cpCloseModal_(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && _cpMode) cpLoadReports_(false);
  });
  window.addEventListener('online', function () {
    if (_cpMode === 'phone' && _cpPending.length) cpSetMsg_('cpPhPendingMsg', '📶 Internet is back. Tap Try again or Send all.');
  });
})();
