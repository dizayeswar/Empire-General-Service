/* Application — door-to-door app registration checks (RA, WW, WD, ES) */

var APP_DEPT = 'application';
var APP_TZ = 'Asia/Baghdad';
var APP_TRASH_SHEETS = ['ApplicationIssues'];
var APP_AUTOCORRECT = {
  cant: "can't",
  dont: "don't",
  wont: "won't",
  didnt: "didn't",
  doesnt: "doesn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  shouldnt: "shouldn't",
  isnt: "isn't",
  wasnt: "wasn't",
  hasnt: "hasn't",
  havent: "haven't",
  thats: "that's",
  whats: "what's",
  theres: "there's",
  theyre: "they're",
  youre: "you're",
  im: "I'm",
  ive: "I've",
  teh: "the",
  adn: "and",
  taht: "that",
  wich: "which",
  becuase: "because",
  becasue: "because",
  appartment: "apartment",
  appartments: "apartments",
  recieve: "receive",
  recieved: "received",
  occured: "occurred",
  seperate: "separate",
  definately: "definitely",
  untill: "until",
  alot: "a lot"
};
var APP_PROJECTS = ['RA', 'WW', 'WD', 'ES'];
var APP_STATUS_OPTIONS = [
  '',
  'EMPTY',
  'ACTIVE',
  'NEW ACTIVE',
  'PENDING',
  'CHECK AGAIN',
  'TRY TO REACH',
  'HE DOESN\'T WANT THE APP'
];
var APP_SEED_URL = 'assets/application-seed.json?v=2026-07-22-application-v5';
var _appRows = [];
var _appSaving = {};
var _appSaveQueue = {};
var _appDetailId = '';
var _appExpectedTotal = 0;
var _appExpectedByProject = {};
var _appSeedItems = null;
var _appPendingDaily = null;
var _appPendingDailyLoading = null;
var _appIssues = [];
var _appIssueKind = 'customer';
var _appIssuePhotoUrl = '';
var _appIssuePhotoUploading = false;
var _appIssueSuggestIndex = -1;
var _appIssueTitleSuggestIndex = -1;
var _appIssueInfoId = '';

function appToken_() { return empireGetToken() || ''; }
function appEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function appAsk_(msg, opts, onOk) {
  if (typeof opts === 'function') {
    onOk = opts;
    opts = {};
  }
  opts = opts || {};
  if (typeof uiConfirm === 'function') {
    uiConfirm(msg, opts).then(function (ok) { if (ok) onOk(); });
    return;
  }
  if (window.confirm(msg)) onOk();
}

function appNote_(msg) {
  if (typeof uiAlert === 'function') {
    uiAlert(String(msg || ''));
    return;
  }
  window.alert(String(msg || ''));
}

function appPropertySortKey_(propertyId) {
  return String(propertyId || '').toUpperCase().split('-').map(function (part) {
    if (part === 'G') return '0';
    var m = part.match(/^([A-Z]*)(\d+)$/);
    if (m) return m[1] + ('00000' + m[2]).slice(-5);
    if (/^\d+$/.test(part)) return ('00000' + part).slice(-5);
    return part;
  }).join('\u0000');
}

function appSortRows_(rows) {
  return rows.slice().sort(function (a, b) {
    var ka = appPropertySortKey_(a.propertyId);
    var kb = appPropertySortKey_(b.propertyId);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return String(a.propertyId || '').localeCompare(String(b.propertyId || ''));
  });
}

function appStatusClass_(status) {
  var s = String(status || '').trim().toUpperCase();
  if (!s) return 'app-status-not-visited';
  if (s === 'EMPTY') return 'app-status-empty';
  if (s.indexOf('WANT') !== -1) return 'app-status-refused';
  if (s.indexOf('NEW ACTIVE') !== -1) return 'app-status-new-active';
  if (s === 'ACTIVE') return 'app-status-active';
  if (s === 'PENDING') return 'app-status-pending';
  if (s === 'CHECK AGAIN') return 'app-status-check-again';
  if (s === 'TRY TO REACH') return 'app-status-try-reach';
  return 'app-status-follow';
}

