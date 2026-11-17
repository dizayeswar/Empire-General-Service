/* HSE Department — observation register + action plan, incidents & alarms, safety performance, monthly report.
   The monthly report (KPIs, man-hours, LTIFR, TRIR, lists) is worked out here from the saved rows. */
var HS_LOGIN_DEPT = 'hse';
var HS_BUILDINGS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C1–C6', 'C1–C3', 'C4–C6', 'Zone A', 'Zone B', 'Zone C', 'Roofs', 'ES5'];
var HS_TEAMS = ['Maintenance / Facade', 'Electrical Maintenance', 'MEP / Plumbing', 'MEP / HVAC', 'Fire Fighting / MEP',
  'Civil / MEP', 'Civil / Finishing', 'Civil / Parking Mgmt', 'Maintenance / Civil', 'Maintenance / HSE', 'Procurement / HSE', 'Security'];
var HS_STATUS = { open: 'Open', in_progress: 'In progress', closed: 'Closed' };
var HS_KINDS = [
  { key: 'false_alarm', label: 'False fire alarm' },
  { key: 'incident', label: 'Incident' },
  { key: 'accident', label: 'Accident' },
  { key: 'near_miss', label: 'Near miss' },
  { key: 'security', label: 'Security event' }
];
var HS_MAX_PHOTOS = 10;

var _hs = { obs: [], events: [], months: [], canWrite: false, targetDays: { High: 7, Medium: 14, Low: 30 }, tab: 'dash', loaded: false };
var _hsEdit = null; // the observation / event being edited in the modal

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function hsEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hsMe_() { return String(empireGetUser() || '').trim().toLowerCase(); }
function hsPretty_(u) {
  return String(u || '').split(/[_.\s]+/).filter(Boolean).map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
}
function hsNo_(n) { return 'HSE-' + String(n || 0).padStart(3, '0'); }
function hsZ_(n) { return String(n).padStart(2, '0'); }
function hsDay_(d) { return d.getFullYear() + '-' + hsZ_(d.getMonth() + 1) + '-' + hsZ_(d.getDate()); }
function hsToday_() { return hsDay_(new Date()); }
function hsLocalDay_(isoStr) { var d = new Date(isoStr); return isNaN(d.getTime()) ? '' : hsDay_(d); }
function hsWhen_(isoStr) {
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return hsDay_(d) + ' ' + hsZ_(d.getHours()) + ':' + hsZ_(d.getMinutes());
}
function hsNice_(day) {
  if (!day) return '';
  var d = new Date(day + 'T00:00:00');
  return isNaN(d.getTime()) ? day : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function hsMonthName_(m) {
  var d = new Date(m + '-01T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function hsAddDays_(day, n) { var d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return hsDay_(d); }
function hsKindLabel_(k) {
  for (var i = 0; i < HS_KINDS.length; i++) if (HS_KINDS[i].key === k) return HS_KINDS[i].label;
  return k;
}
function hsPriPill_(p) { return '<span class="hs-pill hs-p-' + hsEsc_(p) + '">' + hsEsc_(p) + '</span>'; }
function hsStPill_(s) { return '<span class="hs-pill hs-s-' + hsEsc_(s) + '">' + hsEsc_(HS_STATUS[s] || s) + '</span>'; }
function hsSetMsg_(id, text, isError) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('dt-msg-error', !!isError);
}
function hsApi_(action, extra) {
  var body = { action: action, token: empireGetToken() };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return fetchJSONRetry(body, 2, 45000).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Request failed');
    return d;
  });
}
function hsThumbs_(urls) {
  if (!urls || !urls.length) return '<span class="hs-nophoto">No photo</span>';
  return '<div class="hs-thumbs">' + urls.slice(0, 3).map(function (u) {
    return '<img src="' + hsEsc_(u) + '" alt="" loading="lazy" onclick="event.stopPropagation();hsBigImg_(this.src)">';
  }).join('') + (urls.length > 3 ? '<span class="hs-nophoto">+' + (urls.length - 3) + '</span>' : '') + '</div>';
}
function hsBigImg_(src) {
  document.getElementById('hsImgBig').src = src;
  document.getElementById('hsImgModal').classList.add('show');
}
function hsOpenModal_(html) {
  document.getElementById('hsModalBody').innerHTML = html;
  document.getElementById('hsModal').classList.add('show');
}
function hsCloseModal_() {
  document.getElementById('hsModal').classList.remove('show');
  _hsEdit = null;
}

// ---------------------------------------------------------------------------
// Month maths: everything in the report is counted for the chosen month
// ---------------------------------------------------------------------------
function hsMonth_() { return document.getElementById('hsMonth').value || hsToday_().slice(0, 7); }
function hsRange_(m) {
  var y = +m.slice(0, 4), mo = +m.slice(5, 7);
  var last = new Date(y, mo, 0).getDate();
  return { start: m + '-01', end: m + '-' + hsZ_(last) };
}
/** The day we judge "late" against: the month end, or today while the month is still running. */
function hsAsOf_(m) { var r = hsRange_(m); var t = hsToday_(); return t < r.end ? t : r.end; }
function hsOpenAt_(o, day) { return o.foundOn <= day && (o.status !== 'closed' || (o.closedOn && o.closedOn > day)); }
function hsIsLate_(o, day) { return hsOpenAt_(o, day) && o.targetOn && o.targetOn < day; }
/** Observations that belong in a month's register: found by the month end and not closed before it started. */
function hsInMonth_(o, m) {
  var r = hsRange_(m);
  return o.foundOn <= r.end && !(o.status === 'closed' && o.closedOn && o.closedOn < r.start);
}
function hsMonthRow_(m) {
  for (var i = 0; i < _hs.months.length; i++) if (_hs.months[i].month === m) return _hs.months[i];
  return null;
}
function hsStats_(m) {
  var r = hsRange_(m), asOf = hsAsOf_(m);
  var openEnd = _hs.obs.filter(function (o) { return hsOpenAt_(o, asOf); });
  var ev = _hs.events.filter(function (e) { var d = hsLocalDay_(e.happenedAt); return d >= r.start && d <= r.end; });
  var mr = hsMonthRow_(m) || {};
  var manHours = (mr.workforce || 0) * (mr.workingDays || 0) * (mr.hoursPerDay || 0);
  var s = {
    month: m, range: r, asOf: asOf,
    open: openEnd.length,
    high: openEnd.filter(function (o) { return o.priority === 'High'; }).length,
    medium: openEnd.filter(function (o) { return o.priority === 'Medium'; }).length,
    low: openEnd.filter(function (o) { return o.priority === 'Low'; }).length,
    late: openEnd.filter(function (o) { return o.targetOn && o.targetOn < asOf; }).length,
    carried: openEnd.filter(function (o) { return o.foundOn < r.start; }).length,
    foundNew: _hs.obs.filter(function (o) { return o.foundOn >= r.start && o.foundOn <= r.end; }).length,
    closed: _hs.obs.filter(function (o) { return o.status === 'closed' && o.closedOn >= r.start && o.closedOn <= r.end; }).length,
    events: ev,
    incidents: ev.filter(function (e) { return e.kind === 'incident' || e.kind === 'accident'; }).length,
    accidents: ev.filter(function (e) { return e.kind === 'accident'; }).length,
    injuries: ev.filter(function (e) { return e.injury; }).length,
    lti: ev.filter(function (e) { return e.lostTime; }).length,
    daysLost: ev.reduce(function (a, e) { return a + (e.lostTime ? (e.daysLost || 0) : 0); }, 0),
    alarms: ev.filter(function (e) { return e.kind === 'false_alarm'; }).length,
    nearMiss: ev.filter(function (e) { return e.kind === 'near_miss'; }).length,
    security: ev.filter(function (e) { return e.kind === 'security'; }).length,
    monthRow: mr,
    manHours: manHours
  };
  s.ltifr = manHours ? s.lti * 1e6 / manHours : 0;
  s.trir = manHours ? s.injuries * 2e5 / manHours : 0;
  s.hoursLost = s.daysLost * (mr.hoursPerDay || 8);
  return s;
}

