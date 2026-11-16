/* HR leave calendar (2026-11-16) — its own file; the locked HR-F-06 files are not changed.
 * - "Leave calendar" button in the HR side menu (everyone with HR access).
 * - Click a name in "My employees" or "Employees" to open that person's calendar.
 * - Shows APPROVED leave only (director confirmed). The server decides who may see whom:
 *   admin / HR staff / director = anyone, line manager = self + own staff, employee = self.
 * Loaded by empire-company-hr.js on hr-leave.html. Needs fetchJSONRetry + empireGetToken.
 */
(function () {
  if (window.__hrCalLoaded) return;
  window.__hrCalLoaded = true;

  var TYPE_COLORS = {
    'Annual Leave': '#2a7de1',
    'Sick leave': '#d9534f',
    'Unpaid Leave': '#7d8590',
    'Bereavement': '#6f42c1',
    'Marriage Leave': '#d63384',
    'Lateness': '#e0a020',
    'Other': '#1f9e8f'
  };
  var TYPE_LABELS = {
    'Annual Leave': 'Annual leave',
    'Sick leave': 'Sick leave',
    'Unpaid Leave': 'Unpaid leave',
    'Bereavement': 'Bereavement',
    'Marriage Leave': 'Marriage leave',
    'Lateness': 'Lateness',
    'Other': 'Other'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var state = { people: [], person: null, papers: [], year: 0, month: 0, loading: false, msg: '' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function color(type) { return TYPE_COLORS[type] || TYPE_COLORS.Other; }
  function label(p) {
    var t = TYPE_LABELS[p.type] || p.type || 'Leave';
    return p.type === 'Other' && p.other ? 'Other (' + p.other + ')' : t;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function fmt(isoDate) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
    if (!m) return String(isoDate || '');
    return Number(m[3]) + '-' + MONTHS[Number(m[2]) - 1].slice(0, 3) + '-' + m[1];
  }

  /* Every date a paper covers (start..end). Half day = one date, marked half. */
  function paperDates(p) {
    var out = [];
    var s = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.start || '');
    if (!s) return out;
    var e = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.end || '') || s;
    var d = new Date(Number(s[1]), Number(s[2]) - 1, Number(s[3]));
    var end = new Date(Number(e[1]), Number(e[2]) - 1, Number(e[3]));
    if (end < d) end = d;
    for (var guard = 0; d <= end && guard < 400; guard++) {
      out.push(iso(d.getFullYear(), d.getMonth(), d.getDate()));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function dayMap() {
    var map = {};
    state.papers.forEach(function (p) {
      var dates = paperDates(p);
      var half = dates.length === 1 && Number(p.days) > 0 && Number(p.days) < 1;
      dates.forEach(function (d) {
        (map[d] = map[d] || []).push({ p: p, half: half });
      });
    });
    return map;
  }

  /* ---------- window ---------- */
  function ensureWin() {
    var w = document.getElementById('hrCalWin');
    if (w) return w;
    w = document.createElement('div');
    w.id = 'hrCalWin';
    w.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(20,20,30,.5);display:flex;align-items:center;' +
      'justify-content:center;padding:12px;';
    w.innerHTML = '<div id="hrCalCard" role="dialog" aria-modal="true" aria-labelledby="hrCalTitle" style="background:#fff;color:#232a3d;' +
      'border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);width:100%;max-width:720px;max-height:100%;overflow:auto;' +
      'padding:18px;font-size:14px;"></div>';
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('hrCalWin')) close(); });
    document.body.appendChild(w);
    return w;
  }
  function close() {
    var w = document.getElementById('hrCalWin');
    if (w) w.remove();
  }

  function btnCss(primary) {
    return 'border:1px solid ' + (primary ? '#8d015d' : '#e6cddc') + ';background:' + (primary ? '#8d015d' : '#faf6f8') +
      ';color:' + (primary ? '#fff' : '#8d015d') + ';border-radius:50px;padding:6px 14px;font-weight:700;cursor:pointer;' +
      'box-shadow:none;transform:none;font-size:14px;';
  }

  function render() {
    ensureWin();
    var card = document.getElementById('hrCalCard');
    var p = state.person;
    var h = '';
    h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">' +
      '<h2 id="hrCalTitle" style="margin:0;font-size:18px;color:#185fa5;flex:1;min-width:180px;">Leave calendar' +
      (p ? ' — ' + esc(p.name) : '') + '</h2>' +
      '<button type="button" data-cal="close" style="' + btnCss(false) + '">Close</button></div>';

    if (state.people.length > 1) {
      h += '<label style="display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:12px;color:#5b6478;margin-bottom:12px;">Employee' +
        '<select data-cal="pick" style="height:36px;border:1px solid #d5d8e0;border-radius:10px;padding:0 10px;font:inherit;font-size:14px;color:#232a3d;">' +
        state.people.map(function (x) {
          return '<option value="' + esc(x.code) + '"' + (p && x.code === p.code ? ' selected' : '') + '>' +
            esc(x.name + (x.mine ? ' (me)' : '') + ' — ' + x.code) + '</option>';
        }).join('') + '</select></label>';
    }

    if (state.loading) {
      card.innerHTML = h + '<p style="color:#5b6478;">Loading…</p>';
      return;
    }
    if (!p) {
      card.innerHTML = h + '<p style="color:#a23a39;">' + esc(state.msg || 'No employee found for this account.') + '</p>';
      return;
    }

    h += '<div style="color:#5b6478;font-size:13px;margin:-4px 0 12px;">' + esc([p.code, p.job, p.department].filter(Boolean).join(' · ')) +
      (p.daysBalance != null ? ' · <strong style="color:#232a3d;">' + esc(p.daysBalance) + ' days left</strong>' : '') + '</div>';

    // month header
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">' +
      '<button type="button" data-cal="prev" aria-label="Previous month" style="' + btnCss(false) + '">◀</button>' +
      '<strong style="font-size:16px;">' + MONTHS[state.month] + ' ' + state.year + '</strong>' +
      '<button type="button" data-cal="next" aria-label="Next month" style="' + btnCss(false) + '">▶</button></div>';

    // grid
    var map = dayMap();
    var first = new Date(state.year, state.month, 1).getDay();
    var count = new Date(state.year, state.month + 1, 0).getDate();
    var todayIso = (function () { var t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); })();
    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
    DAYS.forEach(function (d) {
      h += '<div style="text-align:center;font-size:11px;font-weight:700;color:#8a90a0;padding:2px 0;">' + d + '</div>';
    });
    for (var i = 0; i < first; i++) h += '<div></div>';
    for (var d = 1; d <= count; d++) {
      var key = iso(state.year, state.month, d);
      var hits = map[key] || [];
      var bg = '#f4f6fb', fg = '#232a3d', tip = '';
      if (hits.length) {
        var c = color(hits[0].p.type);
        bg = hits[0].half ? 'linear-gradient(135deg,' + c + ' 50%,#f4f6fb 50%)' : c;
        fg = hits[0].half ? '#232a3d' : '#fff';
        tip = hits.map(function (x) { return label(x.p) + (x.half ? ' (half day)' : '') + (x.p.num ? ' #' + x.p.num : ''); }).join(', ');
      }
      var isToday = key === todayIso;
      h += '<div title="' + esc(tip) + '" style="min-height:44px;border-radius:10px;background:' + bg + ';color:' + fg +
        ';padding:4px 6px;font-size:13px;font-weight:700;position:relative;' +
        (isToday ? 'outline:2px solid #185fa5;outline-offset:-2px;' : '') + '">' + d +
        (hits.length && hits[0].half ? '<span style="position:absolute;right:6px;bottom:3px;font-size:12px;">½</span>' : '') + '</div>';
    }
    h += '</div>';

    // legend (types present)
    var seen = {};
    state.papers.forEach(function (x) { seen[x.type || 'Other'] = 1; });
    var legend = Object.keys(seen);
    if (legend.length) {
      h += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 2px;font-size:12px;color:#5b6478;">' +
        legend.map(function (t) {
          return '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:3px;background:' +
            color(t) + ';display:inline-block;"></span>' + esc(TYPE_LABELS[t] || t) + '</span>';
        }).join('') + '<span>½ = half day</span></div>';
    }

    // papers this month + year total
    var monthStart = iso(state.year, state.month, 1), monthEnd = iso(state.year, state.month, count);
    var inMonth = state.papers.filter(function (x) { return x.start <= monthEnd && (x.end || x.start) >= monthStart; })
      .sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    var yearDays = 0;
    state.papers.forEach(function (x) { if (String(x.start).slice(0, 4) === String(state.year)) yearDays += Number(x.days) || 0; });
    h += '<h3 style="font-size:14px;margin:14px 0 6px;">Approved leave in ' + MONTHS[state.month] + ' (' + inMonth.length + ')</h3>';
    if (!inMonth.length) {
      h += '<p style="margin:0;color:#8a90a0;">No approved leave this month.</p>';
    } else {
      h += '<div style="display:flex;flex-direction:column;gap:6px;">' + inMonth.map(function (x) {
        return '<div style="display:flex;gap:8px;align-items:center;border:1px solid #efe8ed;border-radius:10px;padding:6px 10px;">' +
          '<span style="width:10px;height:10px;border-radius:50%;background:' + color(x.type) + ';flex:none;"></span>' +
          '<strong style="flex:1;">' + esc(label(x)) + '</strong>' +
          '<span style="color:#5b6478;">' + esc(fmt(x.start) + (x.end && x.end !== x.start ? ' – ' + fmt(x.end) : '')) + '</span>' +
          '<span style="color:#5b6478;white-space:nowrap;">' + esc(x.daysText || (x.days + ' days')) + '</span>' +
          (x.num ? '<span style="color:#8a90a0;">#' + esc(x.num) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    h += '<p style="margin:12px 0 0;color:#5b6478;font-size:13px;">Approved leave in ' + state.year + ': <strong style="color:#232a3d;">' +
      (Math.round(yearDays * 10) / 10) + ' day' + (yearDays === 1 ? '' : 's') + '</strong> · Only papers the director confirmed are shown.</p>';

    card.innerHTML = h;
  }

  function onCardClick(e) {
    var t = e.target.closest && e.target.closest('[data-cal]');
    if (!t) return;
    var what = t.getAttribute('data-cal');
    if (what === 'close') close();
    if (what === 'prev' || what === 'next') {
      state.month += what === 'prev' ? -1 : 1;
      if (state.month < 0) { state.month = 11; state.year--; }
      if (state.month > 11) { state.month = 0; state.year++; }
      render();
    }
  }
  function onCardChange(e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-cal') === 'pick') load(t.value);
  }

  function load(code) {
    state.loading = true;
    state.msg = '';
    render();
    var card = document.getElementById('hrCalCard');
    if (card && !card.__calBound) {
      card.addEventListener('click', onCardClick);
      card.addEventListener('change', onCardChange);
      card.__calBound = true;
    }
    var token = typeof empireGetToken === 'function' ? empireGetToken() : '';
    fetchJSONRetry({ action: 'getHrLeaveCalendar', token: token, code: code || '' }, 1, 30000).then(function (d) {
      if (!d || d.ok === false) {
        var m = (d && (d.message || d.error)) || 'Could not load the calendar.';
        if (/unknown action/i.test(m)) m = 'The server is not updated yet (empire-api deploy needed).';
        throw new Error(m);
      }
      state.people = Array.isArray(d.people) ? d.people : [];
      state.person = d.person || null;
      state.papers = Array.isArray(d.papers) ? d.papers : [];
      state.msg = d.message || '';
    }).catch(function (err) {
      state.person = null;
      state.papers = [];
      state.msg = err.message || 'Could not load the calendar.';
    }).then(function () {
      state.loading = false;
      render();
    });
  }

  function open(code) {
    var now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    state.person = null;
    load(code);
  }
  window.hrOpenLeaveCalendar_ = open;

  /* ---------- entry points ---------- */
  function addNavButton() {
    var nav = document.querySelector('.side-nav');
    if (!nav || document.getElementById('tabBtnLeaveCal')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab-btn';
    b.id = 'tabBtnLeaveCal';
    b.innerHTML = '<span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg></span>' +
      '<span class="lbl">Leave calendar</span>';
    b.addEventListener('click', function (e) { e.preventDefault(); open(''); });
    var anchor = document.getElementById('tabBtnEmployees') || document.getElementById('tabBtnTeam');
    if (anchor && anchor.parentNode === nav) nav.insertBefore(b, anchor);
    else nav.appendChild(b);
  }

  /* Click a name (or row) in My employees / Employees. Buttons in the row keep working. */
  function bindRows() {
    ['hrTeamHost', 'hrEmployeesHost'].forEach(function (id) {
      var host = document.getElementById(id);
      if (!host || host.__calBound) return;
      host.__calBound = true;
      host.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, select, img')) return;
        var row = e.target.closest('tbody tr');
        if (!row || !row.cells || !row.cells.length) return;
        var code = String(row.cells[0].textContent || '').trim();
        if (!/^\d{3,}$/.test(code)) return;
        open(code);
      });
    });
    var st = document.createElement('style');
    st.textContent = '#hrTeamHost tbody tr,#hrEmployeesHost tbody tr{cursor:pointer;}' +
      '#hrTeamHost tbody tr:hover td strong,#hrEmployeesHost tbody tr:hover td strong{text-decoration:underline;color:#8d015d;}';
    document.head.appendChild(st);
  }

  function boot() {
    if (!document.querySelector('.side-nav')) return;
    addNavButton();
    bindRows();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