function appCountByProject_(rows) {
  var out = {};
  rows.forEach(function (r) {
    var p = String(r.project || '').toUpperCase();
    if (!p) return;
    out[p] = (out[p] || 0) + 1;
  });
  return out;
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

function appStatusColor_(status) {
  var s = String(status || '').trim().toUpperCase();
  if (!s) return '#d32f2f';
  if (s === 'EMPTY') return '#6d4c41';
  if (s.indexOf('WANT') !== -1) return '#9e9e9e';
  if (s.indexOf('NEW ACTIVE') !== -1) return '#95b825';
  if (s === 'ACTIVE') return '#2e7d32';
  if (s === 'PENDING') return '#29b6f6';
  if (s === 'CHECK AGAIN') return '#f9a825';
  if (s === 'TRY TO REACH') return '#1565c0';
  return '#e65100';
}

function appStatusLabel_(status) {
  var s = String(status || '').trim().toUpperCase();
  return s || 'Not visited';
}

function appSummaryFilteredRows_() {
  var project = String((document.getElementById('appSummaryProject') || {}).value || '').trim().toUpperCase();
  if (!project) return _appRows.slice();
  return _appRows.filter(function (r) {
    return String(r.project || '').toUpperCase() === project;
  });
}

function appStatusCounts_(rows) {
  var counts = {};
  rows.forEach(function (r) {
    var key = appStatusLabel_(r.status);
    counts[key] = (counts[key] || 0) + 1;
  });
  if (counts.EMPTY == null) counts.EMPTY = 0;
  return counts;
}

function appSummaryStatusOrder_(a, b, counts) {
  var order = {
    'ACTIVE': 1,
    'NEW ACTIVE': 2,
    'PENDING': 3,
    'CHECK AGAIN': 4,
    'TRY TO REACH': 5,
    'HE DOESN\'T WANT THE APP': 6,
    'EMPTY': 7,
    'Not visited': 9
  };
  var oa = order[a] || 50;
  var ob = order[b] || 50;
  if (oa !== ob) return oa - ob;
  return counts[b] - counts[a];
}

function appDonutHtml_(segments, total) {
  if (!total) return '<p class="worker-empty">No apartments for this project yet.</p>';
  var offset = 25;
  var circles = '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="5"></circle>';
  segments.forEach(function (seg) {
    if (!seg.count) return;
    var pct = seg.count / total * 100;
    circles += '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + appEsc_(seg.color) + '" stroke-width="5" stroke-dasharray="' + pct + ' ' + (100 - pct) + '" stroke-dashoffset="' + offset + '"></circle>';
    offset -= pct;
  });
  var legend = segments.map(function (seg) {
    if (!seg.count) return '';
    var pct = Math.round(seg.count / total * 100);
    return '<div class="app-donut-legend-item">'
      + '<span class="app-donut-swatch" style="background:' + appEsc_(seg.color) + '"></span>'
      + '<span class="app-donut-legend-label">' + appEsc_(seg.label) + '</span>'
      + '<strong>' + seg.count + '</strong>'
      + '<span class="app-donut-legend-pct">' + pct + '%</span>'
      + '</div>';
  }).join('');
  return '<div class="app-donut-board">'
    + '<svg class="app-donut-chart" width="220" height="220" viewBox="0 0 42 42" aria-hidden="true">' + circles
    + '<text x="21" y="20.2" text-anchor="middle" class="app-donut-total">' + total + '</text>'
    + '<text x="21" y="26.2" text-anchor="middle" class="app-donut-sub">apartments</text></svg>'
    + '<div class="app-donut-legend">' + legend + '</div></div>';
}

function appMiniDonutHtml_(label, rows) {
  var counts = appStatusCounts_(rows);
  var total = rows.length;
  var active = (counts.ACTIVE || 0) + (counts['NEW ACTIVE'] || 0) + (counts['NEW ACTIVE REMOVED OLD'] || 0);
  var pending = (counts.PENDING || 0) + (counts['CHECK AGAIN'] || 0) + (counts['TRY TO REACH'] || 0) + (counts['COME BACK LATER'] || 0);
  var other = total - active - pending - (counts['Not visited'] || 0) - (counts.EMPTY || 0) - (counts['HE DOESN\'T WANT THE APP'] || 0);
  var segments = [
    { count: active, color: '#2e7d32' },
    { count: pending, color: '#1565c0' },
    { count: counts['Not visited'] || 0, color: '#d32f2f' },
    { count: counts.EMPTY || 0, color: '#6d4c41' },
    { count: other, color: '#9e9e9e' }
  ].filter(function (s) { return s.count > 0; });
  var offset = 25;
  var circles = '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="6"></circle>';
  if (total) {
    segments.forEach(function (seg) {
      var pct = seg.count / total * 100;
      circles += '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + seg.color + '" stroke-width="6" stroke-dasharray="' + pct + ' ' + (100 - pct) + '" stroke-dashoffset="' + offset + '"></circle>';
      offset -= pct;
    });
  }
  return '<div class="app-mini-donut"><svg width="96" height="96" viewBox="0 0 42 42">' + circles
    + '<text x="21" y="24" text-anchor="middle" class="app-mini-donut-num">' + total + '</text></svg>'
    + '<div class="app-mini-donut-label">' + appEsc_(label) + '</div></div>';
}

function appSummaryHtml_(rows) {
  var counts = appStatusCounts_(rows);
  var keys = Object.keys(counts).sort(function (a, b) {
    return appSummaryStatusOrder_(a, b, counts);
  });
  var total = rows.length;
  var segments = keys.map(function (k) {
    return { label: k, count: counts[k], color: appStatusColor_(k === 'Not visited' ? '' : k) };
  });
  var h = '<div class="app-summary-top"><strong>' + total + ' apartments</strong></div>';
  h += appDonutHtml_(segments, total);
  h += '<div class="app-summary-grid">';
  keys.forEach(function (k) {
    var cls = appStatusClass_(k === 'Not visited' ? '' : k);
    var label = k === 'Not visited' ? 'NOT VISITED' : k;
    h += '<div class="app-summary-card"><strong>' + counts[k] + '</strong>'
      + '<span class="app-summary-badge ' + cls + '">' + appEsc_(label) + '</span></div>';
  });
  h += '</div>';
  var projSel = String((document.getElementById('appSummaryProject') || {}).value || '');
  if (!projSel) {
    h += '<h3 class="app-summary-subhead">By project</h3><div class="app-mini-donut-row">';
    APP_PROJECTS.forEach(function (p) {
      var proRows = _appRows.filter(function (r) { return String(r.project || '').toUpperCase() === p; });
      h += appMiniDonutHtml_(p, proRows);
    });
    h += '</div>';
  }
  return h;
}

function appRenderSummary_() {
  var host = document.getElementById('appSummaryHost');
  if (!host) return;
  appPopulateSummaryFilters_();
  host.innerHTML = appSummaryHtml_(appSummaryFilteredRows_());
}

function appPopulateSummaryFilters_() {
  var sp = document.getElementById('appSummaryProject');
  if (sp && sp.options.length <= 1) {
    sp.innerHTML = '<option value="">All projects</option>'
      + APP_PROJECTS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
}

function appOnSummaryProjectChange_() {
  var sp = document.getElementById('appSummaryProject');
  var fp = document.getElementById('appFilterProject');
  if (sp && fp) fp.value = sp.value;
  appRenderTable_();
  appRenderSummary_();
  appRenderPendingDaily_();
}

function appPendingProject_() {
  return String((document.getElementById('appSummaryProject') || {}).value || '').trim().toUpperCase();
}

function appPendingDayTotal_(day) {
  if (!day) return 0;
  var project = appPendingProject_();
  if (!project) return Number(day.total || 0);
  return Number((day.byProject && day.byProject[project]) || 0);
}

function appPrettyDayLabel_(ymd, todayYmd) {
  var s = String(ymd || '');
  if (!s) return '—';
  if (s === todayYmd) return 'Today';
  var parts = s.split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return s;
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
}

function appPendingDailyHtml_() {
  if (!_appPendingDaily) {
    return '<div class="app-pending-board"><p class="app-pending-empty">Loading daily Pending counts…</p></div>';
  }
  if (_appPendingDaily.error) {
    return '<div class="app-pending-board"><p class="app-pending-empty">Could not load daily Pending counts. Refresh and try again.</p></div>';
  }
  var days = Array.isArray(_appPendingDaily.days) ? _appPendingDaily.days : [];
  var todayYmd = String(_appPendingDaily.today || '');
  var todayDay = days[0] && days[0].date === todayYmd ? days[0] : days.find(function (d) { return d.date === todayYmd; });
  var todayCount = appPendingDayTotal_(todayDay);
  var project = appPendingProject_();
  var chips = '';
  if (!project && todayDay && todayDay.byProject) {
    chips = APP_PROJECTS.map(function (p) {
      var n = Number(todayDay.byProject[p] || 0);
      if (!n) return '';
      return '<span class="app-pending-chip">' + p + ': ' + n + '</span>';
    }).join('');
  }
  var max = 0;
  days.forEach(function (d) {
    var n = appPendingDayTotal_(d);
    if (n > max) max = n;
  });
  var bars = days.map(function (d) {
    var n = appPendingDayTotal_(d);
    var pct = max ? Math.round(n / max * 100) : 0;
    if (n && pct < 4) pct = 4;
    var isToday = d.date === todayYmd;
    return '<div class="app-pending-day' + (isToday ? ' is-today' : '') + '">'
      + '<span class="app-pending-day-label">' + appEsc_(appPrettyDayLabel_(d.date, todayYmd)) + '</span>'
      + '<div class="app-pending-bar-track"><div class="app-pending-bar-fill" style="width:' + pct + '%"></div></div>'
      + '<span class="app-pending-day-count">' + n + '</span></div>';
  }).join('');
  return '<div class="app-pending-board">'
    + '<div class="app-pending-today">'
    + '<span class="app-pending-kicker">Set to Pending today</span>'
    + '<strong>' + todayCount + '</strong>'
    + '<span class="app-pending-sub">apartments' + (project ? (' · ' + appEsc_(project)) : '') + '</span>'
    + (chips ? '<div class="app-pending-projects">' + chips + '</div>' : '')
    + '</div>'
    + '<div class="app-pending-days">'
    + '<div class="app-pending-days-title">Last 14 days</div>'
    + (bars || '<p class="app-pending-empty">No Pending changes recorded yet.</p>')
    + '</div></div>';
}

function appRenderPendingDaily_() {
  var host = document.getElementById('appPendingDailyHost');
  if (!host) return;
  host.innerHTML = appPendingDailyHtml_();
}

function appLoadPendingDaily_(force) {
  if (!force && _appPendingDaily && !_appPendingDaily.error) {
    appRenderPendingDaily_();
    return Promise.resolve(_appPendingDaily);
  }
  if (!force && _appPendingDailyLoading) return _appPendingDailyLoading;
  appRenderPendingDaily_();
  _appPendingDailyLoading = fetchJSONRetry({
    action: 'getApplicationPendingDaily',
    token: appToken_()
  }, 1, 45000).then(function (d) {
    if (d && d.ok !== false && Array.isArray(d.days)) {
      _appPendingDaily = d;
    } else {
      _appPendingDaily = { error: true, days: [], today: '' };
    }
    appRenderPendingDaily_();
    return _appPendingDaily;
  }).catch(function () {
    _appPendingDaily = { error: true, days: [], today: '' };
    appRenderPendingDaily_();
    return _appPendingDaily;
  }).finally(function () {
    _appPendingDailyLoading = null;
  });
  return _appPendingDailyLoading;
}

function appBumpPendingDaily_(id, project) {
  if (!_appPendingDaily || _appPendingDaily.error || !Array.isArray(_appPendingDaily.days)) return;
  var today = String(_appPendingDaily.today || '');
  if (!today) return;
  _appPendingDaily.todayIds = _appPendingDaily.todayIds || {};
  var key = String(id || '');
  if (key && _appPendingDaily.todayIds[key]) return;
  if (key) _appPendingDaily.todayIds[key] = true;
  var day = _appPendingDaily.days.find(function (d) { return d.date === today; });
  if (!day) {
    day = { date: today, total: 0, byProject: {} };
    _appPendingDaily.days.unshift(day);
  }
  if (!day.byProject) day.byProject = {};
  var p = String(project || '').toUpperCase();
  day.total = Number(day.total || 0) + 1;
  if (p) day.byProject[p] = Number(day.byProject[p] || 0) + 1;
  appRenderPendingDaily_();
}

function appStatusDisplayLabel_(status) {
  var s = String(status || '').trim();
  return s ? s.toUpperCase() : 'NOT VISITED';
}

function appStatusSelectHtml_(id, value) {
  var stClass = appStatusClass_(value);
  var label = appStatusDisplayLabel_(value);
  var h = '<div class="app-status-dd" data-app-id="' + appEsc_(id) + '">'
    + '<button type="button" class="app-status-dd-btn ' + stClass + '" onclick="appStatusDdToggle_(event,this)">'
    + '<span class="app-status-dd-label">' + appEsc_(label) + '</span>'
    + '<span class="app-status-dd-caret" aria-hidden="true"></span>'
    + '</button>'
    + '<div class="app-status-dd-menu" role="listbox">';
  APP_STATUS_OPTIONS.forEach(function (opt) {
    var optClass = appStatusClass_(opt);
    var optLabel = appStatusDisplayLabel_(opt);
    var sel = String(value || '').toUpperCase() === String(opt || '').toUpperCase() ? ' app-status-dd-opt-selected' : '';
    h += '<button type="button" class="app-status-dd-opt ' + optClass + sel + '" data-value="' + appEsc_(opt) + '" onclick="appStatusDdPick_(event,this)">' + appEsc_(optLabel) + '</button>';
  });
  h += '</div>'
    + '<input type="hidden" data-app-field="status" value="' + appEsc_(value || '') + '">'
    + '</div>';
  return h;
}

function appStatusDdPosition_(btn, menu) {
  if (!btn || !menu) return;
  var r = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = r.left + 'px';
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.width = Math.max(r.width, 210) + 'px';
  menu.style.zIndex = '10000';
  menu.style.display = 'flex';
  var mh = menu.offsetHeight || 280;
  if (r.bottom + 4 + mh > window.innerHeight - 8) {
    menu.style.top = Math.max(8, r.top - mh - 4) + 'px';
  }
}

function appStatusDdBindMenu_(menu) {
  if (!menu || menu._appStatusDdBound) return;
  menu._appStatusDdBound = true;
  menu.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
  menu.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
  menu.addEventListener('click', function (e) { e.stopPropagation(); });
}

function appStatusDdCloseAll_() {
  document.querySelectorAll('.app-status-dd-menu-portal').forEach(function (menu) {
    var wrap = menu._appStatusDdWrap;
    menu.classList.remove('app-status-dd-menu-portal');
    menu.style.position = '';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
    menu.style.zIndex = '';
    menu.style.display = '';
    menu._appStatusDdWrap = null;
    if (wrap) {
      wrap.classList.remove('open');
      wrap.appendChild(menu);
    }
  });
  document.querySelectorAll('.app-status-dd.open').forEach(function (el) {
    el.classList.remove('open');
  });
}

function appStatusDdToggle_(ev, btn) {
  if (ev) ev.stopPropagation();
  var wrap = btn.closest('.app-status-dd');
  if (!wrap) return;
  var menu = wrap.querySelector('.app-status-dd-menu');
  var wasOpen = wrap.classList.contains('open');
  appStatusDdCloseAll_();
  if (wasOpen || !menu) return;
  wrap.classList.add('open');
  appStatusDdBindMenu_(menu);
  document.body.appendChild(menu);
  menu.classList.add('app-status-dd-menu-portal');
  menu._appStatusDdWrap = wrap;
  appStatusDdPosition_(btn, menu);
}

function appStatusDdOnOuterScroll_(ev) {
  var menu = document.querySelector('.app-status-dd-menu-portal');
  if (!menu) return;
  if (ev.target && (menu === ev.target || menu.contains(ev.target))) return;
  appStatusDdCloseAll_();
}

function appStatusDdPick_(ev, optBtn) {
  if (ev) ev.stopPropagation();
  var menu = optBtn.closest('.app-status-dd-menu');
  var wrap = (menu && menu._appStatusDdWrap) || optBtn.closest('.app-status-dd');
  if (!wrap) return;
  var value = optBtn.getAttribute('data-value') || '';
  var hidden = wrap.querySelector('[data-app-field="status"]');
  var btn = wrap.querySelector('.app-status-dd-btn');
  var labelEl = wrap.querySelector('.app-status-dd-label');
  if (hidden) hidden.value = value;
  if (btn) btn.className = 'app-status-dd-btn ' + appStatusClass_(value);
  if (labelEl) labelEl.textContent = appStatusDisplayLabel_(value);
  wrap.querySelectorAll('.app-status-dd-opt').forEach(function (el) {
    el.classList.toggle('app-status-dd-opt-selected', el === optBtn);
  });
  appStatusDdCloseAll_();
  appSaveRow_(wrap.getAttribute('data-app-id'), { status: value });
}

function appFormatDateTime_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '—';
  var iso = s;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) iso = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso)) iso += 'Z';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return s.length > 16 ? s.slice(0, 16) : s;
  try {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(d);
    var get = function (type) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
      return '';
    };
    var hour = get('hour');
    if (hour === '24') hour = '00';
    return get('year') + '-' + get('month') + '-' + get('day') + ' ' + hour + ':' + get('minute');
  } catch (err) {
    var z = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
}