// ---------------------------------------------------------------------------
// Login, load, tabs
// ---------------------------------------------------------------------------
function hsHandleLogin_(e) {
  empireAuthLogin(e, HS_LOGIN_DEPT, { onSuccess: function () { hsEnter_(); } }).catch(function () {});
}
function hsLogout_() { empireAuthLogout({ reload: true }); }

function hsEnter_() {
  document.getElementById('loginPage').classList.remove('show');
  document.getElementById('mainContainer').classList.add('show');
  empireAuthMarkLoginVisible(false);
  document.getElementById('hsWho').textContent = 'Signed in as ' + hsPretty_(hsMe_());
  hsFillMonths_();
  if (typeof empireApplySectionNav === 'function') empireApplySectionNav();
  var first = document.querySelector('.tabs .tab-btn:not([style*="display: none"])');
  if (first) hsTab_(first.getAttribute('data-tab'));
  hsLoad_(true);
}

function hsFillMonths_() {
  var sel = document.getElementById('hsMonth');
  var keep = sel.value;
  var set = {};
  var now = new Date();
  for (var i = 0; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    set[d.getFullYear() + '-' + hsZ_(d.getMonth() + 1)] = 1;
  }
  _hs.obs.forEach(function (o) { if (o.foundOn) set[o.foundOn.slice(0, 7)] = 1; });
  _hs.months.forEach(function (r) { set[r.month] = 1; });
  var months = Object.keys(set).sort().reverse();
  sel.innerHTML = months.map(function (m) { return '<option value="' + m + '">' + hsMonthName_(m) + '</option>'; }).join('');
  // Until the month is over, open on the last finished month that has a report.
  if (!keep) {
    var cur = hsToday_().slice(0, 7);
    keep = cur;
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevKey = prev.getFullYear() + '-' + hsZ_(prev.getMonth() + 1);
    if (now.getDate() <= 10 || hsMonthRow_(prevKey)) keep = prevKey;
  }
  sel.value = keep;
}

function hsLoad_(showLoading) {
  if (showLoading && !_hs.loaded) {
    ['hsDash', 'hsObsList', 'hsEvList', 'hsPerf', 'hsReport'].forEach(function (id) { document.getElementById(id).innerHTML = empireLoadingHtml(); });
  }
  return hsApi_('getHseData').then(function (d) {
    _hs.obs = d.observations || [];
    _hs.events = d.events || [];
    _hs.months = d.months || [];
    _hs.canWrite = !!d.canWrite;
    if (d.targetDays) _hs.targetDays = d.targetDays;
    // First load: choose the starting month now that we know which months have a report.
    if (!_hs.loaded) document.getElementById('hsMonth').value = '';
    _hs.loaded = true;
    document.getElementById('hsTargetHint').textContent =
      _hs.targetDays.High + ' days (High), ' + _hs.targetDays.Medium + ' (Medium), ' + _hs.targetDays.Low + ' (Low)';
    document.querySelectorAll('.hs-write').forEach(function (b) { b.style.display = _hs.canWrite ? '' : 'none'; });
    hsFillMonths_();
    hsRender_();
  }).catch(function (err) {
    ['hsDash', 'hsObsList', 'hsEvList', 'hsPerf', 'hsReport'].forEach(function (id) { document.getElementById(id).innerHTML = empireErrorHtml(err.message); });
  });
}

