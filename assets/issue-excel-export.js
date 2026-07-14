/* Empire World EGS — issue tracker Excel export */

var _xlsxLoadPromise = null;

function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxLoadPromise) return _xlsxLoadPromise;
  _xlsxLoadPromise = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = function () { resolve(window.XLSX); };
    s.onerror = function () { reject(new Error('Could not load Excel library. Check your internet connection.')); };
    document.head.appendChild(s);
  });
  return _xlsxLoadPromise;
}

function workerCompletionsExcelText(r) {
  if (!r || !r.workerCompletions || !r.workerCompletions.length) return '';
  return r.workerCompletions.map(function (c) {
    var parts = [c.user || 'Worker'];
    if (c.at) parts.push(fmtDT(c.at) || dateOnly(c.at));
    if (c.note) parts.push(c.note);
    return parts.join(' — ');
  }).join('; ');
}

function issueExcelHeaders(issues) {
  var headers = ['Ref', 'Issue Type', 'Project', 'Building', 'Floor', 'Spot', 'Status', 'Reported Date', 'Reported By', 'Note'];
  if (tradeGroups().length) {
    headers.push('Team', 'Assigned Workers', 'Workers Required', 'Workers Completed');
  }
  headers.push('Fixed By', 'Fixed At', 'Problem Photo URL');
  var maxFixed = maxFixedPhotosInIssues(issues || []);
  if (maxFixed <= 1) headers.push('Fixed Photo URL');
  else {
    for (var i = 1; i <= maxFixed; i++) headers.push('Fixed Photo ' + i);
  }
  if (tradeGroups().length) headers.push('Worker Completion Notes');
  return headers;
}

function maxFixedPhotosInIssues(issues) {
  var max = 0;
  issues.forEach(function (r) {
    var n = issueFixedPhotos(r).length;
    if (n > max) max = n;
  });
  return max;
}

function issueExcelRow(r, maxFixed) {
  var row = [
    '#' + issueRef(r.num),
    r.issueType || '',
    projectNames[r.project] || r.project || '',
    r.building || '',
    r.floor || '',
    r.spot || '',
    r.status === 'fixed' ? 'Fixed' : 'Open',
    dateOnly(r.date || r.createdAt),
    r.createdBy || '',
    r.note || ''
  ];
  if (tradeGroups().length) {
    row.push(tradeGroupLabel(r.assignedGroup) || 'Unassigned');
    row.push(assignedWorkersDisplay(r));
    row.push(issueWorkersRequired(r));
    row.push(issueWorkerDone(r) + '/' + issueWorkersRequired(r));
  }
  row.push(r.fixedBy || '');
  row.push(fmtDT(r.fixedAt) || '');
  row.push(r.photo || '');
  var fixed = issueFixedPhotos(r);
  if (maxFixed <= 1) {
    row.push(fixed[0] || '');
  } else {
    for (var i = 0; i < maxFixed; i++) row.push(fixed[i] || '');
  }
  if (tradeGroups().length) row.push(workerCompletionsExcelText(r));
  return row;
}

function isPhotoUrlHeader(header) {
  return header === 'Problem Photo URL' || /^Fixed Photo/.test(header);
}

function applyPhotoHyperlinks(ws, headers) {
  var XLSX = window.XLSX;
  var photoCols = [];
  headers.forEach(function (h, i) {
    if (isPhotoUrlHeader(h)) photoCols.push(i);
  });
  if (!photoCols.length || !ws['!ref']) return;
  var range = XLSX.utils.decode_range(ws['!ref']);
  for (var r = 1; r <= range.e.r; r++) {
    photoCols.forEach(function (c) {
      var addr = XLSX.utils.encode_cell({ r: r, c: c });
      var cell = ws[addr];
      if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === '') return;
      var url = String(cell.v).trim();
      if (!/^https?:\/\//i.test(url)) return;
      ws[addr] = {
        t: 's',
        v: url,
        l: { Target: url, Tooltip: 'Click to open photo' }
      };
    });
  }
}

function buildIssueExcelWorkbook(issues, rm) {
  var XLSX = window.XLSX;
  var wb = XLSX.utils.book_new();
  var monthLabel = rm || 'All time';
  var total = issues.length;
  var open = issues.filter(function (r) { return r.status !== 'fixed'; }).length;
  var fixed = total - open;

  var summaryAoA = [
    [ISSUE_CFG.reportTitle],
    ['Period', monthLabel],
    ['Generated', new Date().toLocaleString('en-US')],
    ['Prepared by', 'Swar Dizayee'],
    [],
    ['Metric', 'Count'],
    ['Total Issues', total],
    ['Open', open],
    ['Fixed', fixed]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoA), 'Summary');

  var projAoA = [['Project', 'Open', 'Fixed', 'Total']];
  ['ec', 'es', 'wd', 'ww', 'ra'].forEach(function (p) {
    var pr = issues.filter(function (r) { return r.project === p; });
    if (!pr.length) return;
    var o = pr.filter(function (r) { return r.status !== 'fixed'; }).length;
    projAoA.push([projectNames[p], o, pr.length - o, pr.length]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projAoA), 'By Project');

  var types = {};
  issues.forEach(function (r) {
    var t = r.issueType || 'Unknown';
    if (!types[t]) types[t] = { open: 0, fixed: 0 };
    if (r.status === 'fixed') types[t].fixed++;
    else types[t].open++;
  });
  var typeAoA = [['Issue Type', 'Open', 'Fixed', 'Total']];
  Object.keys(types).sort(function (a, b) {
    return (types[b].open + types[b].fixed) - (types[a].open + types[a].fixed);
  }).forEach(function (t) {
    typeAoA.push([t, types[t].open, types[t].fixed, types[t].open + types[t].fixed]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(typeAoA), 'By Issue Type');

  var headers = issueExcelHeaders(issues);
  var maxFixed = maxFixedPhotosInIssues(issues);
  var rowsAoA = [headers];
  issues.slice().sort(compareIssuesNewestFirst).forEach(function (r) {
    rowsAoA.push(issueExcelRow(r, maxFixed));
  });
  var ws = XLSX.utils.aoa_to_sheet(rowsAoA);
  applyPhotoHyperlinks(ws, headers);
  ws['!cols'] = headers.map(function (h) {
    if (isPhotoUrlHeader(h)) return { wch: 42 };
    if (h === 'Note' || h === 'Worker Completion Notes') return { wch: 32 };
    if (h === 'Issue Type') return { wch: 24 };
    return { wch: 15 };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'All Issues');

  return wb;
}

async function downloadIssueExcel() {
  syncRepMonth();
  var rm = (document.getElementById('rep-month') || {}).value || '';
  var issues = allIssues.slice();
  if (rm) issues = issues.filter(function (r) { return monthOf(r) === rm; });
  if (!issues.length) {
    uiAlert('No issues to export' + (rm ? (' for ' + rm) : '') + '.');
    return;
  }
  var btnId = ISSUE_CFG.excelBtnId || 'xlIssueBtn';
  var btn = document.getElementById(btnId);
  var orig = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Exporting…';
  }
  try {
    await loadXlsxLib();
    var wb = buildIssueExcelWorkbook(issues, rm);
    var prefix = ISSUE_CFG.reportFilePrefix || 'Empire-Issues-';
    window.XLSX.writeFile(wb, prefix + (rm || 'all') + '.xlsx');
  } catch (e) {
    uiAlert('❌ Export failed: ' + (e.message || e));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }
}