function appFormatDate_(raw) {
  var dt = appFormatDateTime_(raw);
  if (!dt || dt === '—') return '—';
  return dt.slice(0, 10);
}

function appHistoryFieldLabel_(field) {
  return String(field || '').toLowerCase() === 'phone' ? 'Phone number' : 'Account status';
}

function appHistoryValueLabel_(field, value) {
  if (String(field || '').toLowerCase() === 'status') return appStatusDisplayLabel_(value);
  var p = String(value || '').replace(/\D/g, '');
  return p || '(empty)';
}

function appDetailHtml_(record, history) {
  var stClass = appStatusClass_(record.status);
  var h = '<div class="app-detail-grid">'
    + '<div class="app-detail-card"><label>Project</label><strong>' + appEsc_(record.project) + '</strong></div>'
    + '<div class="app-detail-card"><label>Property</label><strong>' + appEsc_(record.propertyId) + '</strong></div>'
    + '<div class="app-detail-card"><label>Phone</label><strong>' + appEsc_(record.phone || '—') + '</strong></div>'
    + '<div class="app-detail-card"><label>Account status</label><span class="app-detail-status ' + stClass + '">' + appEsc_(appStatusDisplayLabel_(record.status)) + '</span></div>'
    + '<div class="app-detail-card"><label>Last updated</label><span>' + appEsc_(appFormatDateTime_(record.updatedAt)) + '</span></div>'
    + '<div class="app-detail-card"><label>Updated by</label><span>' + appEsc_(record.updatedBy || '—') + '</span></div>'
    + '</div>';
  h += '<h3 class="app-detail-history-title">Change history</h3>';
  if (!history || !history.length) {
    h += '<div class="app-detail-history"><p class="app-detail-empty">No phone or status changes recorded yet.</p></div>';
    return h;
  }
  h += '<div class="app-detail-history">';
  history.forEach(function (item) {
    var oldL = appHistoryValueLabel_(item.field, item.oldValue);
    var newL = appHistoryValueLabel_(item.field, item.newValue);
    h += '<div class="app-detail-history-item">'
      + '<div class="app-detail-history-when">' + appEsc_(appFormatDateTime_(item.changedAt)) + '<br>' + appEsc_(item.changedBy || '—') + '</div>'
      + '<div class="app-detail-history-what"><strong>' + appEsc_(appHistoryFieldLabel_(item.field)) + '</strong>'
      + '<div class="app-detail-history-change">' + appEsc_(oldL) + ' → ' + appEsc_(newL) + '</div></div>'
      + '</div>';
  });
  h += '</div>';
  return h;
}

function appOpenDetail_(id) {
  if (!id) return;
  _appDetailId = String(id);
  var modal = document.getElementById('appDetailModal');
  var body = document.getElementById('appDetailBody');
  var title = document.getElementById('appDetailTitle');
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (title) title.textContent = row ? (row.project + ' · ' + row.propertyId) : 'Apartment';
  if (body) body.innerHTML = '<p>Loading apartment info…</p>';
  if (modal) modal.classList.add('show');
  fetchJSONRetry({ action: 'getApplicationCheckDetail', token: appToken_(), id: id }, 1, 45000).then(function (d) {
    if (!_appDetailId || String(_appDetailId) !== String(id)) return;
    if (!d || d.ok === false) {
      if (body) body.innerHTML = '<p class="worker-empty">' + appEsc_((d && (d.message || d.error)) || 'Could not load details') + '</p>';
      return;
    }
    if (title && d.record) title.textContent = d.record.project + ' · ' + d.record.propertyId;
    if (body) body.innerHTML = appDetailHtml_(d.record || {}, d.history || []);
  }).catch(function (e) {
    if (body) body.innerHTML = '<p class="worker-empty">' + appEsc_(String((e && e.message) || e || 'Load failed')) + '</p>';
  });
}

function appCloseDetail_() {
  _appDetailId = '';
  var modal = document.getElementById('appDetailModal');
  if (modal) modal.classList.remove('show');
}