function hsTab_(tab) {
  _hs.tab = tab;
  var panes = { dash: 'hsPaneDash', obs: 'hsPaneObs', events: 'hsPaneEvents', perf: 'hsPanePerf', report: 'hsPaneReport' };
  Object.keys(panes).forEach(function (k) { document.getElementById(panes[k]).classList.toggle('active', k === tab); });
  document.querySelectorAll('.tabs .tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  if (_hs.loaded) hsRender_();
}

function hsRender_() {
  if (!_hs.loaded) return;
  var s = hsStats_(hsMonth_());
  var nowOpen = _hs.obs.filter(function (o) { return o.status !== 'closed'; }).length;
  var b = document.getElementById('hsOpenCount');
  b.textContent = String(nowOpen);
  b.style.display = nowOpen ? '' : 'none';
  hsFillBuildingFilter_();
  if (_hs.tab === 'dash') hsRenderDash_(s);
  if (_hs.tab === 'obs') hsRenderObs_();
  if (_hs.tab === 'events') hsRenderEvents_();
  if (_hs.tab === 'perf') hsRenderPerf_(s);
  if (_hs.tab === 'report') hsRenderReport_(s);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function hsRenderDash_(s) {
  var stat = function (v, label, cls, onclick) {
    return '<div class="stat-box ' + (cls || '') + '"' + (onclick ? ' onclick="' + onclick + '" style="cursor:pointer"' : '') + '>' +
      '<div class="stat-value">' + v + '</div><div class="stat-label">' + hsEsc_(label) + '</div></div>';
  };
  var inMonth = _hs.obs.filter(function (o) { return hsInMonth_(o, s.month); });
  var tot = Math.max(1, inMonth.length);
  var onTime = s.open - s.late;
  var h = '<h2 style="margin:0">' + hsEsc_(hsMonthName_(s.month)) + '</h2>' +
    '<p class="dt-hint">Counted from the register and the incident log' + (s.asOf < s.range.end ? ', as of today' : '') + '.</p>' +
    '<div class="stats">' +
    stat(s.open, 'Open observations', s.open ? 'hs-stat-bad' : 'hs-stat-ok', "hsJump_('notclosed')") +
    stat(s.high + ' / ' + s.medium, 'High / Medium open', '') +
    stat(s.late, 'Past target date', s.late ? 'hs-stat-bad' : 'hs-stat-ok', "hsJump_('late')") +
    stat(s.carried, 'Still open from before', s.carried ? 'hs-stat-warn' : '') +
    stat(s.foundNew, 'Found this month', '') +
    stat(s.closed, 'Closed this month', 'hs-stat-ok', "hsJump_('closed')") +
    stat(s.incidents + ' / ' + s.lti, 'Incidents / LTI', (s.incidents || s.lti) ? 'hs-stat-bad' : 'hs-stat-ok', "hsTab_('events')") +
    stat(s.alarms, 'False fire alarms', s.alarms ? 'hs-stat-warn' : '', "hsTab_('events')") +
    '</div>';
  h += '<div class="hs-grid2"><div class="hs-card"><h3>This month\'s ' + inMonth.length + ' observations</h3>' +
    '<div class="hs-bar"><span style="width:' + (s.closed / tot * 100) + '%;background:#1d9e75"></span>' +
    '<span style="width:' + (onTime / tot * 100) + '%;background:#d68910"></span>' +
    '<span style="width:' + (s.late / tot * 100) + '%;background:#C5504F"></span></div>' +
    '<div class="hs-legend"><span><i class="hs-dot" style="background:#1d9e75"></i>Closed ' + s.closed + '</span>' +
    '<span><i class="hs-dot" style="background:#d68910"></i>Open, on time ' + onTime + '</span>' +
    '<span><i class="hs-dot" style="background:#C5504F"></i>Past target ' + s.late + '</span></div></div>';
  h += '<div class="hs-card"><h3>Open by building</h3>' + hsHBars_(hsCount_(s, 'building')) + '</div></div>';
  h += '<div class="hs-card" style="margin-top:16px"><h3>Open by responsible team</h3>' + hsTeamTable_(s) + '</div>';
  document.getElementById('hsDash').innerHTML = h;
}
function hsCount_(s, field) {
  var m = {};
  _hs.obs.forEach(function (o) { if (hsOpenAt_(o, s.asOf)) m[o[field] || '—'] = (m[o[field] || '—'] || 0) + 1; });
  return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
}
function hsHBars_(rows) {
  if (!rows.length) return '<p class="hs-empty-note">Nothing open.</p>';
  var mx = rows[0][1] || 1;
  return rows.map(function (r) {
    return '<div class="hs-hbar"><span>' + hsEsc_(r[0]) + '</span><div class="hs-bar"><span style="width:' + (r[1] / mx * 100) +
      '%;background:var(--accent2)"></span></div><span class="n">' + r[1] + '</span></div>';
  }).join('');
}
function hsTeamTable_(s) {
  var m = {};
  _hs.obs.forEach(function (o) {
    if (!hsOpenAt_(o, s.asOf)) return;
    var k = o.responsible || 'Not set';
    m[k] = m[k] || { High: 0, Medium: 0, Low: 0, late: 0 };
    m[k][o.priority] = (m[k][o.priority] || 0) + 1;
    if (o.targetOn && o.targetOn < s.asOf) m[k].late++;
  });
  var keys = Object.keys(m).sort(function (a, b) {
    var ta = m[a].High + m[a].Medium + m[a].Low, tb = m[b].High + m[b].Medium + m[b].Low;
    return tb - ta;
  });
  if (!keys.length) return '<p class="hs-empty-note">Nothing open.</p>';
  return '<div class="dt-table-wrap"><table><thead><tr><th>Team</th><th class="n">High</th><th class="n">Medium</th><th class="n">Low</th><th class="n">Past target</th><th class="n">Total</th></tr></thead><tbody>' +
    keys.map(function (k) {
      var v = m[k];
      return '<tr><td>' + hsEsc_(k) + '</td><td class="n">' + v.High + '</td><td class="n">' + v.Medium + '</td><td class="n">' + v.Low +
        '</td><td class="n' + (v.late ? ' hs-late' : '') + '">' + v.late + '</td><td class="n"><strong>' + (v.High + v.Medium + v.Low) + '</strong></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function hsJump_(status) {
  document.getElementById('hsObsStatus').value = status;
  hsTab_('obs');
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------
function hsFillBuildingFilter_() {
  var sel = document.getElementById('hsObsBld');
  var keep = sel.value;
  var set = {};
  _hs.obs.forEach(function (o) { if (o.building) set[o.building] = 1; });
  sel.innerHTML = '<option value="">All</option>' + Object.keys(set).sort().map(function (b) {
    return '<option value="' + hsEsc_(b) + '">' + hsEsc_(b) + '</option>';
  }).join('');
  sel.value = set[keep] ? keep : '';
}

function hsRenderObs_() {
  if (!_hs.loaded) return;
  var bld = document.getElementById('hsObsBld').value;
  var pri = document.getElementById('hsObsPri').value;
  var st = document.getElementById('hsObsStatus').value;
  var q = document.getElementById('hsObsSearch').value.trim().toLowerCase();
  var today = hsToday_();
  var list = _hs.obs.filter(function (o) {
    if (bld && o.building !== bld) return false;
    if (pri && o.priority !== pri) return false;
    if (st === 'notclosed' && o.status === 'closed') return false;
    if (st === 'late' && !hsIsLate_(o, today)) return false;
    if (st && st !== 'notclosed' && st !== 'late' && o.status !== st) return false;
    if (q) {
      var hay = [hsNo_(o.num), o.building, o.location, o.observation, o.requiredAction, o.responsible, o.remarks].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  var host = document.getElementById('hsObsList');
  if (!list.length) {
    host.innerHTML = empireEmptyHtml('No observations', _hs.obs.length ? 'Nothing matches these filters.' : 'Add the first one with + New observation.');
    return;
  }
  var monthStart = hsRange_(hsToday_().slice(0, 7)).start;
  host.innerHTML = '<p class="dt-hint">' + list.length + ' shown. Click a row to open it.</p><div class="dt-table-wrap"><table class="hs-table"><thead><tr>' +
    '<th>No.</th><th>Where</th><th>Observation &amp; action</th><th>Priority</th><th>Responsible</th><th class="n">Found</th><th class="n">Target</th><th>Photos</th><th>Status</th>' +
    '</tr></thead><tbody>' + list.map(function (o) {
      var late = hsIsLate_(o, today);
      return '<tr onclick="hsEditObs_(\'' + hsEsc_(o.id) + '\')">' +
        '<td><span class="hs-num">' + hsNo_(o.num) + '</span></td>' +
        '<td><strong>' + hsEsc_(o.building) + '</strong><div class="hs-sub">' + hsEsc_(o.location) + '</div></td>' +
        '<td>' + hsEsc_(o.observation) + '<div class="hs-sub">Action: ' + hsEsc_(o.requiredAction || '—') + '</div>' +
        (o.status !== 'closed' && o.foundOn < monthStart ? '<span class="hs-carry">Open since ' + hsEsc_(hsNice_(o.foundOn)) + '</span>' : '') + '</td>' +
        '<td>' + hsPriPill_(o.priority) + '</td>' +
        '<td>' + hsEsc_(o.responsible || '—') + '</td>' +
        '<td class="n">' + hsEsc_(o.foundOn) + '</td>' +
        '<td class="n' + (late ? ' hs-late' : '') + '">' + hsEsc_(o.targetOn || '—') + (late ? '<div>late</div>' : '') + '</td>' +
        '<td>' + hsThumbs_(o.photos) + '</td>' +
        '<td>' + hsStPill_(o.status) + (o.closedOn ? '<div class="hs-sub">' + hsEsc_(o.closedOn) + '</div>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function hsFindObs_(id) {
  for (var i = 0; i < _hs.obs.length; i++) if (_hs.obs[i].id === id) return _hs.obs[i];
  return null;
}

function hsOptions_(list, selected) {
  var has = list.indexOf(selected) !== -1;
  return (selected && !has ? '<option selected>' + hsEsc_(selected) + '</option>' : '') +
    list.map(function (v) { return '<option' + (v === selected ? ' selected' : '') + '>' + hsEsc_(v) + '</option>'; }).join('');
}
function hsTeamList_() {
  var set = {};
  HS_TEAMS.forEach(function (t) { set[t] = 1; });
  _hs.obs.forEach(function (o) { if (o.responsible) set[o.responsible] = 1; });
  return Object.keys(set).sort();
}

function hsEditObs_(id) {
  var o = id ? hsFindObs_(id) : null;
  if (id && !o) return;
  var ro = !_hs.canWrite;
  _hsEdit = { type: 'obs', id: id, photos: o ? o.photos.slice() : [], closedPhotos: o ? o.closedPhotos.slice() : [], photoTarget: 'photos' };
  var dis = ro ? ' disabled' : '';
  var bldList = '<datalist id="hsBldList">' + HS_BUILDINGS.map(function (b) { return '<option value="' + hsEsc_(b) + '">'; }).join('') + '</datalist>';
  var teamList = '<datalist id="hsTeamList">' + hsTeamList_().map(function (b) { return '<option value="' + hsEsc_(b) + '">'; }).join('') + '</datalist>';
  var h = '<h2 style="margin-top:0">' + (o ? hsNo_(o.num) + ' ' + hsStPill_(o.status) : 'New observation') + '</h2>' +
    (o ? '<p class="dt-hint">Added by ' + hsEsc_(hsPretty_(o.createdBy)) + (o.updatedBy && o.updatedAt ? ' · last change by ' + hsEsc_(hsPretty_(o.updatedBy)) + ' ' + hsEsc_(hsWhen_(o.updatedAt)) : '') + '</p>' : '') +
    bldList + teamList +
    '<div class="hs-form">' +
    '<div class="form-group"><label for="hoBld">Building / area</label><input id="hoBld" list="hsBldList" value="' + hsEsc_(o ? o.building : '') + '" placeholder="C1, Zone B, Roofs…"' + dis + '></div>' +
    '<div class="form-group"><label for="hoLoc">Exact place</label><input id="hoLoc" value="' + hsEsc_(o ? o.location : '') + '" placeholder="e.g. Third-floor door"' + dis + '></div>' +
    '<div class="form-group"><label for="hoPri">Priority</label><select id="hoPri" onchange="hsAutoTarget_()"' + dis + '>' + hsOptions_(['High', 'Medium', 'Low'], o ? o.priority : 'High') + '</select></div>' +
    '<div class="form-group"><label for="hoResp">Responsible team</label><input id="hoResp" list="hsTeamList" value="' + hsEsc_(o ? o.responsible : '') + '" placeholder="Who must fix it"' + dis + '></div>' +
    '<div class="form-group hs-wide"><label for="hoText">Observation (what is unsafe)</label><textarea id="hoText"' + dis + '>' + hsEsc_(o ? o.observation : '') + '</textarea></div>' +
    '<div class="form-group hs-wide"><label for="hoAct">Required action</label><textarea id="hoAct"' + dis + '>' + hsEsc_(o ? o.requiredAction : '') + '</textarea></div>' +
    '<div class="form-group"><label for="hoFound">Date found</label><input type="date" id="hoFound" value="' + hsEsc_(o ? o.foundOn : hsToday_()) + '" onchange="hsAutoTarget_()"' + dis + '></div>' +
    '<div class="form-group"><label for="hoTarget">Target date</label><input type="date" id="hoTarget" value="' + hsEsc_(o ? o.targetOn : '') + '"' + dis + '></div>' +
    '<div class="form-group hs-wide"><label for="hoRem">Remarks (follow-up notes)</label><textarea id="hoRem"' + dis + '>' + hsEsc_(o ? o.remarks : '') + '</textarea></div>' +
    '<div class="form-group hs-wide"><label>Photos</label><div class="hs-photo-edit" id="hoPhotos"></div></div>' +
    '</div>';
  if (o && !ro) {
    h += '<h3 style="margin:18px 0 8px">Status</h3><div class="hs-status-btns">' +
      ['open', 'in_progress', 'closed'].map(function (s) {
        return '<button type="button" class="' + (o.status === s ? 'on' : '') + '" onclick="hsSetObsStatus_(\'' + s + '\')">' + HS_STATUS[s] + '</button>';
      }).join('') + '</div>' +
      '<div class="hs-form" style="margin-top:10px"><div class="form-group"><label for="hoClosedOn">Closed on</label><input type="date" id="hoClosedOn" value="' + hsEsc_(o.closedOn || hsToday_()) + '"></div>' +
      '<div class="form-group hs-wide"><label>Photo after the fix (optional, used when you close it)</label><div class="hs-photo-edit" id="hoClosedPhotos"></div></div></div>';
  } else if (o && o.closedPhotos.length) {
    h += '<h3 style="margin:18px 0 8px">After the fix</h3>' + hsThumbs_(o.closedPhotos);
  }
  h += '<div class="dt-actions" style="margin-top:18px">' +
    (ro ? '' : '<button type="button" class="dt-primary" id="hoSave" onclick="hsSaveObs_()">' + (o ? 'Save changes' : 'Save observation') + '</button>') +
    '<button type="button" onclick="hsCloseModal_()">' + (ro ? 'Close' : 'Cancel') + '</button>' +
    (o && !ro ? '<button type="button" class="dt-danger" id="hoDel" onclick="hsDeleteObs_(false)" style="margin-left:auto">Delete</button>' : '') +
    '<span id="hoMsg" class="dt-msg" aria-live="polite"></span></div>';
  hsOpenModal_(h);
  hsDrawPhotos_();
  if (!o) hsAutoTarget_();
}

/** Fill the target date from the priority while the user has not typed one. */
function hsAutoTarget_() {
  var t = document.getElementById('hoTarget');
  if (!t || (t.value && t.dataset.auto !== '1')) return;
  var f = document.getElementById('hoFound').value;
  if (!f) return;
  t.value = hsAddDays_(f, _hs.targetDays[document.getElementById('hoPri').value] || 7);
  t.dataset.auto = '1';
  t.oninput = function () { t.dataset.auto = ''; };
}

function hsDrawPhotos_() {
  if (!_hsEdit) return;
  var ro = !_hs.canWrite;
  [['photos', 'hoPhotos', 'hoMsg'], ['closedPhotos', 'hoClosedPhotos', 'hoMsg'], ['photos', 'hePhotos', 'heMsg']].forEach(function (p) {
    var host = document.getElementById(p[1]);
    if (!host) return;
    var urls = _hsEdit[p[0]] || [];
    host.innerHTML = urls.map(function (u, i) {
      return '<div class="hs-ph"><img src="' + hsEsc_(u) + '" alt="" onclick="hsBigImg_(this.src)">' +
        (ro ? '' : '<button type="button" aria-label="Remove photo" onclick="hsRemovePhoto_(\'' + p[0] + '\',' + i + ')">×</button>') + '</div>';
    }).join('') + (ro ? (urls.length ? '' : '<span class="hs-nophoto">No photo</span>') :
      (urls.length < HS_MAX_PHOTOS ? '<button type="button" onclick="hsPickPhoto_(\'' + p[0] + '\')">📷 Add photo</button>' : ''));
  });
}
function hsRemovePhoto_(field, i) {
  if (!_hsEdit) return;
  _hsEdit[field].splice(i, 1);
  hsDrawPhotos_();
}
function hsPickPhoto_(field) {
  if (!_hsEdit) return;
  _hsEdit.photoTarget = field;
  document.getElementById('hsPhotoInput').click();
}
function hsPhotoPicked_(ev) {
  var files = Array.prototype.slice.call(ev.target.files || []);
  ev.target.value = '';
  if (!_hsEdit || !files.length) return;
  var edit = _hsEdit, field = edit.photoTarget;
  var msgId = edit.type === 'obs' ? 'hoMsg' : 'heMsg';
  var room = HS_MAX_PHOTOS - edit[field].length;
  files = files.slice(0, Math.max(0, room));
  var left = files.length, failed = 0;
  edit.uploading = (edit.uploading || 0) + left;
  hsSetMsg_(msgId, 'Uploading ' + left + ' photo' + (left > 1 ? 's' : '') + '…');
  files.forEach(function (f) {
    empireCompressImage(f, edit.type === 'obs' ? 'hse/observations' : 'hse/events', function (url) {
      edit.uploading--;
      left--;
      if (url) edit[field].push(url); else failed++;
      if (_hsEdit !== edit) return;
      hsDrawPhotos_();
      if (!left) {
        hsSetMsg_(msgId, failed ? 'Could not upload ' + failed + ' photo(s): ' + (window._lastEmpireUploadError || 'try again') : 'Photos added. Remember to save.', !!failed);
      }
    });
  });
}

function hsSaveObs_() {
  var e = _hsEdit;
  if (!e || e.type !== 'obs') return;
  if (e.uploading) { hsSetMsg_('hoMsg', 'Wait for the photos to finish uploading.', true); return; }
  var btn = document.getElementById('hoSave');
  btn.disabled = true;
  hsSetMsg_('hoMsg', 'Saving…');
  var t = document.getElementById('hoTarget');
  hsApi_('saveHseObservation', {
    id: e.id,
    building: document.getElementById('hoBld').value,
    location: document.getElementById('hoLoc').value,
    priority: document.getElementById('hoPri').value,
    responsible: document.getElementById('hoResp').value,
    observation: document.getElementById('hoText').value,
    requiredAction: document.getElementById('hoAct').value,
    foundOn: document.getElementById('hoFound').value,
    targetOn: t.value,
    remarks: document.getElementById('hoRem').value,
    photos: e.photos
  }).then(function (d) {
    hsUpsert_(_hs.obs, d.observation);
    _hs.obs.sort(function (a, b) { return a.num - b.num; });
    hsCloseModal_();
    hsSetMsg_('hsObsMsg', (e.id ? 'Saved ' : 'Added ') + hsNo_(d.observation.num) + '.');
    hsRender_();
  }).catch(function (err) {
    btn.disabled = false;
    hsSetMsg_('hoMsg', err.message, true);
  });
}

function hsSetObsStatus_(status) {
  var e = _hsEdit;
  if (!e || e.type !== 'obs' || !e.id) return;
  if (e.uploading) { hsSetMsg_('hoMsg', 'Wait for the photos to finish uploading.', true); return; }
  hsSetMsg_('hoMsg', 'Saving…');
  hsApi_('setHseObservationStatus', {
    id: e.id,
    status: status,
    closedOn: document.getElementById('hoClosedOn') ? document.getElementById('hoClosedOn').value : '',
    closedPhotos: e.closedPhotos
  }).then(function (d) {
    hsUpsert_(_hs.obs, d.observation);
    hsSetMsg_('hsObsMsg', hsNo_(d.observation.num) + ' is now ' + HS_STATUS[status] + '.');
    hsCloseModal_();
    hsRender_();
  }).catch(function (err) { hsSetMsg_('hoMsg', err.message, true); });
}

function hsDeleteObs_(sure) {
  var e = _hsEdit;
  if (!e || !e.id) return;
  var btn = document.getElementById('hoDel');
  if (!sure) {
    btn.textContent = 'Click again to delete';
    btn.onclick = function () { hsDeleteObs_(true); };
    return;
  }
  btn.disabled = true;
  hsApi_('deleteHseObservation', { id: e.id }).then(function () {
    _hs.obs = _hs.obs.filter(function (o) { return o.id !== e.id; });
    hsCloseModal_();
    hsSetMsg_('hsObsMsg', 'Deleted.');
    hsRender_();
  }).catch(function (err) { btn.disabled = false; hsSetMsg_('hoMsg', err.message, true); });
}

function hsUpsert_(arr, row) {
  for (var i = 0; i < arr.length; i++) if (arr[i].id === row.id) { arr[i] = row; return; }
  arr.push(row);
}

// ---------------------------------------------------------------------------
// Incidents & alarms
// ---------------------------------------------------------------------------
function hsRenderEvents_() {
  var host = document.getElementById('hsEvList');
  if (!_hs.events.length) {
    host.innerHTML = empireEmptyHtml('No incidents or alarms logged', 'A month with nothing here reports 0 incidents, 0 accidents and 0 LTI.');
    return;
  }
  host.innerHTML = '<div class="dt-table-wrap"><table class="hs-table"><thead><tr><th class="n">Date</th><th>Type</th><th>Where</th><th>Cause</th><th>Outcome</th><th>Injury</th><th>Photos</th><th>Status</th></tr></thead><tbody>' +
    _hs.events.map(function (e) {
      return '<tr onclick="hsEditEvent_(\'' + hsEsc_(e.id) + '\')"><td class="n">' + hsEsc_(hsWhen_(e.happenedAt)) + '</td>' +
        '<td><strong>' + hsEsc_(hsKindLabel_(e.kind)) + '</strong></td>' +
        '<td>' + hsEsc_(e.building) + (e.location ? '<div class="hs-sub">' + hsEsc_(e.location) + '</div>' : '') + '</td>' +
        '<td>' + hsEsc_(e.cause || '—') + '</td><td>' + hsEsc_(e.outcome || '—') + '</td>' +
        '<td>' + (e.lostTime ? '<span class="hs-late">LTI · ' + e.daysLost + ' days</span>' : (e.injury ? '<span class="hs-late">Yes</span>' : 'No')) + '</td>' +
        '<td>' + hsThumbs_(e.photos) + '</td>' +
        '<td>' + hsStPill_(e.status) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function hsFindEvent_(id) {
  for (var i = 0; i < _hs.events.length; i++) if (_hs.events[i].id === id) return _hs.events[i];
  return null;
}

function hsEditEvent_(id) {
  var e = id ? hsFindEvent_(id) : null;
  if (id && !e) return;
  var ro = !_hs.canWrite, dis = ro ? ' disabled' : '';
  _hsEdit = { type: 'event', id: id, photos: e ? e.photos.slice() : [], photoTarget: 'photos' };
  var at = e ? new Date(e.happenedAt) : new Date();
  var atVal = hsDay_(at) + 'T' + hsZ_(at.getHours()) + ':' + hsZ_(at.getMinutes());
  var bldList = '<datalist id="hsBldList">' + HS_BUILDINGS.map(function (b) { return '<option value="' + hsEsc_(b) + '">'; }).join('') + '</datalist>';
  var h = '<h2 style="margin-top:0">' + (e ? hsEsc_(hsKindLabel_(e.kind)) + ' ' + hsStPill_(e.status) : 'Log incident / alarm') + '</h2>' + bldList +
    '<div class="hs-form">' +
    '<div class="form-group"><label for="heKind">Type</label><select id="heKind"' + dis + '>' + HS_KINDS.map(function (k) {
      return '<option value="' + k.key + '"' + ((e ? e.kind : 'false_alarm') === k.key ? ' selected' : '') + '>' + k.label + '</option>';
    }).join('') + '</select></div>' +
    '<div class="form-group"><label for="heAt">Date &amp; time</label><input type="datetime-local" id="heAt" value="' + atVal + '"' + dis + '></div>' +
    '<div class="form-group"><label for="heBld">Building / area</label><input id="heBld" list="hsBldList" value="' + hsEsc_(e ? e.building : '') + '"' + dis + '></div>' +
    '<div class="form-group"><label for="heLoc">Exact place</label><input id="heLoc" value="' + hsEsc_(e ? e.location : '') + '"' + dis + '></div>' +
    '<div class="form-group hs-wide"><label for="heCause">Cause (what happened)</label><textarea id="heCause"' + dis + '>' + hsEsc_(e ? e.cause : '') + '</textarea></div>' +
    '<div class="form-group hs-wide"><label for="heOut">Outcome and follow-up</label><textarea id="heOut"' + dis + '>' + hsEsc_(e ? e.outcome : '') + '</textarea></div>' +
    '<div class="form-group"><label class="hs-check"><input type="checkbox" id="heInj"' + (e && e.injury ? ' checked' : '') + dis + '> Someone was injured</label></div>' +
    '<div class="form-group"><label class="hs-check"><input type="checkbox" id="heLti"' + (e && e.lostTime ? ' checked' : '') + dis + ' onchange="document.getElementById(\'heDaysWrap\').style.display=this.checked?\'\':\'none\'"> Lost time injury (LTI)</label></div>' +
    '<div class="form-group" id="heDaysWrap" style="' + (e && e.lostTime ? '' : 'display:none') + '"><label for="heDays">Days lost</label><input type="number" min="0" id="heDays" value="' + (e ? e.daysLost : 0) + '"' + dis + '></div>' +
    '<div class="form-group"><label for="heStatus">Status</label><select id="heStatus"' + dis + '>' + ['open', 'closed'].map(function (s) {
      return '<option value="' + s + '"' + ((e ? e.status : 'open') === s ? ' selected' : '') + '>' + HS_STATUS[s] + '</option>';
    }).join('') + '</select></div>' +
    '<div class="form-group hs-wide"><label>Photos</label><div class="hs-photo-edit" id="hePhotos"></div></div>' +
    '</div><div class="dt-actions" style="margin-top:18px">' +
    (ro ? '' : '<button type="button" class="dt-primary" id="heSave" onclick="hsSaveEvent_()">Save</button>') +
    '<button type="button" onclick="hsCloseModal_()">' + (ro ? 'Close' : 'Cancel') + '</button>' +
    (e && !ro ? '<button type="button" class="dt-danger" id="heDel" onclick="hsDeleteEvent_(false)" style="margin-left:auto">Delete</button>' : '') +
    '<span id="heMsg" class="dt-msg" aria-live="polite"></span></div>';
  hsOpenModal_(h);
  hsDrawPhotos_();
}

function hsSaveEvent_() {
  var e = _hsEdit;
  if (!e || e.type !== 'event') return;
  if (e.uploading) { hsSetMsg_('heMsg', 'Wait for the photos to finish uploading.', true); return; }
  var atRaw = document.getElementById('heAt').value;
  var at = atRaw ? new Date(atRaw) : null;
  if (!at || isNaN(at.getTime())) { hsSetMsg_('heMsg', 'Choose the date and time.', true); return; }
  var btn = document.getElementById('heSave');
  btn.disabled = true;
  hsSetMsg_('heMsg', 'Saving…');
  hsApi_('saveHseEvent', {
    id: e.id,
    kind: document.getElementById('heKind').value,
    happenedAt: at.toISOString(),
    building: document.getElementById('heBld').value,
    location: document.getElementById('heLoc').value,
    cause: document.getElementById('heCause').value,
    outcome: document.getElementById('heOut').value,
    injury: document.getElementById('heInj').checked,
    lostTime: document.getElementById('heLti').checked,
    daysLost: document.getElementById('heDays').value,
    status: document.getElementById('heStatus').value,
    photos: e.photos
  }).then(function (d) {
    hsUpsert_(_hs.events, d.event);
    _hs.events.sort(function (a, b) { return a.happenedAt < b.happenedAt ? 1 : -1; });
    hsCloseModal_();
    hsSetMsg_('hsEvMsg', 'Saved.');
    hsRender_();
  }).catch(function (err) { btn.disabled = false; hsSetMsg_('heMsg', err.message, true); });
}

function hsDeleteEvent_(sure) {
  var e = _hsEdit;
  if (!e || !e.id) return;
  var btn = document.getElementById('heDel');
  if (!sure) {
    btn.textContent = 'Click again to delete';
    btn.onclick = function () { hsDeleteEvent_(true); };
    return;
  }
  btn.disabled = true;
  hsApi_('deleteHseEvent', { id: e.id }).then(function () {
    _hs.events = _hs.events.filter(function (x) { return x.id !== e.id; });
    hsCloseModal_();
    hsSetMsg_('hsEvMsg', 'Deleted.');
    hsRender_();
  }).catch(function (err) { btn.disabled = false; hsSetMsg_('heMsg', err.message, true); });
}

// ---------------------------------------------------------------------------
// Safety performance (workforce numbers are saved per month)
// ---------------------------------------------------------------------------
function hsFmt_(n, dp) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); }

function hsRenderPerf_(s) {
  var mr = s.monthRow, dis = _hs.canWrite ? '' : ' disabled';
  var stat = function (v, label, cls) {
    return '<div class="stat-box ' + (cls || '') + '"><div class="stat-value">' + v + '</div><div class="stat-label">' + hsEsc_(label) + '</div></div>';
  };
  var h = '<h2 style="margin:0">' + hsEsc_(hsMonthName_(s.month)) + '</h2>' +
    '<p class="dt-hint">Type the three workforce numbers once a month. Man-hours and the rates are worked out from them and from the incident log.</p>' +
    '<div class="form-row">' +
    '<div class="form-group"><label for="hpWork">Daily workforce</label><input type="number" min="0" id="hpWork" value="' + (mr.workforce || '') + '" placeholder="e.g. 189"' + dis + '></div>' +
    '<div class="form-group"><label for="hpDays">Working days</label><input type="number" min="0" max="31" id="hpDays" value="' + (mr.workingDays || '') + '" placeholder="e.g. 26"' + dis + '></div>' +
    '<div class="form-group"><label for="hpHours">Hours per day</label><input type="number" min="0" max="24" id="hpHours" value="' + (mr.hoursPerDay || 8) + '"' + dis + '></div>' +
    (_hs.canWrite ? '<div class="form-group"><label>&nbsp;</label><button type="button" class="dt-primary" id="hpSave" onclick="hsSavePerf_()">Save numbers</button></div>' : '') +
    '</div><span id="hpMsg" class="dt-msg" aria-live="polite"></span>' +
    (s.manHours ? '' : '<p class="dt-hint hs-late">No workforce numbers for this month yet, so man-hours and rates show 0.</p>') +
    '<div class="stats">' +
    stat(hsFmt_(s.manHours), 'Total man-hours', 'hs-stat-ok') +
    stat(hsFmt_(s.manHours - s.hoursLost), 'Safe man-hours', 'hs-stat-ok') +
    stat(s.incidents, 'Incidents', s.incidents ? 'hs-stat-bad' : 'hs-stat-ok') +
    stat(s.accidents, 'Accidents', s.accidents ? 'hs-stat-bad' : 'hs-stat-ok') +
    stat(s.lti, 'Lost time injuries', s.lti ? 'hs-stat-bad' : 'hs-stat-ok') +
    stat(hsFmt_(s.ltifr, 2), 'LTIFR · per 1M hours', s.lti ? 'hs-stat-bad' : 'hs-stat-ok') +
    stat(hsFmt_(s.trir, 2), 'TRIR · per 200k hours', s.injuries ? 'hs-stat-bad' : 'hs-stat-ok') +
    stat(s.nearMiss, 'Near misses', '') +
    '</div>' +
    '<p class="dt-hint">LTIFR = LTI × 1,000,000 ÷ man-hours. TRIR = injuries × 200,000 ÷ man-hours. Man-hours = workforce × days × hours.</p>';
  document.getElementById('hsPerf').innerHTML = h;
}

function hsMonthPayload_(m) {
  var mr = hsMonthRow_(m) || {};
  return {
    month: m, workforce: mr.workforce || 0, workingDays: mr.workingDays || 0, hoursPerDay: mr.hoursPerDay || 8,
    overallStatus: mr.overallStatus || '', summary: mr.summary || '', improved: mr.improved || ''
  };
}
function hsSaveMonth_(payload, msgId, btnId) {
  var btn = document.getElementById(btnId);
  if (btn) btn.disabled = true;
  hsSetMsg_(msgId, 'Saving…');
  return hsApi_('saveHseMonth', payload).then(function (d) {
    hsUpsert_(_hs.months, d.month);
    for (var i = 0; i < _hs.months.length; i++) if (_hs.months[i].month === d.month.month) _hs.months[i] = d.month;
    hsRender_();
    hsSetMsg_(msgId, 'Saved.');
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    hsSetMsg_(msgId, err.message, true);
  });
}
function hsSavePerf_() {
  var p = hsMonthPayload_(hsMonth_());
  p.workforce = +document.getElementById('hpWork').value || 0;
  p.workingDays = +document.getElementById('hpDays').value || 0;
  p.hoursPerDay = +document.getElementById('hpHours').value || 0;
  hsSaveMonth_(p, 'hpMsg', 'hpSave');
}

// ---------------------------------------------------------------------------
// Monthly report (on screen, print / PDF, Excel)
// ---------------------------------------------------------------------------
function hsDefaultStatus_(s) {
  if (s.incidents || s.lti) return 'ATTENTION — incidents this month';
  return s.open ? 'STABLE — Corrective Actions Required' : 'STABLE';
}
function hsKpiRows_(s) {
  var good = function (v) { return v ? 'Review' : 'Good'; };
  var follow = function (v) { return v ? 'Follow-up Required' : 'Good'; };
  return [
    ['HSE Incidents', s.incidents, good(s.incidents)],
    ['Accidents', s.accidents, good(s.accidents)],
    ['Lost Time Injuries (LTI)', s.lti, good(s.lti)],
    ['Near misses', s.nearMiss, s.nearMiss ? 'Follow-up' : 'Good'],
    ['Unsafe Conditions (open observations)', s.open, follow(s.open)],
    ['of which High priority', s.high, follow(s.high)],
    ['of which Medium priority', s.medium, follow(s.medium)],
    ['Past target date', s.late, follow(s.late)],
    ['Closed this month', s.closed, s.closed ? 'Good' : '—'],
    ['Fire Alarm / False Alarm', s.alarms, s.alarms ? 'Follow-up' : 'Good'],
    ['Security / Safety Events', s.security, good(s.security)]
  ];
}
function hsReportObs_(m) { return _hs.obs.filter(function (o) { return hsInMonth_(o, m); }); }

function hsRenderReport_(s) {
  var mr = s.monthRow, m = s.month, ro = !_hs.canWrite;
  var dis = ro ? ' disabled' : '';
  // Edit box (not printed)
  document.getElementById('hsRepEdit').innerHTML =
    '<div class="hs-form">' +
    '<div class="form-group hs-wide"><label for="hrStatus">Overall status (blank = worked out: ' + hsEsc_(hsDefaultStatus_(s)) + ')</label><input id="hrStatus" value="' + hsEsc_(mr.overallStatus || '') + '"' + dis + '></div>' +
    '<div class="form-group hs-wide"><label for="hrSummary">Executive summary</label><textarea id="hrSummary" style="min-height:180px"' + dis + '>' + hsEsc_(mr.summary || '') + '</textarea></div>' +
    '<div class="form-group hs-wide"><label for="hrImproved">Completed / improved this month (one per line)</label><textarea id="hrImproved"' + dis + '>' + hsEsc_(mr.improved || '') + '</textarea></div>' +
    '</div>' +
    (ro ? '' : '<div class="dt-actions"><button type="button" class="dt-primary" id="hrSave" onclick="hsSaveReportText_()">Save report text</button><span id="hrMsg" class="dt-msg" aria-live="polite"></span></div>');

  var obs = hsReportObs_(m);
  var asOf = s.asOf;
  var carried = obs.filter(function (o) { return o.foundOn < s.range.start && hsOpenAt_(o, asOf); });
  var closedNow = obs.filter(function (o) { return o.status === 'closed' && o.closedOn >= s.range.start && o.closedOn <= s.range.end; });
  var improved = String(mr.improved || '').split(/\n+/).map(function (x) { return x.replace(/^[\s•\-–]+/, '').trim(); }).filter(Boolean);
  var who = 'Prepared by: ' + hsPretty_(mr.updatedBy || hsMe_());
  var h = '<div class="hs-report">' +
    '<h2>SECURITY &amp; HSE MONTHLY REPORT — ' + hsEsc_(hsMonthName_(m).toUpperCase()) + '</h2>' +
    '<p class="hs-meta">Empire World | Buildings C1 to C6 | ' + hsEsc_(who) + ' | Reporting Period: ' + hsEsc_(hsNice_(s.range.start)) + ' – ' + hsEsc_(hsNice_(s.range.end)) + '</p>' +
    '<p><strong>Overall Status:</strong> ' + hsEsc_(mr.overallStatus || hsDefaultStatus_(s)) + '</p>' +
    '<h3>Executive Summary</h3>' + (mr.summary ? '<div class="hs-summary">' + hsEsc_(mr.summary) + '</div>' : '<p class="hs-empty-note">No summary written yet.</p>') +
    '<h3>HSE KPI / Monthly Statistics</h3><table><thead><tr><th>HSE Indicator</th><th class="n">' + hsEsc_(hsMonthName_(m)) + '</th><th>Status</th></tr></thead><tbody>' +
    hsKpiRows_(s).map(function (r) { return '<tr><td>' + hsEsc_(r[0]) + '</td><td class="n">' + r[1] + '</td><td>' + hsEsc_(r[2]) + '</td></tr>'; }).join('') +
    '</tbody></table>';
  h += '<h3>Incidents, Fire Alarms &amp; Safety Events</h3>' + (s.events.length ? '<table><thead><tr><th>Date</th><th>Event</th><th>Where</th><th>Cause</th><th>Outcome</th><th>Status</th></tr></thead><tbody>' +
    s.events.map(function (e) {
      return '<tr><td class="n">' + hsEsc_(hsWhen_(e.happenedAt)) + '</td><td>' + hsEsc_(hsKindLabel_(e.kind)) + '</td><td>' + hsEsc_(e.building + (e.location ? ' – ' + e.location : '')) +
        '</td><td>' + hsEsc_(e.cause) + '</td><td>' + hsEsc_(e.outcome) + '</td><td>' + hsEsc_(HS_STATUS[e.status] || e.status) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p>No incidents, accidents or alarms were logged this month.</p>');
  h += '<h3>Completed / Improved</h3>' + (improved.length || closedNow.length ? '<ul>' +
    improved.map(function (x) { return '<li>' + hsEsc_(x) + '</li>'; }).join('') +
    closedNow.map(function (o) { return '<li>' + hsNo_(o.num) + ' closed: ' + hsEsc_(o.building + ' – ' + o.location) + '</li>'; }).join('') + '</ul>' : '<p class="hs-empty-note">Nothing listed.</p>');
  h += '<h3>Previous Month Observations — Still Open (' + carried.length + ')</h3>' + (carried.length ? '<ul>' + carried.map(function (o) {
    return '<li>' + hsNo_(o.num) + ' · ' + hsEsc_(o.building + ' – ' + o.location) + ': ' + hsEsc_(o.observation) + '</li>';
  }).join('') + '</ul>' : '<p class="hs-empty-note">None.</p>');

  h += '<div class="hs-page-break"></div><h3>Monthly Safety Performance</h3><table><thead><tr><th>Indicator</th><th class="n">Value</th><th>Unit</th></tr></thead><tbody>' +
    [['Daily Workforce', hsFmt_(mr.workforce), 'workers'], ['Working Days', hsFmt_(mr.workingDays), 'days'], ['Hours per Day', hsFmt_(mr.hoursPerDay), 'hours'],
      ['Total Man-Hours', hsFmt_(s.manHours), 'man-hours'], ['Safe Man-Hours', hsFmt_(s.manHours - s.hoursLost), 'man-hours'],
      ['Incidents', s.incidents, 'count'], ['Accidents', s.accidents, 'count'], ['LTI', s.lti, 'count'],
      ['LTIFR', hsFmt_(s.ltifr, 2), 'per 1M hrs'], ['TRIR', hsFmt_(s.trir, 2), 'per 200k hrs']].map(function (r) {
      return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td>' + r[2] + '</td></tr>';
    }).join('') + '</tbody></table>';

  h += '<div class="hs-page-break"></div><h3>HSE Observation Register &amp; Corrective Action Plan (' + obs.length + ')</h3>' +
    (obs.length ? '<div class="dt-table-wrap"><table><thead><tr><th>No.</th><th>Location</th><th>Observation</th><th>Priority</th><th>Required Action</th><th>Responsible</th><th class="n">Target</th><th>Status</th><th>Photos</th></tr></thead><tbody>' +
      obs.map(function (o) {
        var late = hsIsLate_(o, asOf);
        var stNow = hsOpenAt_(o, asOf) ? (o.status === 'in_progress' ? 'in_progress' : 'open') : 'closed';
        return '<tr><td class="n">' + hsNo_(o.num) + '</td><td>' + hsEsc_(o.building + ' – ' + o.location) + '</td><td>' + hsEsc_(o.observation) +
          (o.remarks ? '<div class="hs-sub">' + hsEsc_(o.remarks) + '</div>' : '') + '</td><td>' + hsEsc_(o.priority) + '</td><td>' + hsEsc_(o.requiredAction) +
          '</td><td>' + hsEsc_(o.responsible) + '</td><td class="n' + (late ? ' hs-late' : '') + '">' + hsEsc_(o.targetOn) + (late ? ' (late)' : '') + '</td><td>' +
          hsEsc_(HS_STATUS[stNow]) + (stNow === 'closed' && o.closedOn ? ' ' + hsEsc_(o.closedOn) : '') + '</td><td class="n">' + (o.photos.length || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="hs-empty-note">No observations this month.</p>');

  var withPhotos = obs.filter(function (o) { return o.photos.length || o.closedPhotos.length; });
  h += '<div class="hs-page-break"></div><h3>Photo Evidence</h3>' + (withPhotos.length ? withPhotos.map(function (o) {
    return '<div class="hs-photo-block"><strong>' + hsNo_(o.num) + ' · ' + hsEsc_(o.building + ' – ' + o.location) + '</strong>' +
      '<div class="hs-photo-row">' + o.photos.map(function (u) { return '<img src="' + hsEsc_(u) + '" alt="">'; }).join('') + '</div>' +
      (o.closedPhotos.length ? '<div class="hs-sub">After the fix</div><div class="hs-photo-row">' + o.closedPhotos.map(function (u) { return '<img src="' + hsEsc_(u) + '" alt="">'; }).join('') + '</div>' : '') +
      '</div>';
  }).join('') : '<p class="hs-empty-note">No photos attached this month.</p>');
  var noPhoto = obs.filter(function (o) { return !o.photos.length; });
  if (noPhoto.length) h += '<p class="hs-empty-note">No photo: ' + noPhoto.map(function (o) { return hsNo_(o.num); }).join(', ') + '</p>';
  h += '</div>';
  document.getElementById('hsReport').innerHTML = h;
}

function hsSaveReportText_() {
  var p = hsMonthPayload_(hsMonth_());
  p.overallStatus = document.getElementById('hrStatus').value;
  p.summary = document.getElementById('hrSummary').value;
  p.improved = document.getElementById('hrImproved').value;
  hsSaveMonth_(p, 'hrMsg', 'hrSave');
}

var _hsXlsxPromise = null;
function hsLoadXlsx_() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_hsXlsxPromise) return _hsXlsxPromise;
  _hsXlsxPromise = new Promise(function (resolve, reject) {
    var sc = document.createElement('script');
    sc.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    sc.onload = function () { resolve(window.XLSX); };
    sc.onerror = function () { _hsXlsxPromise = null; reject(new Error('Could not load Excel library. Check your internet connection.')); };
    document.head.appendChild(sc);
  });
  return _hsXlsxPromise;
}

/** Same five sheets as the HSE monthly Excel report. */
function hsExportExcel_() {
  var m = hsMonth_(), s = hsStats_(m), mr = s.monthRow;
  hsSetMsg_('hsRepMsg', 'Making Excel…');
  hsLoadXlsx_().then(function (XLSX) {
    var obs = hsReportObs_(m), asOf = s.asOf, name = hsMonthName_(m);
    var carried = obs.filter(function (o) { return o.foundOn < s.range.start && hsOpenAt_(o, asOf); });
    var closedNow = obs.filter(function (o) { return o.status === 'closed' && o.closedOn >= s.range.start && o.closedOn <= s.range.end; });
    var improved = String(mr.improved || '').split(/\n+/).map(function (x) { return x.replace(/^[\s•\-–]+/, '').trim(); }).filter(Boolean);
    var stNow = function (o) { return hsOpenAt_(o, asOf) ? HS_STATUS[o.status === 'in_progress' ? 'in_progress' : 'open'] : 'Closed'; };

    var sum = [
      ['SECURITY & HSE MONTHLY REPORT — ' + name.toUpperCase()], [],
      ['Empire World | Buildings C1 to C6 | Prepared by: ' + hsPretty_(mr.updatedBy || hsMe_()) + ' | Reporting Period: ' + hsNice_(s.range.start) + ' – ' + hsNice_(s.range.end)],
      ['Overall Status: ' + (mr.overallStatus || hsDefaultStatus_(s))],
      ['Executive Summary'], [mr.summary || ''], [],
      ['HSE KPI / Monthly Statistics'], ['HSE Indicator', name, 'Status']
    ].concat(hsKpiRows_(s)).concat([[], ['Incidents, Fire Alarms & Safety Events']]);
    if (s.events.length) {
      sum.push(['Date / Time', 'Event', 'Where', 'Cause', 'Outcome', 'Status']);
      s.events.forEach(function (e) {
        sum.push([hsWhen_(e.happenedAt), hsKindLabel_(e.kind), e.building + (e.location ? ' – ' + e.location : ''), e.cause, e.outcome, HS_STATUS[e.status] || e.status]);
      });
    } else sum.push(['None logged this month.']);
    sum.push([], ['Completed / Improved']);
    improved.forEach(function (x) { sum.push(['• ' + x]); });
    closedNow.forEach(function (o) { sum.push(['• ' + hsNo_(o.num) + ' closed: ' + o.building + ' – ' + o.location]); });
    sum.push([], ['Previous Month Observations — Still Open (Not Rectified)']);
    carried.forEach(function (o) { sum.push(['• ' + hsNo_(o.num) + ' ' + o.building + ' – ' + o.location + ': ' + o.observation]); });

    var reg = [['HSE Observation Register — ' + name], [], ['No.', 'Location', 'Observation', 'Priority', 'Status', 'Required Action', 'Photos']];
    obs.forEach(function (o) { reg.push([hsNo_(o.num), o.building + ' – ' + o.location, o.observation, o.priority, stNow(o), o.requiredAction, o.photos.length]); });

    var perf = [['MONTHLY SAFETY PERFORMANCE'], [], [name], [], ['Indicator', 'Value', 'Unit'],
      ['Daily Workforce', mr.workforce || 0, 'workers'], ['Working Days', mr.workingDays || 0, 'days'], ['Hours per Day', mr.hoursPerDay || 0, 'hours'],
      ['Total Man-Hours', s.manHours, 'man-hours'], ['Incidents', s.incidents, 'count'], ['Accidents', s.accidents, 'count'], ['LTI', s.lti, 'count'],
      ['Fatalities', 0, 'count'], [], ['Safety Rates', 'Value', 'Basis'],
      ['LTIFR', Math.round(s.ltifr * 100) / 100, 'per 1M hrs'], ['TRIR', Math.round(s.trir * 100) / 100, 'per 200k hrs'], ['Fatality Rate', 0, 'per 1M hrs'],
      [], ['Chart Data', 'Man-Hours'], ['Safe Man-Hours', s.manHours - s.hoursLost], ['Hours Lost to Incidents', s.hoursLost]];

    var plan = [['HSE Corrective Action Plan — ' + name], [],
      ['No.', 'Location', 'Observation', 'Priority', 'Required Action', 'Responsible', 'Status', 'Date Found', 'Target Date', 'Completion Date', 'Late', 'Remarks']];
    obs.forEach(function (o) {
      plan.push([hsNo_(o.num), o.building + ' – ' + o.location, o.observation, o.priority, o.requiredAction, o.responsible, stNow(o),
        o.foundOn, o.targetOn, (o.status === 'closed' && o.closedOn <= s.range.end) ? o.closedOn : '', hsIsLate_(o, asOf) ? 'Yes' : '', o.remarks]);
    });

    var photos = [['Photo Evidence — ' + name], [], ['No.', 'Location', 'Photo links (before)', 'Photo links (after the fix)']];
    obs.forEach(function (o) {
      photos.push([hsNo_(o.num), o.building + ' – ' + o.location, o.photos.join('\n') || 'No photo', o.closedPhotos.join('\n')]);
    });

    var wb = XLSX.utils.book_new();
    var add = function (aoa, title, cols) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = cols.map(function (w) { return { wch: w }; });
      XLSX.utils.book_append_sheet(wb, ws, title);
    };
    add(sum, 'Executive Summary', [42, 22, 22, 40, 40, 14]);
    add(reg, 'HSE Observations', [10, 30, 60, 10, 12, 50, 8]);
    add(perf, 'Incident & Accident', [26, 14, 14]);
    add(plan, 'Action Plan', [10, 30, 60, 10, 50, 24, 12, 12, 12, 14, 6, 40]);
    add(photos, 'Photo Evidence', [10, 30, 80, 80]);
    XLSX.writeFile(wb, 'HSE_Monthly_Report_' + name.replace(/\s+/g, '_') + '.xlsx');
    hsSetMsg_('hsRepMsg', 'Excel downloaded.');
  }).catch(function (err) { hsSetMsg_('hsRepMsg', err.message, true); });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(function hsBoot_() {
  function run() {
    empireAuthPageBoot({ dept: HS_LOGIN_DEPT, sendToHomeLogin: false, onEnter: hsEnter_ });
    if (empireGetToken() && typeof empireAuthRefreshPerms === 'function') {
      empireAuthRefreshPerms(function () { if (typeof empireApplySectionNav === 'function') empireApplySectionNav(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.getElementById('hsImgModal').classList.remove('show');
    hsCloseModal_();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && _hs.loaded && !_hsEdit) hsLoad_(false);
  });
})();
