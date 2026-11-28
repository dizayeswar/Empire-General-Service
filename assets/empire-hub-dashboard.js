/* Empire General Service — hub dashboard ("Today at a glance").
 * Shows a status card per department on the hub, above the department tiles.
 * READ ONLY: every number comes from an empire-api action the department page already uses.
 * Nothing here writes data, and nothing here touches Bobby — the Charging card only reads
 * getChargingRequests, the same list the Charging Electricity page shows.
 * Needs (from index.html): categories, canSeeHubTile(accessDept, tile).
 */

var HD_TZ = 'Asia/Baghdad';
var HD_LOAD_SEQ = 0;

/* ---------- small helpers ---------- */

function hdEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* YYYY-MM-DD of a moment, in Baghdad time. */
function hdDay(v) {
  if (v == null || v === '') return '';
  var d = v instanceof Date ? v : new Date(typeof v === 'number' ? v : String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: HD_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

function hdToday() { return hdDay(new Date()); }

/* Report / billing month: the 26th starts the next month (26 Nov – 25 Dec = 2026-12). */
function hdBillingMonth(ymd) {
  ymd = String(ymd || '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) return '';
  var y = parseInt(ymd.slice(0, 4), 10), m = parseInt(ymd.slice(5, 7), 10), d = parseInt(ymd.slice(8, 10), 10);
  if (d >= 26) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return y + '-' + String(m).padStart(2, '0');
}

function hdMonthName(ym) {
  var d = new Date(ym + '-01T00:00:00');
  return isNaN(d.getTime()) ? ym : d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function hdNum(v) {
  var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

function hdFmt(n) { return Math.round(n).toLocaleString('en-US'); }
function hdIqd(n) { return hdFmt(n) + ' IQD'; }
function hdUsd(n) { return '$' + (n && n < 1 ? n.toFixed(3) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }

function hdCall(body) {
  body.token = empireGetToken() || '';
  return fetchJSONRetry(body, 2, 45000).then(function (d) {
    if (d && d.ok === false) throw new Error(d.message || d.error || 'Not allowed');
    return d;
  });
}

function hdRows(d, key) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d[key])) return d[key];
  return [];
}

/* ---------- card markup ---------- */

function hdStat(value, label, sub) {
  return '<div class="hd-stat">' +
    '<div class="hd-stat-value">' + hdEsc(value) + '</div>' +
    '<div class="hd-stat-label">' + hdEsc(label) + '</div>' +
    (sub ? '<div class="hd-stat-sub">' + hdEsc(sub) + '</div>' : '') +
    '</div>';
}

function hdCardShell(def, tile) {
  var el = document.createElement('a');
  el.href = tile.link;
  el.className = 'hd-card' + (def.wide ? ' hd-card-wide' : '') + (def.empty ? ' hd-card-empty' : '');
  el.setAttribute('data-hd', def.key);
  el.innerHTML =
    '<div class="hd-card-head">' +
      '<span class="hd-card-icon">' + tile.icon + '</span>' +
      '<span class="hd-card-name">' + hdEsc(def.title || tile.name) + '</span>' +
      '<span class="hd-card-arrow" aria-hidden="true">→</span>' +
    '</div>' +
    '<div class="hd-card-body">' +
      (def.empty
        ? '<div class="hd-card-note">Nothing set for this card yet.</div>'
        : '<div class="hd-card-note">Loading…</div>') +
    '</div>';
  return el;
}

function hdSetBody(card, html) {
  var body = card && card.querySelector('.hd-card-body');
  if (body) body.innerHTML = html;
}

/* ---------- 1. Cleaning: Monthly Completion (same math as cleaning-dashboard.html) ---------- */

var HD_CLEAN_PROJECTS = ['ec', 'es', 'wd', 'ww', 'ww2', 'ra'];
var HD_CLEAN_NAMES = { ec: 'Empire Complex', es: 'Empire Square', wd: 'West Diamond', ww: 'West Wing', ww2: '(New) West Wing', ra: 'Royal Apartment' };
var HD_CLEAN_SUPERVISORS = { ec: 'Ibrahim', es: 'Ibrahim', wd: 'Rawa', ww: 'Emad', ww2: 'Muhamad', ra: 'Rawa' };
/* Daily task names per project — keep in step with taskMap in cleaning-dashboard.html. Every project also has 1 Extra per week. */
var HD_CLEAN_DAILY = {
  ec: ['Cleaning area', 'Cleaning road', 'Floor mopping', 'Elevator mopping', 'Cleaning basement', 'Ground mopping', 'Around building cleaning (ride-on scrubber dryer)'],
  es: ['Cleaning area', 'Cleaning road', 'Floor mopping', 'Elevator mopping', 'Cleaning balcony', 'Cleaning basement', 'Ground cleaning (ride-on scrubber dryer)', 'Around building cleaning (ride-on scrubber dryer)'],
  wd: ['Cleaning garden', 'Cleaning area', 'Cleaning road', 'Floor mopping', 'Rooftops cleaning', 'Elevator mopping', 'Cleaning basement', 'Ground cleaning (ride-on scrubber dryer)', 'Around building cleaning (ride-on scrubber dryer)', 'Restaurant floor cleaning (ride-on scrubber dryer)', 'Washing garbage room', 'Cleaning glass'],
  ww: ['Elevator mopping', 'Floor mopping', 'Ground mopping and washing', 'Basement mopping and washing', 'Cleaning trash can', 'Cleaning garden', 'Cleaning area', 'Cleaning road', 'Cleaning basement'],
  ww2: ['Elevator mopping', 'Floor mopping', 'Ground mopping and washing', 'Basement mopping and washing', 'Cleaning trash can', 'Cleaning garden', 'Cleaning area', 'Cleaning road', 'Cleaning basement', 'Ground cleaning (ride-on scrubber dryer)', 'Basement garbage room washing (WW12-WW15)'],
  ra: ['Cleaning garden', 'Cleaning area', 'Cleaning road', 'Cleaning trash can', 'Cleaning basement', 'Ground mopping', 'Elevator mopping', 'Floor mopping']
};

function hdCleanPeriod(x) {
  var date = String((x && x.date) || '');
  var p = String((x && x.period) || '');
  var freq = String((x && x.freq) || '').toLowerCase();
  var rm = /^\d{4}-\d{2}-\d{2}/.test(date) ? hdBillingMonth(date) : (p.split('#')[0] || '');
  if (!rm) return p;
  if (freq === 'daily' || freq === 'extra' || /#\d+/.test(p)) {
    var m = p.match(/#(\d+)/);
    var w = m ? parseInt(m[1], 10) : 1;
    if (!w || w < 1) w = 1;
    if (w > 4) w = 4;
    return rm + '#' + w;
  }
  return rm;
}

function hdCleanProjects() {
  var scoped = typeof empireGetProjects === 'function' ? empireGetProjects() : null;
  if (!scoped) return HD_CLEAN_PROJECTS.slice();
  return HD_CLEAN_PROJECTS.filter(function (p) { return scoped.indexOf(p) !== -1; });
}

function hdCleanCompletion(p, mv, photos) {
  var mine = photos.filter(function (x) { return String(x.project || '').trim().toLowerCase() === p; });
  var have = {};
  mine.forEach(function (x) {
    var per = hdCleanPeriod(x);
    var task = String(x.task || '').trim();
    var isExtra = String(x.freq || '').toLowerCase() === 'extra' || task.toLowerCase() === 'extra';
    if (isExtra) {
      if (per === mv) { for (var w = 1; w <= 4; w++) have['extra|' + mv + '#' + w] = 1; }
      else have['extra|' + per] = 1;
    } else {
      have[task + '|' + per] = 1;
    }
  });
  var tasks = HD_CLEAN_DAILY[p] || [];
  var total = 0, done = 0;
  for (var wn = 1; wn <= 4; wn++) {
    var per = mv + '#' + wn;
    tasks.forEach(function (t) { total++; if (have[t.trim() + '|' + per]) done++; });
    total++;
    if (have['extra|' + per]) done++;
  }
  return { total: total, done: done, pct: total ? done / total * 100 : 0 };
}

function hdDonut(pct) {
  var p = Math.max(0, Math.min(100, Math.round(pct)));
  return '<div class="hd-donut' + (p >= 100 ? ' full' : '') + '" style="--p:' + p + '"><span>' + p + '%</span></div>';
}

function hdBar(pct) {
  var p = Math.max(0, Math.min(100, Math.round(pct)));
  return '<div class="hd-bar"><div class="hd-bar-fill' + (p >= 100 ? ' full' : '') + '" style="width:' + p + '%"></div></div>';
}

function hdLoadCleaning(card) {
  var mv = hdBillingMonth(hdToday());
  var name = card.querySelector('.hd-card-name');
  if (name) name.textContent = 'Cleaning — Monthly Completion · ' + hdMonthName(mv);
  return hdCall({ action: 'getTaskPhotos', periodPrefix: mv, force: true }).then(function (d) {
    var photos = hdRows(d, 'photos');
    var projects = hdCleanProjects();
    if (!projects.length) { hdSetBody(card, '<div class="hd-card-note">No cleaning projects on this account.</div>'); return; }
    var html = '<div class="hd-clean-grid">' + projects.map(function (p) {
      var c = hdCleanCompletion(p, mv, photos);
      return '<div class="hd-clean-item">' +
        '<div class="hd-clean-name">' + hdEsc(HD_CLEAN_NAMES[p]) + '</div>' +
        hdDonut(c.pct) + hdBar(c.pct) +
        '<div class="hd-clean-count">' + c.done + ' / ' + c.total + ' tasks completed</div>' +
        '<div class="hd-clean-sup"><strong>Supervisor:</strong> ' + hdEsc(HD_CLEAN_SUPERVISORS[p]) + '</div>' +
        '</div>';
    }).join('') + '</div>';
    hdSetBody(card, html);
  });
}

/* ---------- 2 & 3. Civil / Electrical: jobs saved to the report ---------- */

function hdLoadJobs(card, action) {
  var today = hdToday();
  var mv = hdBillingMonth(today);
  return hdCall({ action: action, month: mv }).then(function (d) {
    var rows = hdRows(d, 'rows').filter(function (r) { return String(r.type || '').toLowerCase() !== 'callcenter'; });
    var savedToday = rows.filter(function (r) { return hdDay(r.createdAt) === today; }).length;
    hdSetBody(card, '<div class="hd-stats">' +
      hdStat(hdFmt(savedToday), 'Jobs saved today') +
      hdStat(hdFmt(rows.length), 'Jobs in report', hdMonthName(mv)) +
      '</div>');
  });
}

/* ---------- 4. Charging Electricity (read only) ---------- */

function hdLoadCharging(card) {
  var today = hdToday();
  var month = today.slice(0, 7);
  return hdCall({ action: 'getChargingRequests' }).then(function (d) {
    var t = { n: 0, amt: 0 }, m = { n: 0, amt: 0 };
    hdRows(d, 'rows').forEach(function (r) {
      if (String(r.status || '') !== 'charged') return;
      var day = hdDay(r.chargedAt || r.createdAt);
      var amt = Number(String(r.amount || '').replace(/\D/g, '')) || 0;
      if (day === today) { t.n++; t.amt += amt; }
      if (day.slice(0, 7) === month) { m.n++; m.amt += amt; }
    });
    hdSetBody(card, '<div class="hd-stats">' +
      hdStat(hdFmt(t.n), 'Charges today', hdIqd(t.amt)) +
      hdStat(hdFmt(m.n), 'Charges this month', hdIqd(m.amt)) +
      '</div>');
  });
}

/* ---------- 5. Warehouse: invoices created and their total ---------- */

function hdMoneyLine(usd, iqd) {
  var parts = [];
  if (usd) parts.push(hdUsd(usd));
  if (iqd) parts.push(hdIqd(iqd));
  return parts.length ? parts.join(' + ') : 'Total 0';
}

function hdLoadWarehouse(card) {
  var today = hdToday();
  var mv = hdBillingMonth(today);
  return hdCall({ action: 'getWarehouseInvoices' }).then(function (d) {
    var t = { n: 0, usd: 0, iqd: 0 }, m = { n: 0, usd: 0, iqd: 0 };
    hdRows(d, 'items').forEach(function (r) {
      var usd = hdNum(r.amountUsd), iqd = hdNum(r.amountIqd);
      if (hdDay(r.createdAt) === today) { t.n++; t.usd += usd; t.iqd += iqd; }
      if (hdBillingMonth(r.date) === mv) { m.n++; m.usd += usd; m.iqd += iqd; }
    });
    hdSetBody(card, '<div class="hd-stats">' +
      hdStat(hdFmt(t.n), 'Invoices created today', hdMoneyLine(t.usd, t.iqd)) +
      hdStat(hdFmt(m.n), 'Invoices · ' + hdMonthName(mv), hdMoneyLine(m.usd, m.iqd)) +
      '</div>');
  });
}

/* ---------- 6. Application: New Active and set to Pending today ---------- */

function hdLoadApplication(card) {
  var today = hdToday();
  return Promise.all([
    hdCall({ action: 'getApplicationChecks', status: 'NEW ACTIVE' }),
    hdCall({ action: 'getApplicationPendingDaily' })
  ]).then(function (res) {
    var newActive = hdRows(res[0], 'rows').filter(function (r) {
      return String(r.status || '').toUpperCase() === 'NEW ACTIVE' && hdDay(r.updatedAt) === today;
    }).length;
    var pending = Number(res[1] && res[1].todayCount) || 0;
    hdSetBody(card, '<div class="hd-stats">' +
      hdStat(hdFmt(newActive), 'New Active today') +
      hdStat(hdFmt(pending), 'Set to Pending today') +
      '</div>');
  });
}

/* ---------- 7. HR: papers saved today (read only, HR files untouched) ---------- */

function hdLoadHr(card) {
  var today = hdToday();
  var admin = typeof empireIsAdminRole === 'function' && empireIsAdminRole();
  var req = admin ? hdCall({ action: 'getHrReport' }) : hdCall({ action: 'getHrLeaveRequests' });
  return req.then(function (d) {
    var rows = admin ? hdRows(d, 'papers') : hdRows(d, 'rows');
    var n = rows.filter(function (r) { return hdDay(r.createdAt) === today; }).length;
    hdSetBody(card, '<div class="hd-stats">' +
      hdStat(hdFmt(n), 'Papers saved today', empireGetCompany()) +
      '</div>');
  });
}

/* ---------- 8. Car Park: WhatsApp sent and cost ---------- */

var HD_WA_PRICE_USD = 0.0079;            /* same as CP_WA_PRICE_USD in car-park-app.js */
var HD_WA_3LANG_FROM = '2026-11-16';     /* from this day each warning = 3 messages (EN, KU, AR); before it, 1 */

function hdWaMsgs(r) {
  return hdDay(r.waSentAt) >= HD_WA_3LANG_FROM ? 3 : 1;
}

function hdLoadCarPark(card) {
  var today = hdToday();
  return hdCall({ action: 'getCarparkReports' }).then(function (d) {
    var tMsgs = 0, allMsgs = 0;
    hdRows(d, 'reports').forEach(function (r) {
      if (r.waStatus !== 'sent' || !r.waSentAt) return;
      var n = hdWaMsgs(r);
      allMsgs += n;
      if (hdDay(r.waSentAt) === today) tMsgs += n;
    });
    hdSetBody(card, '<div class="hd-stats">' +
      hdStat(hdFmt(tMsgs), 'WhatsApp sent today', hdUsd(tMsgs * HD_WA_PRICE_USD) + ' today') +
      hdStat(hdUsd(allMsgs * HD_WA_PRICE_USD), 'All-time cost', hdFmt(allMsgs) + ' messages') +
      '</div>');
  });
}

/* ---------- which cards, in which order ---------- */

var HD_CARDS = [
  { key: 'cleaning', dept: 'cleaning', wide: true, load: hdLoadCleaning },
  { key: 'civil', dept: 'civil department,civil issue', load: function (c) { return hdLoadJobs(c, 'getCivilJobs'); }, need: 'civil department' },
  { key: 'electrical', dept: 'electrical department,electric issue', load: function (c) { return hdLoadJobs(c, 'getElectricalJobs'); }, need: 'electrical department' },
  { key: 'charging', dept: 'charging', load: hdLoadCharging },
  { key: 'warehouse', dept: 'warehouse', load: hdLoadWarehouse },
  { key: 'application', dept: 'application', load: hdLoadApplication },
  { key: 'hr', dept: 'hr', load: hdLoadHr },
  { key: 'carpark', dept: 'car park', load: hdLoadCarPark, adminOnly: true },
  { key: 'hse', dept: 'hse', empty: true },
  { key: 'ups', dept: 'ups', empty: true },
  { key: 'asaas', dept: 'asaas', empty: true }
];

function hdCanUse(def) {
  var admin = (typeof empireIsAdminRole === 'function' && empireIsAdminRole()) || empireIsAdminSession();
  if (def.adminOnly && !admin) return false;
  if (def.need && !admin && !empireCanAccessDept(def.need)) return false;
  return true;
}

function loadHubDashboard() {
  var host = document.getElementById('hubDash');
  if (!host || typeof categories === 'undefined') return;
  var seq = ++HD_LOAD_SEQ;
  var grid = document.createElement('div');
  grid.className = 'hd-grid';
  HD_CARDS.forEach(function (def) {
    var tile = categories.find(function (c) { return c.accessDept === def.dept; });
    if (!tile || !canSeeHubTile(tile.accessDept, tile) || !hdCanUse(def)) return;
    var card = hdCardShell(def, tile);
    grid.appendChild(card);
    if (def.empty || !def.load) return;
    Promise.resolve()
      .then(function () { return def.load(card); })
      .catch(function (e) {
        if (seq !== HD_LOAD_SEQ) return;
        hdSetBody(card, '<div class="hd-card-note hd-card-err">Could not load — ' + hdEsc((e && e.message) || 'check connection') + '</div>');
      });
  });
  host.innerHTML = '';
  if (!grid.children.length) { host.hidden = true; return; }
  host.hidden = false;
  var head = document.createElement('div');
  head.className = 'hd-head';
  head.innerHTML = '<h2>Today at a glance</h2><span class="hd-date">' + hdEsc(new Date().toLocaleDateString('en-GB', { timeZone: HD_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + '</span>';
  host.appendChild(head);
  host.appendChild(grid);
}