function appRefreshDetailIfOpen_(id, history) {
  if (!_appDetailId || String(_appDetailId) !== String(id)) return;
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (!row) return;
  var body = document.getElementById('appDetailBody');
  var title = document.getElementById('appDetailTitle');
  if (title) title.textContent = row.project + ' · ' + row.propertyId;
  if (body) body.innerHTML = appDetailHtml_(row, history || []);
}

function appRowClick_(ev) {
  if (ev.target.closest('input, button, .app-status-dd, .app-status-dd-menu-portal')) return;
  var tr = ev.currentTarget;
  appOpenDetail_(tr ? tr.getAttribute('data-app-id') : '');
}

function appCountsHtml_() {
  var loaded = appCountByProject_(_appRows);
  var parts = APP_PROJECTS.map(function (p) {
    var have = loaded[p] || 0;
    var want = _appExpectedByProject[p] || 0;
    var cls = want && have < want ? ' app-count-warn' : '';
    return '<span class="app-count-chip' + cls + '">' + p + ': ' + have + (want ? (' / ' + want) : '') + '</span>';
  });
  var total = _appRows.length;
  var expected = _appExpectedTotal || 0;
  var head = '<div class="app-counts-bar">';
  head += '<strong>' + total + (expected ? (' / ' + expected) : '') + ' apartments loaded</strong>';
  head += '<div class="app-count-chips">' + parts.join('') + '</div>';
  head += '</div>';
  return head;
}

function appRenderTable_() {
  var host = document.getElementById('appTableHost');
  if (!host) return;
  var rows = appFilteredRows_();
  if (!rows.length) {
    host.innerHTML = appCountsHtml_() + '<p class="worker-empty">No properties match your filters.</p>';
    return;
  }
  var h = appCountsHtml_();
  h += '<div class="app-table-wrap"><table class="app-table"><thead><tr>'
    + '<th>Property</th><th>Phone</th><th>Account status</th><th>Updated</th>'
    + '</tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr class="app-row-clickable" data-app-id="' + appEsc_(r.id) + '" onclick="appRowClick_(event)">'
      + '<td><strong class="app-property-link">' + appEsc_(r.propertyId) + '</strong></td>'
      + '<td><input type="text" class="app-phone-input" inputmode="numeric" data-app-id="' + appEsc_(r.id) + '" data-app-field="phone" value="' + appEsc_(r.phone || '') + '" onchange="appSaveRow_(this.getAttribute(\'data-app-id\'))"></td>'
      + '<td>' + appStatusSelectHtml_(r.id, r.status) + '</td>'
      + '<td class="app-updated-cell">' + appEsc_(appFormatDate_(r.updatedAt)) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<p style="margin-top:10px;font-size:13px;color:var(--text-soft);">' + rows.length + ' shown</p>';
  host.innerHTML = h;
}

function appFindTableRow_(id) {
  var want = String(id || '');
  var rows = document.querySelectorAll('tr[data-app-id]');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].getAttribute('data-app-id') || '') === want) return rows[i];
  }
  return null;
}

function appMarkRowSaving_(id, saving) {
  var tr = appFindTableRow_(id);
  if (!tr) return;
  tr.classList.toggle('app-row-saving', !!saving);
  var cell = tr.querySelector('.app-updated-cell');
  if (!cell) return;
  if (saving) cell.textContent = 'Saving…';
  else {
    var row = _appRows.find(function (x) { return String(x.id) === String(id); });
    cell.textContent = row && row.updatedAt ? appFormatDate_(row.updatedAt) : '—';
  }
}

function appPaintRow_(id, row) {
  var tr = appFindTableRow_(id);
  if (!tr || !row) return;
  var phoneEl = tr.querySelector('[data-app-field="phone"]');
  if (phoneEl && phoneEl !== document.activeElement) phoneEl.value = row.phone || '';
  var wrap = tr.querySelector('.app-status-dd');
  if (wrap) {
    var status = String(row.status || '');
    var hidden = wrap.querySelector('[data-app-field="status"]');
    var btn = wrap.querySelector('.app-status-dd-btn');
    var labelEl = wrap.querySelector('.app-status-dd-label');
    if (hidden) hidden.value = status;
    if (btn) btn.className = 'app-status-dd-btn ' + appStatusClass_(status);
    if (labelEl) labelEl.textContent = appStatusDisplayLabel_(status);
    wrap.querySelectorAll('.app-status-dd-opt').forEach(function (el) {
      el.classList.toggle(
        'app-status-dd-opt-selected',
        String(el.getAttribute('data-value') || '').toUpperCase() === status.toUpperCase()
      );
    });
  }
  if (!_appSaving[id]) {
    var cell = tr.querySelector('.app-updated-cell');
    if (cell) cell.textContent = row.updatedAt ? appFormatDate_(row.updatedAt) : '—';
  }
}

function appResolveRowPatch_(id, row, patch) {
  patch = patch || {};
  var tr = appFindTableRow_(id);
  var phoneEl = tr ? tr.querySelector('[data-app-field="phone"]') : null;
  var statusEl = tr ? tr.querySelector('[data-app-field="status"]') : null;
  var phone = patch.phone != null
    ? String(patch.phone || '').replace(/\D/g, '')
    : (phoneEl ? String(phoneEl.value || '').replace(/\D/g, '') : String(row.phone || ''));
  var status = patch.status != null
    ? String(patch.status || '')
    : (statusEl ? String(statusEl.value || '') : String(row.status || ''));
  return { phone: phone, status: status };
}

