/* HR Report (admin only): leave request counts and the Employees change log. */

var _hrReport = null;
var _hrReportLoading = false;

var HR_REPORT_ACTIONS = {
  added: 'Added',
  edited: 'Edited',
  removed: 'Removed',
  days: 'Days left'
};

function hrIsAdmin_() {
  return typeof empireIsAdminRole === 'function' && empireIsAdminRole();
}

function hrReportLoad_(force) {
  if (_hrReportLoading) return;
  if (_hrReport && !force) { hrRenderReport_(); return; }
  _hrReportLoading = true;
  var host = document.getElementById('hrReportHost');
  if (host && !_hrReport) host.innerHTML = '<p>Loading…</p>';
  fetchJSONRetry({ action: 'getHrReport', token: hrToken_() }, 1, 30000).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Could not load the report.');
    _hrReport = d;
    hrReportFillFilters_();
    hrRenderReport_();
  }).catch(function (err) {
    if (host) host.innerHTML = '<p>' + hrEsc_(err.message || 'Could not load the report.') + '</p>';
  }).then(function () { _hrReportLoading = false; });
}

function hrReportFillFilters_() {
  var sel = document.getElementById('hrRepDept');
  if (!sel || !_hrReport) return;
  var keep = sel.value;
  var seen = {};
  (_hrReport.papers || []).forEach(function (p) {
    var d = String(p.department || '').trim();
    if (d) seen[d] = 1;
  });
  sel.innerHTML = '<option value="">All departments</option>' + Object.keys(seen).sort().map(function (d) {
    return '<option value="' + hrEsc_(d) + '">' + hrEsc_(d) + '</option>';
  }).join('');
  sel.value = keep;
}

function hrReportPapers_() {
  var from = hrVal_('hrRepFrom');
  var to = hrVal_('hrRepTo');
  var dept = hrVal_('hrRepDept');
  return ((_hrReport && _hrReport.papers) || []).filter(function (p) {
    var day = String(p.startDate || '').slice(0, 10);
    if (from && (!day || day < from)) return false;
    if (to && (!day || day > to)) return false;
    if (dept && String(p.department || '').trim() !== dept) return false;
    return true;
  });
}

function hrReportTypeOf_(p) {
  var t = String(p.leaveType || '').trim();
  if (!t) return '(no type)';
  if (t === 'Other' && String(p.leaveOther || '').trim()) return 'Other';
  return t;
}

function hrReportCountTable_(title, head, rows) {
  if (!rows.length) return '<h3 class="hr-rep-h">' + hrEsc_(title) + '</h3><p>None.</p>';
  var h = '<h3 class="hr-rep-h">' + hrEsc_(title) + '</h3><div class="hr-table-wrap"><table class="hr-list-table hr-rep-table"><thead><tr>';
  head.forEach(function (c) { h += '<th>' + hrEsc_(c) + '</th>'; });
  h += '</tr></thead><tbody>';
  rows.forEach(function (r) {
    h += '<tr>' + r.map(function (c, i) { return '<td>' + (i === 0 ? '<strong>' + hrEsc_(c) + '</strong>' : hrEsc_(c)) + '</td>'; }).join('') + '</tr>';
  });
  return h + '</tbody></table></div>';
}

function hrReportGroup_(papers, keyFn) {
  var map = {};
  papers.forEach(function (p) {
    var k = keyFn(p);
    if (!map[k]) map[k] = { n: 0, days: 0 };
    map[k].n += 1;
    map[k].days += Number(p.days) || 0;
  });
  return map;
}

function hrReportDays_(n) {
  return String(Math.round(n * 10) / 10);
}