function appSaveRow_(id, patch) {
  patch = patch || {};
  var row = _appRows.find(function (x) { return String(x.id) === String(id); });
  if (!row) return;
  var next = appResolveRowPatch_(id, row, patch);
  var baseline = { phone: String(row.phone || ''), status: String(row.status || ''), updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  row.phone = next.phone;
  row.status = next.status;
  appPaintRow_(id, row);

  if (_appSaving[id]) {
    _appSaveQueue[id] = { phone: next.phone, status: next.status };
    return;
  }

  _appSaving[id] = true;
  appMarkRowSaving_(id, true);
  var sentPhone = next.phone;
  var sentStatus = next.status;
  fetchJSONRetry({
    action: 'updateApplicationCheck',
    token: appToken_(),
    id: id,
    project: row.project,
    propertyId: row.propertyId,
    phone: sentPhone,
    status: sentStatus
  }, 2, 60000).then(function (d) {
    if (d && (d.ok || d.success)) {
      if (!_appSaveQueue[id] && String(row.phone || '') === sentPhone && String(row.status || '') === sentStatus) {
        row.phone = d.phone != null ? d.phone : sentPhone;
        row.status = d.status != null ? d.status : sentStatus;
        row.updatedAt = d.updatedAt || row.updatedAt;
        row.updatedBy = d.updatedBy || row.updatedBy;
        appPaintRow_(id, row);
        appRefreshDetailIfOpen_(id, d.history);
        appRenderSummary_();
        if (String(sentStatus || '').toUpperCase() === 'PENDING'
          && String(baseline.status || '').toUpperCase() !== 'PENDING') {
          appBumpPendingDaily_(id, row.project);
        }
      }
    } else {
      appNote_((d && (d.message || d.error)) || 'Could not save');
      if (!_appSaveQueue[id] && String(row.phone || '') === sentPhone && String(row.status || '') === sentStatus) {
        row.phone = baseline.phone;
        row.status = baseline.status;
        row.updatedAt = baseline.updatedAt;
        row.updatedBy = baseline.updatedBy;
        appPaintRow_(id, row);
      }
    }
  }).catch(function (e) {
    appNote_(String((e && e.message) || e || 'Save failed'));
    if (!_appSaveQueue[id] && String(row.phone || '') === sentPhone && String(row.status || '') === sentStatus) {
      row.phone = baseline.phone;
      row.status = baseline.status;
      row.updatedAt = baseline.updatedAt;
      row.updatedBy = baseline.updatedBy;
      appPaintRow_(id, row);
    }
  }).finally(function () {
    delete _appSaving[id];
    var queued = _appSaveQueue[id];
    if (queued) {
      delete _appSaveQueue[id];
      appSaveRow_(id, queued);
      return;
    }
    appMarkRowSaving_(id, false);
  });
}

function appPopulateFilters_() {
  var proj = document.getElementById('appFilterProject');
  if (proj && proj.options.length <= 1) {
    proj.innerHTML = '<option value="">All projects</option>'
      + APP_PROJECTS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
  appPopulateSummaryFilters_();
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

function appFetchProjectRows_(project, force) {
  return fetchJSONRetry({
    action: 'getApplicationChecks',
    token: appToken_(),
    project: project
  }, force ? 2 : 1, 120000).then(function (d) {
    return Array.isArray(d) ? d : [];
  });
}

function appRefreshIcons_() {
  return [
    document.getElementById('navRefreshIcon'),
    document.getElementById('listRefreshIcon')
  ].filter(Boolean);
}

function appSetRefreshSpinning_(on) {
  appRefreshIcons_().forEach(function (el) {
    if (on) el.classList.add('spinning');
    else el.classList.remove('spinning');
  });
}

function appLoad_(force) {
  var host = document.getElementById('appTableHost');
  if (host) host.innerHTML = '<p>Loading all projects (RA, WW, WD, ES)…</p>';
  appSetRefreshSpinning_(true);
  appLoadPendingDaily_(force);
  appIssueLoad_(force);
  return Promise.all(APP_PROJECTS.map(function (p) {
    return appFetchProjectRows_(p, force);
  })).then(function (parts) {
    _appRows = [];
    parts.forEach(function (rows) {
      _appRows = _appRows.concat(rows);
    });
    _appRows = appSortRows_(_appRows);
    appRenderTable_();
    appRenderSummary_();
  }).catch(function (e) {
    if (host) host.innerHTML = '<p class="worker-empty">Could not load data. ' + appEsc_((e && e.message) || e) + '</p>';
  }).finally(function () {
    appSetRefreshSpinning_(false);
  });
}

function appSeedMetaFromItems_(items) {
  _appExpectedTotal = items.length;
  _appExpectedByProject = {};
  items.forEach(function (it) {
    var p = String(it.project || '').toUpperCase();
    if (!p) return;
    _appExpectedByProject[p] = (_appExpectedByProject[p] || 0) + 1;
  });
}

function appEnsureSeedMeta_() {
  if (_appSeedItems && _appSeedItems.length) {
    appSeedMetaFromItems_(_appSeedItems);
    return Promise.resolve(_appSeedItems);
  }
  return fetch(APP_SEED_URL).then(function (r) { return r.json(); }).then(function (items) {
    if (!Array.isArray(items)) throw new Error('Seed file invalid');
    _appSeedItems = items;
    appSeedMetaFromItems_(items);
    return items;
  });
}

function appIssueKindLabel_(kind) {
  return kind === 'portal' ? 'Portal' : 'Customer';
}

function appIssueShow_() {
  appIssueSyncKindUi_();
  appRenderIssues_();
  appIssueLoad_(false);
}

function appIssueSetKind_(kind) {
  _appIssueKind = kind === 'portal' ? 'portal' : 'customer';
  appIssueSyncKindUi_();
  appRenderIssues_();
}

function appIssueSyncKindUi_() {
  var cust = document.getElementById('appIssueKindCustomer');
  var port = document.getElementById('appIssueKindPortal');
  if (cust) cust.classList.toggle('active', _appIssueKind === 'customer');
  if (port) port.classList.toggle('active', _appIssueKind === 'portal');
  var lab = document.getElementById('appIssueAptLabel');
  var inp = document.getElementById('appIssueApt');
  if (lab) lab.textContent = _appIssueKind === 'portal' ? 'Apartment (optional)' : 'Apartment';
  if (inp) inp.placeholder = _appIssueKind === 'portal' ? 'Optional — or leave blank' : 'Search e.g. ES-1-1-01';
}

function appIssueOpenCount_() {
  return _appIssues.filter(function (r) {
    return String(r.status || '') !== 'fixed';
  }).length;
}

function appIssueUpdateNavCount_() {
  var el = document.getElementById('appIssueNavCount');
  if (!el) return;
  var n = appIssueOpenCount_();
  el.hidden = !n;
  el.textContent = String(n);
}

function appIssueUnpack_(r) {
  if (!r) return r;
  var note = String(r.note || '');
  var mark = '\n<!--egs-issue-extra-->';
  var i = note.indexOf(mark);
  var problem = String(r.problem || '').trim();
  var solution = String(r.solution || '').trim();
  if (i >= 0) {
    try {
      var extra = JSON.parse(note.slice(i + mark.length));
      if (!problem) problem = String((extra && extra.problem) || '');
      if (!solution) solution = String((extra && extra.solution) || '');
      note = note.slice(0, i);
    } catch (e) {}
  }
  r.note = note;
  r.problem = problem;
  r.solution = solution;
  return r;
}

function appIssueLoad_(force) {
  if (!force && _appIssues.length) {
    appRenderIssues_();
    return Promise.resolve(_appIssues);
  }
  return fetchJSONRetry({
    action: 'getApplicationIssues',
    token: appToken_()
  }, 1, 45000).then(function (d) {
    _appIssues = ((d && Array.isArray(d.issues)) ? d.issues : (Array.isArray(d) ? d : [])).map(appIssueUnpack_);
    appRenderIssues_();
    return _appIssues;
  }).catch(function (e) {
    var host = document.getElementById('appIssueHost');
    if (host) host.innerHTML = '<p class="worker-empty">Could not load issues. ' + appEsc_((e && e.message) || e) + '</p>';
    return _appIssues;
  });
}

function appIssueHideSuggest_() {
  var box = document.getElementById('appIssueAptSuggest');
  if (box) box.hidden = true;
  _appIssueSuggestIndex = -1;
}

function appIssueMatchApts_(q) {
  q = String(q || '').trim().toLowerCase();
  var out = [];
  for (var i = 0; i < _appRows.length && out.length < 12; i++) {
    var r = _appRows[i];
    if (!q) {
      out.push(r);
      continue;
    }
    var blob = (r.propertyId + ' ' + r.project + ' ' + (r.phone || '')).toLowerCase();
    if (blob.indexOf(q) !== -1) out.push(r);
  }
  return out;
}

function appIssuePhoneForApt_(propertyId) {
  var want = String(propertyId || '').trim().toUpperCase();
  if (!want) return '';
  var row = _appRows.find(function (r) { return String(r.propertyId || '').toUpperCase() === want; });
  return row && row.phone ? String(row.phone).replace(/\D/g, '') : '';
}

function appIssueFillPhoneFromApt_(propertyId, forceClear) {
  var el = document.getElementById('appIssuePhone');
  if (!el) return;
  var want = String(propertyId || '').trim().toUpperCase();
  if (!want) {
    el.value = '';
    return;
  }
  var phone = appIssuePhoneForApt_(want);
  if (phone) el.value = phone;
  else if (forceClear) el.value = '';
}

function appIssueDisplayPhone_(r) {
  var p = String((r && r.phone) || '').replace(/\D/g, '');
  if (p) return p;
  return appIssuePhoneForApt_(r && r.propertyId);
}

function appIssueAptSuggest_() {
  appIssueHideTitleSuggest_();
  var box = document.getElementById('appIssueAptSuggest');
  var inp = document.getElementById('appIssueApt');
  if (!box || !inp) return;
  var q = String(inp.value || '').trim();
  if (!q) {
    box.hidden = true;
    appIssueFillPhoneFromApt_('');
    return;
  }
  if (!_appRows.length) {
    box.hidden = false;
    box.innerHTML = '<div class="app-issue-suggest-empty">Loading apartments…</div>';
    return;
  }
  var rows = appIssueMatchApts_(q);
  if (!rows.length) {
    box.hidden = false;
    box.innerHTML = '<div class="app-issue-suggest-empty">No apartment match — you can still type it</div>';
    return;
  }
  _appIssueSuggestIndex = -1;
  box.hidden = false;
  box.innerHTML = rows.map(function (r, i) {
    return '<button type="button" class="app-issue-suggest-item" data-idx="' + i + '" onclick=\'appIssuePickApt_(' + JSON.stringify(String(r.propertyId || '')) + ')\'>'
      + '<strong>' + appEsc_(r.propertyId) + '</strong>'
      + (r.phone ? '<span>' + appEsc_(r.phone) + '</span>' : '')
      + '</button>';
  }).join('');
  var exact = rows.filter(function (r) {
    return String(r.propertyId || '').toUpperCase() === q.toUpperCase();
  });
  if (exact.length === 1) appIssueFillPhoneFromApt_(exact[0].propertyId);
}

function appIssuePickApt_(propertyId) {
  var inp = document.getElementById('appIssueApt');
  if (inp) inp.value = propertyId;
  appIssueFillPhoneFromApt_(propertyId, true);
  appIssueHideSuggest_();
}

function appIssueAptKey_(ev) {
  var box = document.getElementById('appIssueAptSuggest');
  if (!box || box.hidden) {
    if (ev.key === 'Enter') ev.preventDefault();
    return;
  }
  var items = box.querySelectorAll('.app-issue-suggest-item');
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!items.length) return;
    if (ev.key === 'ArrowDown') _appIssueSuggestIndex = Math.min(items.length - 1, _appIssueSuggestIndex + 1);
    else _appIssueSuggestIndex = Math.max(0, _appIssueSuggestIndex - 1);
    items.forEach(function (el, i) { el.classList.toggle('active', i === _appIssueSuggestIndex); });
    return;
  }
  if (ev.key === 'Enter' && _appIssueSuggestIndex >= 0 && items[_appIssueSuggestIndex]) {
    ev.preventDefault();
    items[_appIssueSuggestIndex].click();
  }
  if (ev.key === 'Escape') appIssueHideSuggest_();
}

function appIssueHideTitleSuggest_() {
  var box = document.getElementById('appIssueTitleSuggest');
  if (box) box.hidden = true;
  _appIssueTitleSuggestIndex = -1;
}

function appIssueSavedTitles_() {
  var seen = {};
  var out = [];
  _appIssues.forEach(function (r) {
    var t = String(r.note || '').trim();
    if (!t) return;
    var k = t.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push(t);
  });
  return out;
}

function appIssueTitleSuggest_() {
  appIssueHideSuggest_();
  var box = document.getElementById('appIssueTitleSuggest');
  var inp = document.getElementById('appIssueNote');
  if (!box || !inp) return;
  var q = String(inp.value || '').trim().toLowerCase();
  if (!q) {
    box.hidden = true;
    return;
  }
  var titles = appIssueSavedTitles_().filter(function (t) {
    return t.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 12);
  if (!titles.length) {
    box.hidden = true;
    return;
  }
  _appIssueTitleSuggestIndex = -1;
  box.hidden = false;
  box.innerHTML = titles.map(function (t, i) {
    return '<button type="button" class="app-issue-suggest-item" data-idx="' + i + '" onclick=\'appIssuePickTitle_(' + JSON.stringify(String(t)) + ')\'>'
      + '<strong>' + appEsc_(t) + '</strong></button>';
  }).join('');
}

function appIssuePickTitle_(title) {
  var inp = document.getElementById('appIssueNote');
  if (inp) inp.value = title;
  appIssueHideTitleSuggest_();
}

function appIssueTitleKey_(ev) {
  var box = document.getElementById('appIssueTitleSuggest');
  if (!box || box.hidden) return;
  var items = box.querySelectorAll('.app-issue-suggest-item');
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!items.length) return;
    if (ev.key === 'ArrowDown') _appIssueTitleSuggestIndex = Math.min(items.length - 1, _appIssueTitleSuggestIndex + 1);
    else _appIssueTitleSuggestIndex = Math.max(0, _appIssueTitleSuggestIndex - 1);
    items.forEach(function (el, i) { el.classList.toggle('active', i === _appIssueTitleSuggestIndex); });
    return;
  }
  if (ev.key === 'Enter' && _appIssueTitleSuggestIndex >= 0 && items[_appIssueTitleSuggestIndex]) {
    ev.preventDefault();
    items[_appIssueTitleSuggestIndex].click();
  }
  if (ev.key === 'Escape') appIssueHideTitleSuggest_();
}

function appIssueResolveProject_(propertyId) {
  var id = String(propertyId || '').trim().toUpperCase();
  var row = _appRows.find(function (r) { return String(r.propertyId || '').toUpperCase() === id; });
  if (row && row.project) return String(row.project).toUpperCase();
  if (id.indexOf('-') > 0) return id.split('-')[0];
  return '';
}

function appIssuePickPhoto_(ev) {
  var file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  appIssueUploadPhoto_(file);
}

function appIssuePastePhoto_(ev) {
  var items = ev.clipboardData && ev.clipboardData.items;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type && items[i].type.indexOf('image') !== -1) {
      ev.preventDefault();
      appIssueUploadPhoto_(items[i].getAsFile());
      return;
    }
  }
}

function appIssueUploadPhoto_(file) {
  if (!file) return;
  var status = document.getElementById('appIssuePhotoStatus');
  var preview = document.getElementById('appIssuePhotoPreview');
  var area = document.getElementById('appIssuePasteArea');
  if (status) status.textContent = 'Uploading photo…';
  if (area) area.textContent = 'Uploading photo…';
  _appIssuePhotoUploading = true;
  if (typeof empireCompressImage !== 'function') {
    _appIssuePhotoUploading = false;
    if (status) status.textContent = 'Photo upload is not available.';
    if (area) area.textContent = 'Click here and paste a picture (Ctrl+V)';
    return;
  }
  empireCompressImage(file, 'application-issues', function (url) {
    _appIssuePhotoUploading = false;
    if (url) {
      _appIssuePhotoUrl = url;
      if (status) status.textContent = 'Photo ready';
      if (area) area.textContent = 'Picture pasted — click to replace, or paste again';
      if (preview) { preview.src = url; preview.hidden = false; }
    } else {
      if (status) status.textContent = (_lastEmpireUploadError || 'Photo upload failed');
      if (area) area.textContent = 'Click here and paste a picture (Ctrl+V)';
    }
  }, { maxSize: 1400, quality: 0.7 });
}

function appIssueClearForm_() {
  var apt = document.getElementById('appIssueApt');
  var phone = document.getElementById('appIssuePhone');
  var note = document.getElementById('appIssueNote');
  var problem = document.getElementById('appIssueProblem');
  var solution = document.getElementById('appIssueSolution');
  var status = document.getElementById('appIssuePhotoStatus');
  var preview = document.getElementById('appIssuePhotoPreview');
  if (apt) apt.value = '';
  if (phone) phone.value = '';
  if (note) note.value = '';
  if (problem) problem.value = '';
  if (solution) solution.value = '';
  if (status) status.textContent = '';
  if (preview) { preview.hidden = true; preview.src = ''; }
  var area = document.getElementById('appIssuePasteArea');
  if (area) area.textContent = 'Click here and paste a picture (Ctrl+V)';
  _appIssuePhotoUrl = '';
  appIssueHideSuggest_();
  appIssueHideTitleSuggest_();
}

function appIssueAutocorrect_(el, fromBlur) {
  if (!el) return;
  var v = String(el.value || '');
  var pos = el.selectionStart;
  if (pos == null) pos = v.length;
  var end = pos;
  if (fromBlur) {
    end = v.length;
    while (end > 0 && /[\s.,;:!?)]/.test(v.charAt(end - 1))) end--;
    pos = end;
  } else {
    var ch = v.charAt(pos - 1);
    if (!/[\s.,;:!?)]/.test(ch)) return;
    end = pos - 1;
  }
  var start = end;
  while (start > 0 && /[A-Za-z]/.test(v.charAt(start - 1))) start--;
  var word = v.slice(start, end);
  if (!word) return;
  var key = word.toLowerCase();
  var fix = APP_AUTOCORRECT[key];
  if (!fix || word === fix) return;
  if (word.charAt(0) === word.charAt(0).toUpperCase() && word !== word.toUpperCase()) {
    fix = fix.charAt(0).toUpperCase() + fix.slice(1);
  } else if (word === word.toUpperCase() && word.length > 1) {
    fix = fix.toUpperCase();
  }
  el.value = v.slice(0, start) + fix + v.slice(end);
  if (!fromBlur) {
    var np = start + fix.length + (pos - end);
    try { el.setSelectionRange(np, np); } catch (e) {}
  }
}

function appIssueAdd_() {
  if (_appIssuePhotoUploading) {
    appNote_('Wait for the photo to finish uploading.');
    return;
  }
  var propertyId = String((document.getElementById('appIssueApt') || {}).value || '').trim().toUpperCase();
  var phone = String((document.getElementById('appIssuePhone') || {}).value || '').replace(/\D/g, '');
  if (!phone) phone = appIssuePhoneForApt_(propertyId);
  var note = String((document.getElementById('appIssueNote') || {}).value || '').trim();
  var problem = String((document.getElementById('appIssueProblem') || {}).value || '').trim();
  var solution = String((document.getElementById('appIssueSolution') || {}).value || '').trim();
  if (_appIssueKind === 'customer' && !propertyId) {
    appNote_('Pick an apartment for a customer issue.');
    return;
  }
  if (!note) {
    appNote_('Write the issue first.');
    return;
  }
  fetchJSONRetry({
    action: 'addApplicationIssue',
    token: appToken_(),
    kind: _appIssueKind,
    propertyId: propertyId,
    project: appIssueResolveProject_(propertyId),
    note: note,
    problem: problem,
    solution: solution,
    phone: phone,
    photo: _appIssuePhotoUrl || ''
  }, 2, 45000).then(function (d) {
    if (!d || d.ok === false) {
      appNote_((d && (d.message || d.error)) || 'Could not save issue');
      return;
    }
    if (d.issue) _appIssues.unshift(appIssueUnpack_(d.issue));
    else appIssueLoad_(true);
    appIssueClearForm_();
    appRenderIssues_();
  }).catch(function (e) {
    appNote_(String((e && e.message) || e || 'Save failed'));
  });
}