function hrRenderReport_() {
  var host = document.getElementById('hrReportHost');
  if (!host) return;
  if (!_hrReport) { hrReportLoad_(false); return; }
  var papers = hrReportPapers_();
  var stages = { inbox: 0, pending_line: 0, pending_director: 0, completed: 0, rejected: 0 };
  papers.forEach(function (p) { stages[hrStageOf_(p)] += 1; });
  var annual = papers.filter(function (p) { return hrReportTypeOf_(p) === 'Annual Leave'; }).length;

  var h = '<div class="hr-kpi-row">' +
    '<div class="hr-kpi hr-kpi-inbox"><b>' + papers.length + '</b><span>Leave requests</span></div>' +
    '<div class="hr-kpi"><b>' + annual + '</b><span>Annual leave</span></div>' +
    '<div class="hr-kpi"><b>' + stages.completed + '</b><span>Director confirmed</span></div>' +
    '<div class="hr-kpi"><b>' + (stages.pending_line + stages.pending_director + stages.inbox) + '</b><span>Waiting</span></div>' +
    '<div class="hr-kpi"><b>' + stages.rejected + '</b><span>Rejected</span></div>' +
    '<div class="hr-kpi"><b>' + (_hrReport.employees || 0) + '</b><span>Employees</span></div>' +
    '</div>';

  var byType = hrReportGroup_(papers, hrReportTypeOf_);
  h += hrReportCountTable_('By type of leave', ['Type', 'Requests', 'Days'],
    Object.keys(byType).sort(function (a, b) { return byType[b].n - byType[a].n; }).map(function (k) {
      return [k, String(byType[k].n), hrReportDays_(byType[k].days)];
    }));

  var stageNames = [
    ['inbox', 'Saved, not sent'],
    ['pending_line', 'Pending line manager'],
    ['pending_director', 'Pending director'],
    ['completed', 'Director confirmed'],
    ['rejected', 'Rejected']
  ];
  h += hrReportCountTable_('By status', ['Status', 'Requests'],
    stageNames.filter(function (s) { return stages[s[0]]; }).map(function (s) { return [s[1], String(stages[s[0]])]; }));

  var byMonth = hrReportGroup_(papers, function (p) { return String(p.startDate || '').slice(0, 7) || '(no date)'; });
  h += hrReportCountTable_('By month (start date)', ['Month', 'Requests', 'Days'],
    Object.keys(byMonth).sort().reverse().map(function (k) {
      return [k, String(byMonth[k].n), hrReportDays_(byMonth[k].days)];
    }));

  var byDept = hrReportGroup_(papers, function (p) { return String(p.department || '').trim() || '(no department)'; });
  h += hrReportCountTable_('By department', ['Department', 'Requests', 'Days'],
    Object.keys(byDept).sort(function (a, b) { return byDept[b].n - byDept[a].n; }).map(function (k) {
      return [k, String(byDept[k].n), hrReportDays_(byDept[k].days)];
    }));

  var byPerson = hrReportGroup_(papers, function (p) { return (String(p.code || '').trim() ? p.code + ' — ' : '') + String(p.name || '').trim(); });
  h += hrReportCountTable_('Most leave requests (top 20)', ['Employee', 'Requests', 'Days'],
    Object.keys(byPerson).sort(function (a, b) { return byPerson[b].n - byPerson[a].n || byPerson[b].days - byPerson[a].days; }).slice(0, 20).map(function (k) {
      return [k, String(byPerson[k].n), hrReportDays_(byPerson[k].days)];
    }));

  host.innerHTML = h;
  hrLabelListTables_(host);
  hrRenderReportChanges_();
}

function hrReportWhen_(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return hrFmtDate_(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function hrRenderReportChanges_() {
  var host = document.getElementById('hrReportChangesHost');
  var summary = document.getElementById('hrReportChangesSummary');
  if (!host || !_hrReport) return;
  if (_hrReport.changesError) {
    host.innerHTML = '<p>The change history is not set up yet: ' + hrEsc_(_hrReport.changesError) + '</p>';
    if (summary) summary.textContent = '';
    return;
  }
  var q = hrVal_('hrRepChangeSearch').toLowerCase();
  var act = hrVal_('hrRepChangeAction');
  var rows = (_hrReport.changes || []).filter(function (c) {
    if (act && c.action !== act) return false;
    if (!q) return true;
    var hay = [c.emp_code, c.emp_name, c.by_user, c.note].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  if (summary) summary.textContent = rows.length + ' change' + (rows.length === 1 ? '' : 's');
  if (!rows.length) {
    host.innerHTML = '<p>' + ((_hrReport.changes || []).length ? 'No changes match.' : 'No changes recorded yet. Every change on Employees from now on shows here.') + '</p>';
    return;
  }
  var h = '<div class="hr-table-wrap"><table class="hr-list-table hr-rep-table"><thead><tr>' +
    '<th>When</th><th>By</th><th>Action</th><th>Code</th><th>Name</th><th>What changed</th>' +
    '</tr></thead><tbody>';
  rows.forEach(function (c) {
    var list = Array.isArray(c.changes) ? c.changes : [];
    var what = list.map(function (x) {
      var from = String(x.from == null ? '' : x.from);
      var to = String(x.to == null ? '' : x.to);
      return '<div><strong>' + hrEsc_(x.field) + ':</strong> ' +
        (from ? '<span class="hr-rep-from">' + hrEsc_(from) + '</span> → ' : '') + hrEsc_(to || '—') + '</div>';
    }).join('');
    if (c.note) what += '<div class="hr-rep-note">' + hrEsc_(c.note) + '</div>';
    h += '<tr><td>' + hrEsc_(hrReportWhen_(c.created_at)) + '</td><td>' + hrEsc_(c.by_user || '—') + '</td><td>' +
      '<span class="hr-rep-act hr-rep-act-' + hrEsc_(c.action) + '">' + hrEsc_(HR_REPORT_ACTIONS[c.action] || c.action) + '</span></td><td>' +
      hrEsc_(c.emp_code) + '</td><td><strong>' + hrEsc_(c.emp_name) + '</strong></td><td>' + (what || '—') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
  hrLabelListTables_(host);
}