function appIssueMarkFixed_(id) {
  if (!id) return;
  fetchJSONRetry({
    action: 'markApplicationIssueFixed',
    token: appToken_(),
    id: id
  }, 2, 30000).then(function (d) {
    if (!d || d.ok === false) {
      appNote_((d && (d.message || d.error)) || 'Could not mark fixed');
      return;
    }
    var i = _appIssues.findIndex(function (x) { return String(x.id) === String(id); });
    if (i >= 0 && d.issue) _appIssues[i] = d.issue;
    else appIssueLoad_(true);
    appRenderIssues_();
  }).catch(function (e) {
    appNote_(String((e && e.message) || e || 'Update failed'));
  });
}

function appIssueDelete_(id) {
  if (!id) return;
  appAsk_('Delete this issue? It will go to the Recycle Bin.', { danger: true }, function () {
    fetchJSONRetry({
      action: 'deleteApplicationIssue',
      token: appToken_(),
      id: id
    }, 1, 30000).then(function (d) {
      if (!d || d.ok === false) {
        appNote_((d && (d.message || d.error)) || 'Could not delete');
        return;
      }
      _appIssues = _appIssues.filter(function (x) { return String(x.id) !== String(id); });
      appRenderIssues_();
    }).catch(function (e) {
      appNote_(String((e && e.message) || e || 'Delete failed'));
    });
  });
}

function appOpenImg_(src) {
  var modal = document.getElementById('appImgModal');
  var img = document.getElementById('appImgBig');
  if (img) img.src = src || '';
  if (modal) modal.classList.add('show');
}

function appCloseImg_() {
  var modal = document.getElementById('appImgModal');
  if (modal) modal.classList.remove('show');
}

function appIssueFind_(id) {
  var want = String(id || '');
  for (var i = 0; i < _appIssues.length; i++) {
    if (String(_appIssues[i].id) === want) return _appIssues[i];
  }
  return null;
}

function appIssueRowHtml_(r) {
  var id = appEsc_(r.id);
  var apt = String(r.propertyId || '').trim() || '—';
  var when = appFormatDateTime_(r.createdAt);
  var note = String(r.note || '').trim() || '—';
  return '<tr class="app-issue-row" data-issue-id="' + id + '" onclick="appIssueOpenInfo_(\'' + id + '\')">'
    + '<td><strong>' + appEsc_(apt) + '</strong></td>'
    + '<td class="app-issue-date">' + appEsc_(when) + '</td>'
    + '<td class="app-issue-title-cell">' + appEsc_(note) + '</td>'
    + '<td class="app-issue-more"><button type="button" onclick="event.stopPropagation();appIssueOpenInfo_(\'' + id + '\')">More info</button></td>'
    + '</tr>';
}

function appIssueColTableHtml_(rows) {
  if (!rows.length) return '';
  return '<div class="app-issue-table-wrap"><table class="app-issue-table"><thead><tr>'
    + '<th>Apartment</th><th>Date</th><th>Issue</th><th></th>'
    + '</tr></thead><tbody>'
    + rows.map(appIssueRowHtml_).join('')
    + '</tbody></table></div>';
}

function appIssueInfoHtml_(r) {
  var open = String(r.status || '') !== 'fixed';
  var apt = String(r.propertyId || '').trim() || 'No apartment';
  var phone = appIssueDisplayPhone_(r);
  var photoHtml = '';
  if (r.photo) {
    if (typeof empireThumbImgHtml === 'function') {
      photoHtml = empireThumbImgHtml(r.photo, 'app-issue-thumb', '', 640).replace('<img ', '<img onclick="appOpenImg_(this.dataset.full||this.src)" ');
    } else {
      photoHtml = '<img class="app-issue-thumb" src="' + appEsc_(r.photo) + '" alt="" onclick="appOpenImg_(this.src)">';
    }
  }
  var h = '<div class="app-detail-grid">'
    + '<div class="app-detail-card"><label>Apartment</label><span>' + appEsc_(apt) + '</span></div>'
    + '<div class="app-detail-card"><label>Date opened</label><span>' + appEsc_(appFormatDateTime_(r.createdAt)) + '</span></div>'
    + (open ? '' : ('<div class="app-detail-card"><label>Date fixed</label><span>' + appEsc_(appFormatDateTime_(r.fixedAt)) + '</span></div>'))
    + '<div class="app-detail-card"><label>Issue</label><span>' + appEsc_(r.note || '—') + '</span></div>'
    + '<div class="app-detail-card"><label>Phone number</label>'
    + (phone
      ? ('<span><a href="tel:' + appEsc_(phone) + '">' + appEsc_(phone) + '</a></span>')
      : '<span>—</span>')
    + '</div>'
    + '<div class="app-detail-card"><label>Status</label><span>' + (open ? 'Not fixed' : 'Fixed') + '</span></div>'
    + '<div class="app-detail-card app-issue-info-wide"><label>What\'s the problem</label><span>' + appEsc_(String(r.problem || '').trim() || '—') + '</span></div>'
    + '<div class="app-detail-card app-issue-info-wide"><label>How to solve the problem</label><span>' + appEsc_(String(r.solution || '').trim() || '—') + '</span></div>'
    + '</div>'
    + photoHtml
    + '<div class="app-issue-meta">Opened by ' + appEsc_(r.createdBy || '—') + '</div>';
  if (!open) {
    h += '<div class="app-issue-meta">Fixed by ' + appEsc_(r.fixedBy || '—') + '</div>';
  }
  h += '<div class="app-issue-card-actions">';
  if (open) {
    h += '<button type="button" class="app-issue-fix-btn" onclick="appIssueMarkFixed_(\'' + appEsc_(r.id) + '\')">Fixed</button>';
  }
  h += '<button type="button" class="app-issue-del-btn" onclick="appIssueDelete_(\'' + appEsc_(r.id) + '\')">Delete</button>';
  h += '</div>';
  return h;
}

function appIssueOpenInfo_(id) {
  var r = appIssueFind_(id);
  if (!r) return;
  _appIssueInfoId = String(r.id);
  var modal = document.getElementById('appIssueInfoModal');
  var title = document.getElementById('appIssueInfoTitle');
  var body = document.getElementById('appIssueInfoBody');
  if (title) title.textContent = String(r.propertyId || '').trim() || 'Issue';
  if (body) body.innerHTML = appIssueInfoHtml_(r);
  if (modal) modal.classList.add('show');
}

function appIssueCloseInfo_() {
  _appIssueInfoId = '';
  var modal = document.getElementById('appIssueInfoModal');
  if (modal) modal.classList.remove('show');
}

function appIssueRefreshInfo_() {
  if (!_appIssueInfoId) return;
  var r = appIssueFind_(_appIssueInfoId);
  if (!r) {
    appIssueCloseInfo_();
    return;
  }
  var title = document.getElementById('appIssueInfoTitle');
  var body = document.getElementById('appIssueInfoBody');
  if (title) title.textContent = String(r.propertyId || '').trim() || 'Issue';
  if (body) body.innerHTML = appIssueInfoHtml_(r);
}

function appRenderIssues_() {
  appIssueUpdateNavCount_();
  var host = document.getElementById('appIssueHost');
  if (!host) return;
  var rows = _appIssues.filter(function (r) {
    return String(r.kind || 'customer') === _appIssueKind;
  });
  var open = rows.filter(function (r) { return String(r.status || '') !== 'fixed'; });
  var fixed = rows.filter(function (r) { return String(r.status || '') === 'fixed'; });
  var h = '<div class="app-issue-board">'
    + '<section class="app-issue-col">'
    + '<h3>Not fixed <span>' + open.length + '</span></h3>';
  if (!open.length) {
    h += '<p class="worker-empty">No open ' + appIssueKindLabel_(_appIssueKind).toLowerCase() + ' issues.</p>';
  } else {
    h += appIssueColTableHtml_(open);
  }
  h += '</section><section class="app-issue-col is-fixed-col">'
    + '<h3>Fixed <span>' + fixed.length + '</span></h3>';
  if (!fixed.length) {
    h += '<p class="worker-empty">Nothing marked fixed yet.</p>';
  } else {
    h += appIssueColTableHtml_(fixed);
  }
  h += '</section></div>';
  host.innerHTML = h;
  appIssueRefreshInfo_();
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
  appEnsureSeedMeta_();
  appLoad_(true);
}

function appHandleLogin_(e) {
  empireAuthLogin(e, APP_DEPT, {
    onSuccess: function () {
      appEnterApp_();
    }
  });
}

function appCloseSettings_() {
  var wrap = document.getElementById('appSettingsWrap');
  var btn = document.getElementById('appSettingsBtn');
  var panel = document.getElementById('appSettingsPanel');
  if (wrap) wrap.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (panel) panel.hidden = true;
}

function appToggleSettings_(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  var wrap = document.getElementById('appSettingsWrap');
  var btn = document.getElementById('appSettingsBtn');
  var panel = document.getElementById('appSettingsPanel');
  if (!wrap || !panel) return;
  var open = !wrap.classList.contains('open');
  wrap.classList.toggle('open', open);
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.hidden = !open;
}

function appRbOpen_() {
  var m = document.getElementById('appRbModal');
  if (m) m.classList.add('show');
  appRbLoad_();
}

function appRbClose_() {
  var m = document.getElementById('appRbModal');
  if (m) m.classList.remove('show');
}

function appRbItemHtml_(it) {
  var when = appFormatDateTime_(it.deletedAt);
  var how = it.reason === 'reset' ? 'Reset' : 'Delete';
  var title = appEsc_(it.issueType || it.preview || 'Issue');
  var apt = appEsc_(it.propertyId || '');
  var kind = String(it.kind || 'customer') === 'portal' ? 'Portal' : 'Customer';
  var tid = appEsc_(it.trashId);
  var photo = String(it.photo || '').trim();
  var thumb = photo
    ? '<img class="rb-thumb" src="' + appEsc_(photo) + '" alt="" loading="lazy" onclick="appOpenImg_(this.src)">'
    : '';
  return '<div class="rb-item">'
    + thumb
    + '<div class="rb-body">'
    + '<div class="rb-title">' + (apt ? (apt + ' · ') : '') + title + '</div>'
    + '<div class="rb-loc">' + kind + (it.phone ? (' · ' + appEsc_(String(it.phone))) : '') + (it.status === 'fixed' ? ' · Fixed' : ' · Not fixed') + '</div>'
    + '<div class="rb-meta">' + appEsc_(when) + (it.deletedBy ? (' · ' + appEsc_(it.deletedBy)) : '') + ' · ' + how + '</div>'
    + '</div>'
    + '<div class="rb-actions">'
    + '<button type="button" class="rb-restore" onclick="appRbRestore_(\'' + tid + '\')">Restore</button>'
    + '<button type="button" class="rb-purge" onclick="appRbPurge_(\'' + tid + '\')" title="Delete forever">✕</button>'
    + '</div></div>';
}

function appRbLoad_() {
  var box = document.getElementById('appRbList');
  if (!box) return;
  box.innerHTML = '<p style="color:var(--text-faint);">Loading…</p>';
  fetchJSONRetry({
    action: 'getTrash',
    dept: APP_DEPT,
    sheets: APP_TRASH_SHEETS,
    token: appToken_()
  }, 1, 30000).then(function (d) {
    if (d && d.ok === false) throw new Error(d.message || d.error || 'Could not load bin');
    var items = Array.isArray(d) ? d : (Array.isArray(d.items) ? d.items : []);
    if (!items.length) {
      box.innerHTML = '<p style="color:var(--text-faint);">The bin is empty.</p>';
      return;
    }
    box.innerHTML = '<div class="rb-items">' + items.map(appRbItemHtml_).join('') + '</div>';
  }).catch(function (e) {
    box.innerHTML = '<p style="color:#C5504F;">' + appEsc_((e && e.message) || 'Could not load') + '</p>';
  });
}

function appRbRestore_(id) {
  if (!id) return;
  appAsk_('Restore this issue?', function () {
    fetchJSONRetry({
      action: 'restoreTrash',
      dept: APP_DEPT,
      sheets: APP_TRASH_SHEETS,
      trashIds: [id],
      token: appToken_()
    }, 1, 30000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Restore failed');
      appRbLoad_();
      appIssueLoad_(true);
    }).catch(function (e) {
      appNote_(String((e && e.message) || e || 'Restore failed'));
    });
  });
}

function appRbPurge_(id) {
  if (!id) return;
  appAsk_('Delete this issue forever? This cannot be undone.', { danger: true }, function () {
    fetchJSONRetry({
      action: 'purgeTrash',
      dept: APP_DEPT,
      sheets: APP_TRASH_SHEETS,
      trashIds: [id],
      token: appToken_()
    }, 1, 30000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Delete forever failed');
      appRbLoad_();
    }).catch(function (e) {
      appNote_(String((e && e.message) || e || 'Delete forever failed'));
    });
  });
}

function appRbRestoreAll_() {
  appAsk_('Restore every issue in the Recycle Bin?', function () {
    fetchJSONRetry({
      action: 'restoreTrash',
      dept: APP_DEPT,
      sheets: APP_TRASH_SHEETS,
      token: appToken_()
    }, 1, 60000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Restore failed');
      appRbLoad_();
      appIssueLoad_(true);
    }).catch(function (e) {
      appNote_(String((e && e.message) || e || 'Restore failed'));
    });
  });
}

function appRbEmpty_() {
  appAsk_('Empty the Recycle Bin? This deletes every item forever.', { danger: true }, function () {
    fetchJSONRetry({
      action: 'purgeTrash',
      dept: APP_DEPT,
      sheets: APP_TRASH_SHEETS,
      token: appToken_()
    }, 1, 60000).then(function (d) {
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Empty bin failed');
      appRbLoad_();
    }).catch(function (e) {
      appNote_(String((e && e.message) || e || 'Empty bin failed'));
    });
  });
}

function appOpenResetModal_() {
  var m = document.getElementById('appResetModal');
  var pw = document.getElementById('appResetPwInput');
  var msg = document.getElementById('appResetMsg');
  if (msg) msg.textContent = '';
  if (pw) pw.value = '';
  if (m) m.classList.add('show');
  if (pw) setTimeout(function () { pw.focus(); }, 50);
}

function appCloseResetModal_() {
  var m = document.getElementById('appResetModal');
  if (m) m.classList.remove('show');
}

function appDoReset_() {
  var pwEl = document.getElementById('appResetPwInput');
  var msg = document.getElementById('appResetMsg');
  if (!pwEl || !msg) return;
  var pw = String(pwEl.value || '');
  if (!pw) {
    msg.style.color = '#C5504F';
    msg.textContent = 'Please enter the password.';
    return;
  }
  msg.style.color = 'var(--text-soft)';
  msg.textContent = 'Moving issues to Recycle Bin…';
  fetchJSONRetry({
    action: 'clearApplicationIssues',
    token: appToken_(),
    resetPassword: pw,
    username: typeof empireGetUser === 'function' ? empireGetUser() : ''
  }, 1, 60000).then(function (d) {
    if (d && d.error === 'bad_password') {
      msg.style.color = '#C5504F';
      msg.textContent = 'Wrong password — nothing was deleted.';
      return;
    }
    if (d && d.ok === false) {
      msg.style.color = '#C5504F';
      msg.textContent = d.message || d.error || 'Reset failed';
      return;
    }
    msg.style.color = '#1d9e75';
    msg.textContent = 'Moved ' + (d.cleared || 0) + ' issue(s) to the Recycle Bin.';
    appIssueLoad_(true);
    setTimeout(appCloseResetModal_, 900);
  }).catch(function (e) {
    msg.style.color = '#C5504F';
    msg.textContent = (e && e.message) || 'Reset failed';
  });
}

function appLogout_() {
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function appInit_() {
  appPopulateFilters_();
  if (!document.body._appStatusDdBound) {
    document.body._appStatusDdBound = true;
    document.addEventListener('click', appStatusDdCloseAll_);
    document.addEventListener('scroll', appStatusDdOnOuterScroll_, true);
    window.addEventListener('resize', appStatusDdCloseAll_);
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.app-issue-apt-wrap')) appIssueHideSuggest_();
      if (!ev.target.closest('.app-issue-title-wrap')) appIssueHideTitleSuggest_();
      if (!ev.target.closest('#appSettingsWrap')) appCloseSettings_();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      appIssueCloseInfo_();
    });
  }
  if (!empireAuthPageBoot({
    dept: APP_DEPT,
    sendToHomeLogin: false,
    onEnter: appEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', appInit_);
