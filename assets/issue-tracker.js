/* Empire World EGS \u2014 issue tracker (Phase 2 Step 2.5)
 * Shared logic for civil / fire / electric. Set ISSUE_CFG before loading this file.
 */
function issueLs(k){ return localStorage.getItem(ISSUE_CFG.prefix+'_'+k)||''; }
function issueSetLs(k,v){ localStorage.setItem(ISSUE_CFG.prefix+'_'+k,v); }
function issueRemoveLs(k){ localStorage.removeItem(ISSUE_CFG.prefix+'_'+k); }
function issueToken(){ return empireGetToken(); }
var spots, issueTypes;
function initIssueCfg(){
  if(!ISSUE_CFG) throw new Error('ISSUE_CFG must be set before loading issue-tracker.js');
  spots=ISSUE_CFG.spots;
  issueTypes=ISSUE_CFG.issueTypes;
  ISSUE_SHARE_DEPT=ISSUE_CFG.shareDept;
  ISSUES_CACHE_KEY=ISSUE_CFG.prefix+'_issues_cache';
  ISSUES_CACHE_TS_KEY=ISSUE_CFG.prefix+'_issues_cache_ts';
  ISSUE_VIEW_KEY=ISSUE_CFG.prefix+'_issue_view';
}
initIssueCfg();

var _workerFixPhotos = [];
var _workerFixId = null;
var _workerUploading = 0;
function parseFixedPhotos(fp) {
  fp = String(fp || '').trim();
  if (!fp) return [];
  if (fp.charAt(0) === '[') {
    try {
      var arr = JSON.parse(fp);
      if (Array.isArray(arr)) {
        return arr.map(function (u) { return String(u || '').trim(); }).filter(function (u) { return u.indexOf('http') === 0; });
      }
    } catch (e) {}
  }
  if (fp.indexOf('|') !== -1) {
    return fp.split('|').map(function (u) { return u.trim(); }).filter(function (u) { return u.indexOf('http') === 0; });
  }
  if (fp.indexOf(',http') !== -1) {
    return fp.split(/,(?=https?:\/\/)/).map(function (u) { return u.trim(); }).filter(Boolean);
  }
  return fp.indexOf('http') === 0 ? [fp] : [];
}
function joinFixedPhotos(urls) {
  return JSON.stringify((urls || []).filter(Boolean));
}
function issueFixedPhotos(r) {
  if (!r) return [];
  if (r.fixedPhotos && r.fixedPhotos.length) return r.fixedPhotos;
  return parseFixedPhotos(r.fixedPhoto);
}
function fixedPhotosBlockHtml(fixedPhoto, r) {
  var urls = r ? issueFixedPhotos(r) : parseFixedPhotos(fixedPhoto);
  if (!urls.length) return '<p style="color:var(--text-faint);">Not fixed yet</p>';
  var count = urls.length > 1 ? '<p class="fixed-photo-count">' + urls.length + ' photos</p>' : '';
  var imgs = urls.map(function (u, i) {
    return '<img src="' + u + '" onclick="bigImg(this.src)" alt="Fixed photo ' + (i + 1) + '" title="Photo ' + (i + 1) + '">';
  }).join('');
  return count + '<div class="fixed-photo-grid">' + imgs + '</div>';
}
function isCivilWorker() { return !!(ISSUE_CFG.workerMode && String(empireGetRole() || '').toLowerCase() === 'worker'); }
function canMarkIssueFixed() {
  var p = PAGEPERMS || {};
  if (isCivilWorker()) return true;
  if (ISSUE_CFG.engineerCanMarkFixed === false) return false;
  return p.fix === true || p.edit !== false;
}
function tradeGroups() { return ISSUE_CFG.tradeGroups || []; }
function tradeGroupLabel(id) {
  id = String(id || '').trim().toLowerCase();
  if (!id) return 'Unassigned';
  var g = tradeGroups().find(function (x) { return x.id === id; });
  return g ? g.label : id;
}
function initTradeFilters() {
  if (!tradeGroups().length) return;
  var sel = document.getElementById('f-group');
  if (!sel) return;
  var cur = sel.value;
  while (sel.options.length > 2) sel.remove(2);
  tradeGroups().forEach(function (g) {
    var o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.label;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}
function tradeBadgeHtml(r) {
  if (!tradeGroups().length) return '';
  var lbl = tradeGroupLabel(r.assignedGroup);
  var cls = r.assignedGroup ? 'trade-badge' : 'trade-badge unassigned';
  return '<span class="' + cls + '">' + lbl + '</span>';
}
function issueWorkersRequired(r) {
  return r && Number(r.workersRequired) >= 2 ? 2 : 1;
}
function issueWorkerDone(r) {
  if (!r) return 0;
  if (r.workerDone) return Number(r.workerDone) || 0;
  return (r.workerCompletions && r.workerCompletions.length) || 0;
}
function workerCompletedByMe(r) {
  if (!r || !r.workerCompletions || !r.workerCompletions.length) return false;
  var user = String(empireGetUser() || '').trim().toLowerCase();
  if (!user) return false;
  for (var i = 0; i < r.workerCompletions.length; i++) {
    if (String((r.workerCompletions[i] && r.workerCompletions[i].user) || '').trim().toLowerCase() === user) return true;
  }
  return false;
}
function myWorkerCompletion(r) {
  if (!r || !r.workerCompletions) return null;
  var user = String(empireGetUser() || '').trim().toLowerCase();
  for (var i = 0; i < r.workerCompletions.length; i++) {
    var c = r.workerCompletions[i];
    if (String((c && c.user) || '').trim().toLowerCase() === user) return c;
  }
  return null;
}
function workersCompletedNames(r) {
  if (!r || !r.workerCompletions || !r.workerCompletions.length) return [];
  return r.workerCompletions.map(function (c) {
    return String((c && c.user) || '').trim();
  }).filter(Boolean);
}
function workersCompletedSummaryHtml(r) {
  if (!r || issueWorkersRequired(r) < 2) return '';
  var names = workersCompletedNames(r);
  if (!names.length) return '';
  var need = issueWorkersRequired(r);
  var done = names.length;
  var label = names.map(function (n) { return checkIconHtml('#1d9e75') + ' ' + n; }).join(' &middot; ');
  var wait = done < need ? ' <span class="workers-waiting">(waiting for ' + (need - done) + ' more)</span>' : '';
  return '<div class="workers-done-summary">' + label + wait + '</div>';
}
function twoWorkersStatusHtml(r) {
  if (!r || issueWorkersRequired(r) < 2) return '';
  var done = issueWorkerDone(r);
  var names = workersCompletedNames(r);
  var h = '<p style="margin-top:4px;color:var(--c-warn,#b8860b);"><strong>2 workers required:</strong> ' + done + '/2 marked as fixed.</p>';
  if (names.length) {
    h += '<p style="margin-top:4px;font-size:13px;color:var(--text-soft);"><strong>Completed by:</strong> ' + names.join(', ') + '</p>';
  }
  return h;
}
function issueMetaRow(label, value) {
  var v = (value === undefined || value === null || String(value).trim() === '') ? '\u2014' : String(value);
  return '<div class="issue-meta-row"><span class="issue-meta-label">' + label + '</span><span class="issue-meta-value">' + v + '</span></div>';
}
function propertyStr(r) {
  if (!r) return '';
  var spot = String(r.spot || '').trim();
  if (spot) spot = spot.charAt(0).toLowerCase() + spot.slice(1);
  var b = String(r.building || '').trim();
  var f = String(r.floor || '').trim();
  return b + '-' + f + (spot ? '. ' + spot : '');
}
function issueFixedDisplay(r) {
  if (r.status === 'fixed') {
    var d = dateOnly(r.fixedAt);
    var who = String(r.fixedBy || '').trim();
    return d + (who ? ' (' + who + ')' : '');
  }
  if (issueWorkersRequired(r) >= 2 && r.workerCompletions && r.workerCompletions.length) {
    return r.workerCompletions.map(function (c) {
      return dateOnly(c.at) + (c.user ? ' (' + c.user + ')' : '');
    }).join(', ');
  }
  return '';
}
function issueFixedTimeDisplay(r) {
  if (r.status === 'fixed' && r.fixedAt) return fmtDT(r.fixedAt);
  return '';
}
function issueDetailMetaSectionHtml(r) {
  var reported = dateOnly(r.date || r.createdAt) + (r.createdBy ? ' (' + r.createdBy + ')' : '');
  var team = tradeGroups().length ? (tradeGroupLabel(r.assignedGroup) || 'Unassigned') : '';
  var h = '<div class="issue-meta-wrap">';
  h += '<div class="issue-meta-status">' + issueStatusBadgeHtml(r) + workersBadgeHtml(r) + '</div>';
  h += '<div class="issue-meta-list">';
  h += issueMetaRow('Ref:', '#' + issueRef(r.num));
  h += issueMetaRow('Issue task:', r.issueType);
  h += issueMetaRow('Property:', propertyStr(r));
  h += issueMetaRow('Reported:', reported);
  h += issueMetaRow('Fixed:', issueFixedDisplay(r));
  h += issueMetaRow('Note:', r.note || '');
  h += issueMetaRow('Fixed time:', issueFixedTimeDisplay(r));
  h += issueMetaRow('Team:', team);
  h += '</div></div>';
  return h;
}
function workersBadgeHtml(r) {
  if (!r || issueWorkersRequired(r) < 2 || r.status === 'fixed') return '';
  return '<span class="workers-badge">' + issueWorkerDone(r) + '/2 workers</span>';
}
function issueStatusBadgeHtml(r) {
  if (r.status === 'fixed') return '<span class="badge fixed">' + checkIconHtml('currentColor') + ' Fixed</span>';
  var done = issueWorkerDone(r);
  if (issueWorkersRequired(r) >= 2 && done > 0) {
    return '<span class="badge partial">' + squareIconHtml('currentColor') + ' ' + done + '/2 done</span>';
  }
  return '<span class="badge open">' + squareIconHtml('currentColor') + ' Open</span>';
}
function workerCompletionsBlockHtml(r) {
  if (!r || !r.workerCompletions || !r.workerCompletions.length) return '';
  if (issueWorkersRequired(r) >= 2) return '';
  var title = 'Worker progress';
  var h = '<div class="worker-completions"><p style="color:var(--text-soft);margin:0 0 8px;font-weight:600;">' + title + '</p>';
  r.workerCompletions.forEach(function (c) {
    h += '<div class="worker-completion-item"><p style="margin:0 0 6px;font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="worker-done-badge">' + checkIconHtml('#fff') + ' Marked as fixed</span><strong>' + (c.user || 'Worker') + '</strong>' + (c.at ? ('<span style="color:var(--text-faint);font-weight:400;">&middot; ' + dateOnly(c.at) + '</span>') : '') + '</p>';
    if (c.photos && c.photos.length) {
      h += '<div class="fixed-photo-grid">';
      c.photos.forEach(function (u, i) {
        h += '<img src="' + u + '" onclick="bigImg(this.src)" alt="Worker photo ' + (i + 1) + '">';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}
function workerCompletionsAsideHtml(r) {
  if (!r || issueWorkersRequired(r) < 2) return '';
  var completions = r.workerCompletions || [];
  var h = '<div class="beforeafter-workers"><p class="beforeafter-workers-title">Workers who marked as fixed</p>';
  if (!completions.length) {
    h += '<p class="beforeafter-workers-empty">Waiting for workers to submit photos.</p>';
  } else {
    completions.forEach(function (c) {
      h += '<div class="worker-aside-item">';
      h += '<div class="worker-aside-head"><span class="worker-done-badge">' + checkIconHtml('#fff') + ' Marked as fixed</span><strong>' + (c.user || 'Worker') + '</strong></div>';
      h += '<div class="worker-aside-meta">' + issueMetaRow('Note:', c.note || '') + issueMetaRow('Fixed time:', fmtDT(c.at) || dateOnly(c.at) || '') + '</div>';
      if (c.photos && c.photos.length) {
        h += '<div class="fixed-photo-grid">';
        c.photos.forEach(function (u, i) {
          h += '<img src="' + u + '" onclick="bigImg(this.src)" alt="Worker photo ' + (i + 1) + '">';
        });
        h += '</div>';
      }
      h += '</div>';
    });
  }
  h += '</div>';
  return h;
}
function issuePhotosSectionHtml(r) {
  var h = '<div class="beforeafter">';
  h += '<div class="beforeafter-problem"><p style="color:var(--text-soft);margin-bottom:6px;">Problem</p>';
  h += r.photo ? '<img src="' + r.photo + '" onclick="bigImg(this.src)">' : '<p>No photo</p>';
  h += '</div>';
  if (issueWorkersRequired(r) >= 2) {
    h += workerCompletionsAsideHtml(r);
  } else {
    h += '<div class="beforeafter-fixed"><p style="color:var(--text-soft);margin-bottom:6px;">Fixed' + (issueFixedPhotos(r).length > 1 ? ' (' + issueFixedPhotos(r).length + ' photos)' : '') + '</p>';
    h += fixedPhotosBlockHtml(r.fixedPhoto, r);
    h += '</div>';
  }
  h += '</div>';
  return h;
}
function workersRequiredFromAssignEl(id) {
  var el = document.getElementById('assign-two-workers-' + id);
  return el && el.checked ? 2 : 1;
}
function bulkWorkersRequired() {
  var el = document.getElementById('bulk-assign-two-workers');
  return el && el.checked ? 2 : 1;
}
function setAssignBtnState(id, state) {
  var btn = document.getElementById('assign-btn-' + id);
  if (!btn) return;
  btn.classList.remove('saving', 'saved', 'error');
  if (state === 'saving') {
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';
    btn.classList.add('saving');
  } else if (state === 'saved') {
    btn.disabled = false;
    btn.textContent = 'Saved';
    btn.classList.add('saved');
  } else if (state === 'error') {
    btn.disabled = false;
    btn.textContent = 'Save';
    btn.classList.add('error');
  } else {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}
function patchIssueModalAssign(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r) return;
  var wrap = document.querySelector('#issueBox .issue-meta-wrap');
  if (wrap) wrap.outerHTML = issueDetailMetaSectionHtml(r);
}
function assignIssue(id) {
  var sel = document.getElementById('assign-group-' + id);
  if (!sel || !ISSUE_CFG.actions.assign) return;
  var group = sel.value;
  var workersRequired = workersRequiredFromAssignEl(id);
  var it = allIssues.find(function (x) { return x.id === id; });
  var prevGroup = it ? (it.assignedGroup || '') : '';
  var prevWorkersRequired = it ? issueWorkersRequired(it) : 1;
  if (it) {
    it.assignedGroup = group;
    it.workersRequired = workersRequired;
    it.workerCompletions = [];
    it.workerDone = 0;
    it.fixedPhoto = '';
    it.fixedBy = '';
  }
  writeIssuesCacheAsync(allIssues);
  setAssignBtnState(id, 'saving');
  patchIssueModalAssign(id);
  fetchJSONRetry({ action: ISSUE_CFG.actions.assign, id: id, assignedGroup: group, workersRequired: workersRequired, token: issueToken() || '' }, 2, 90000)
    .then(function (d) {
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Assign failed');
      }
      if (it) {
        if (d && d.assignedGroup !== undefined) it.assignedGroup = d.assignedGroup;
        if (d && d.workersRequired !== undefined) it.workersRequired = d.workersRequired;
      }
      writeIssuesCacheAsync(allIssues);
      setAssignBtnState(id, 'saved');
      patchIssueModalAssign(id);
      requestAnimationFrame(function () { renderIssues(); });
    })
    .catch(function (e) {
      if (it) {
        it.assignedGroup = prevGroup;
        it.workersRequired = prevWorkersRequired;
      }
      writeIssuesCacheAsync(allIssues);
      setAssignBtnState(id, 'error');
      patchIssueModalAssign(id);
      var msg = assignIssueErrorMsg(e);
      alert('\u274C ' + msg);
      var btn = document.getElementById('assign-btn-' + id);
      if (btn) {
        btn.textContent = 'Retry';
        setTimeout(function () { setAssignBtnState(id, 'idle'); }, 2200);
      }
    });
}
function enterWorkerApp() {
  document.getElementById('loginPage').classList.remove('show');
  document.getElementById('mainContainer').classList.remove('show');
  var wa = document.getElementById('workerApp');
  if (wa) wa.classList.add('show');
  var trade = empireGetTrade() || '';
  var title = document.getElementById('workerTeamTitle');
  var user = empireGetUser() || '';
  var teamLabel = tradeGroupLabel(trade);
  if (title) title.textContent = user + ' (' + teamLabel + ' team)';
  setTimeout(function () { loadIssues(false); }, 0);
}
function renderWorkerJobs() {
  var host = document.getElementById('workerJobList');
  var bar = document.getElementById('workerCountBar');
  if (!host) return;
  var rows = allIssues.filter(function (r) { return r.status !== 'fixed' && !workerCompletedByMe(r); });
  rows.sort(compareIssuesNewestFirst);
  if (bar) bar.textContent = rows.length + ' open job' + (rows.length === 1 ? '' : 's') + ' for your team';
  if (!rows.length) {
    host.innerHTML = '<p class="worker-empty">\u2705 No open jobs right now.<br><span style="font-size:13px;color:var(--text-soft);">Pull down or tap refresh when the engineer assigns new work.</span></p>';
    return;
  }
  host.innerHTML = rows.map(function (r) {
    var thumb = r.photo
      ? '<img class="worker-job-thumb" src="' + r.photo + '" loading="lazy" alt="">'
      : '<div class="worker-job-thumb worker-job-thumb-empty">No photo</div>';
    var twoBadge = issueWorkersRequired(r) >= 2 ? '<span class="workers-badge">' + issueWorkerDone(r) + '/2 workers</span>' : '';
    return '<div class="worker-job-card" onclick="openWorkerJob(\'' + r.id + '\')">' + thumb
      + '<div class="worker-job-body"><div class="worker-job-ref">#' + issueRef(r.num) + twoBadge + '</div>'
      + '<div class="worker-job-type">' + r.issueType + '</div>'
      + '<div class="worker-job-loc">' + locStr(r) + '</div>'
      + '<div class="worker-job-proj">' + (projectNames[r.project] || r.project) + '</div></div></div>';
  }).join('');
}
function openWorkerJob(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r) return;
  if (workerCompletedByMe(r)) {
    openWorkerJobDoneView(id);
    return;
  }
  _workerFixId = id;
  _workerFixPhotos = [];
  _workerUploading = 0;
  var title = document.getElementById('workerModalTitle');
  if (title) title.textContent = '#' + issueRef(r.num);
  var body = document.getElementById('workerModalBody');
  if (!body) return;
  var h = '<h2>' + r.issueType + '</h2><p class="loc">' + (projectNames[r.project] || r.project) + ' &middot; ' + locStr(r) + '</p>';
  if (r.note) h += '<p style="color:var(--text-soft);font-size:14px;margin-bottom:12px;"><strong>Note:</strong> ' + r.note + '</p>';
  if (issueWorkersRequired(r) >= 2) {
    h += '<p class="worker-two-note">This job needs <strong>2 workers</strong> to each take photos.' + (issueWorkerDone(r) ? (' <span>(' + issueWorkerDone(r) + ' already done)</span>') : '') + '</p>';
  }
  h += r.photo ? '<img class="worker-problem-img" src="' + r.photo + '" alt="Problem">' : '<p style="color:var(--text-faint);">No problem photo</p>';
  h += '<div class="worker-fix-section"><h3>' + checkIconHtml() + ' Complete this job</h3>';
  h += '<p style="font-size:13px;color:var(--text-soft);margin:0 0 10px;">Take photos on site with your camera. At least one photo is required. You can take several.</p>';
  h += '<div id="worker-photo-grid" class="worker-photo-grid"></div>';
  h += '<div class="worker-camera-zone" onclick="triggerWorkerCamera()" role="button" tabindex="0" aria-label="Take completion photo">';
  h += '<span class="worker-camera-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg></span>';
  h += '<strong>Tap to open camera</strong><span>Camera only — take photos on site now</span></div>';
  h += '<button type="button" class="worker-add-photo" onclick="triggerWorkerCamera()">+ Take another photo</button>';
  h += '<input type="file" id="worker-fix-file" accept="image/*" capture="environment" style="display:none" onchange="handleWorkerFixFile(event)">';
  h += '<input type="text" id="worker-fix-note" class="worker-fix-note" placeholder="Note (optional)">';
  h += '<button type="button" id="worker-submit-btn" class="worker-submit-fix" disabled onclick="submitWorkerFix(\'' + id + '\')">Mark as fixed</button></div>';
  body.innerHTML = h;
  renderWorkerPhotoGrid();
  document.getElementById('workerJobModal').classList.add('show');
}
function openWorkerJobDoneView(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r) return;
  _workerFixId = null;
  _workerFixPhotos = [];
  _workerUploading = 0;
  var title = document.getElementById('workerModalTitle');
  if (title) title.textContent = '#' + issueRef(r.num);
  var body = document.getElementById('workerModalBody');
  if (!body) return;
  var mine = myWorkerCompletion(r);
  var h = '<h2>' + r.issueType + '</h2><p class="loc">' + (projectNames[r.project] || r.project) + ' &middot; ' + locStr(r) + '</p>';
  h += '<div class="worker-done-locked"><p class="worker-done-msg">' + checkIconHtml('#1d9e75') + ' You already marked this job as fixed.</p>';
  h += '<p style="font-size:13px;color:var(--text-soft);margin:0;">You cannot add more photos for this issue.</p></div>';
  if (mine && mine.photos && mine.photos.length) {
    h += '<div class="worker-fix-section"><h3>Your submitted photos</h3><div class="worker-photo-grid">';
    mine.photos.forEach(function (url, i) {
      h += '<div class="worker-photo-item"><img src="' + url + '" onclick="bigImg(this.src)" alt="Photo ' + (i + 1) + '"><span class="worker-photo-label">Photo ' + (i + 1) + '</span></div>';
    });
    h += '</div></div>';
  }
  if (issueWorkersRequired(r) >= 2 && r.status !== 'fixed') {
    h += '<p class="worker-two-note">Waiting for another worker to complete this job (' + issueWorkerDone(r) + '/2 done).</p>';
  }
  body.innerHTML = h;
  document.getElementById('workerJobModal').classList.add('show');
}
function triggerWorkerCamera() {
  var inp = document.getElementById('worker-fix-file');
  if (inp) inp.click();
}
function renderWorkerPhotoGrid() {
  var grid = document.getElementById('worker-photo-grid');
  if (!grid) return;
  if (!_workerFixPhotos.length) {
    grid.innerHTML = '<p class="worker-photo-empty">No photos yet — tap the camera below</p>';
  } else {
    grid.innerHTML = _workerFixPhotos.map(function (url, i) {
      return '<div class="worker-photo-item"><img src="' + url + '" onclick="bigImg(this.src)" alt="Photo ' + (i + 1) + '">'
        + '<button type="button" class="worker-photo-remove" onclick="removeWorkerFixPhoto(' + i + ')" aria-label="Remove photo">&times;</button>'
        + '<span class="worker-photo-label">Photo ' + (i + 1) + '</span></div>';
    }).join('');
  }
  updateWorkerSubmitBtn();
}
function updateWorkerSubmitBtn() {
  var btn = document.getElementById('worker-submit-btn');
  if (!btn) return;
  var n = _workerFixPhotos.length;
  var ready = n > 0 && _workerUploading === 0;
  btn.disabled = !ready;
  if (_workerUploading > 0) btn.textContent = 'Uploading photo\u2026';
  else if (!n) btn.textContent = 'Mark as fixed';
  else btn.textContent = 'Mark as fixed (' + n + ' photo' + (n === 1 ? '' : 's') + ')';
}
function removeWorkerFixPhoto(idx) {
  _workerFixPhotos.splice(idx, 1);
  renderWorkerPhotoGrid();
}
function closeWorkerJob() {
  document.getElementById('workerJobModal').classList.remove('show');
  _workerFixId = null;
  _workerFixPhotos = [];
  _workerUploading = 0;
}
function handleWorkerFixFile(e) {
  var f = e.target.files && e.target.files[0];
  if (f) processWorkerFixPhoto(f);
  e.target.value = '';
}
function processWorkerFixPhoto(file) {
  if (!file || !_workerFixId) return;
  _workerUploading++;
  updateWorkerSubmitBtn();
  compressImage(file, function (url) {
    _workerUploading = Math.max(0, _workerUploading - 1);
    if (url) {
      _workerFixPhotos.push(url);
      renderWorkerPhotoGrid();
    } else {
      uiAlert('\u274c Photo upload failed. Try again.');
      updateWorkerSubmitBtn();
    }
  });
}
function submitWorkerFix(id) {
  if (!_workerFixPhotos.length) { uiAlert('Please take at least one completion photo first.'); return; }
  if (workerCompletedByMe(allIssues.find(function (x) { return x.id === id; }))) {
    uiAlert('You already marked this job as fixed.');
    closeWorkerJob();
    renderWorkerJobs();
    return;
  }
  var btn = document.getElementById('worker-submit-btn');
  var noteEl = document.getElementById('worker-fix-note');
  var note = noteEl ? noteEl.value.trim() : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
  fetchJSONRetry({ action: ISSUE_CFG.actions.markFixed, id: id, fixedPhoto: joinFixedPhotos(_workerFixPhotos), fixedPhotos: _workerFixPhotos.slice(), fixNote: note, token: issueToken() || '' })
    .then(function (d) {
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Could not save');
      }
      if (d && d.partial) {
        allIssues = allIssues.filter(function (x) { return x.id !== id; });
        writeIssuesCacheAsync(allIssues);
        closeWorkerJob();
        renderWorkerJobs();
        uiAlert('\u2705 Your fix was saved. Waiting for another worker to complete this job (' + (d.workerDone || 1) + '/2).');
        return;
      }
      allIssues = allIssues.filter(function (x) { return x.id !== id; });
      writeIssuesCacheAsync(allIssues);
      closeWorkerJob();
      renderWorkerJobs();
      uiAlert('\u2705 Job marked fixed!');
    })
    .catch(function (e) {
      if (/already_submitted|already submitted/i.test(e.message || '')) {
        allIssues = allIssues.filter(function (x) { return x.id !== id; });
        writeIssuesCacheAsync(allIssues);
        closeWorkerJob();
        renderWorkerJobs();
        uiAlert('\u2705 You already completed this job.');
        return;
      }
      uiAlert('\u274c ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Mark as fixed'; }
    });
}

var CHECK_ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
var SQUARE_ICON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>';
function checkIconHtml(color){ return '<span class="nav-icon" style="color:'+(color||'#27ae60')+';">'+CHECK_ICON+'</span>'; }
function squareIconHtml(color){ return '<span class="nav-icon" style="color:'+(color||'#C5504F')+';">'+SQUARE_ICON+'</span>'; }
var TRASH_ICON13='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
function trashIconHtml(){ return '<span class="nav-icon" style="width:13px;height:13px;">'+TRASH_ICON13+'</span>'; }
function pencilIconHtml(){ return '<span class="nav-icon" style="width:13px;height:13px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg></span>'; }
function whatsappIconHtml(){ return '<span class="nav-icon" style="width:13px;height:13px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.529 5.862L0 24l6.335-1.662A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.01-1.378l-.36-.214-3.75.984 1.001-3.648-.235-.375A9.818 9.818 0 1 1 12 21.818z"/></svg></span>'; }
function issueShareText(r){ var ref='#'+issueRef(r.num); var status=r.status==='fixed'?'Fixed':'Open'; var lines=[ISSUE_CFG.sharePrefix+' '+ref, r.issueType, locStr(r), 'Status: '+status, 'Date: '+dateOnly(r.date||r.createdAt)]; if(r.note) lines.push('Note: '+r.note); if(r.photo) lines.push('Photo: '+r.photo); return lines.join('\n'); }
var ISSUE_SHARE_DEPT;
var ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY, ISSUE_VIEW_KEY;
var issueSelectMode=false;
var selectedIssueIds={};
function selectedIssueCount(){ return Object.keys(selectedIssueIds).length; }
function toggleIssueSelectMode(){ issueSelectMode=!issueSelectMode; if(!issueSelectMode) selectedIssueIds={}; renderIssues(); }
function toggleIssueSelected(id){ if(selectedIssueIds[id]) delete selectedIssueIds[id]; else selectedIssueIds[id]=true; renderIssues(); }
function clearIssueSelection(){ selectedIssueIds={}; renderIssues(); }
function issueShareBlock(r, idx){ var ref='#'+issueRef(r.num); var status=r.status==='fixed'?'Fixed':'Open'; var lines=[idx+'. '+ref+' \u2014 '+r.issueType, locStr(r), 'Status: '+status, 'Date: '+dateOnly(r.date||r.createdAt)]; if(r.note) lines.push('Note: '+r.note); if(r.photo) lines.push('Photo: '+r.photo); return lines.join('\n'); }
function buildIssuesShareText(ids){ var rows=ids.map(function(id){ return allIssues.find(function(x){ return x.id===id; }); }).filter(Boolean); if(!rows.length) return ''; if(rows.length===1) return issueShareText(rows[0]); var parts=['Empire World \u2014 '+rows.length+' '+ISSUE_SHARE_DEPT+'s', '']; rows.forEach(function(r,i){ parts.push(issueShareBlock(r, i+1)); if(i<rows.length-1) parts.push(''); }); return parts.join('\n'); }
function shareIssueWhatsApp(id){ var r=allIssues.find(function(x){ return x.id===id; }); if(!r) return; window.location.href='https://wa.me/?text='+encodeURIComponent(issueShareText(r)); }
function shareSelectedWhatsApp(){ var ids=Object.keys(selectedIssueIds); if(!ids.length){ alert('Select at least one issue first.'); return; } window.location.href='https://wa.me/?text='+encodeURIComponent(buildIssuesShareText(ids)); }
function canBulkAssignIssues(){ if(isCivilWorker()||!tradeGroups().length||!ISSUE_CFG.actions.assign) return false; var p=PAGEPERMS||{}; if(p.assign===true) return true; if(p.assign===false) return false; return p.edit!==false; }
function bulkAssignBlockedHint(){ if(canBulkAssignIssues()||!tradeGroups().length||!ISSUE_CFG.actions.assign) return ''; return '<span class="issue-select-hint">Team assign needs an <strong>editor</strong> or <strong>admin</strong> account. Log out and ask your admin to set your role in the Users sheet.</span>'; }
function bulkAssignTeamOptionsHtml(){ var opts='<option value="">Unassigned</option>'; tradeGroups().forEach(function(g){ opts+='<option value="'+g.id+'">'+g.label+'</option>'; }); return opts; }
function setBulkAssignBtnState(state){ var btn=document.getElementById('bulk-assign-btn'); if(!btn) return; btn.classList.remove('saving','saved','error'); if(state==='saving'){ btn.disabled=true; btn.textContent='Assigning\u2026'; btn.classList.add('saving'); } else if(state==='saved'){ btn.disabled=false; btn.textContent='Assigned'; btn.classList.add('saved'); setTimeout(function(){ setBulkAssignBtnState('idle'); }, 1800); } else if(state==='error'){ btn.disabled=false; btn.textContent='Retry'; btn.classList.add('error'); setTimeout(function(){ setBulkAssignBtnState('idle'); }, 2200); } else { btn.disabled=false; btn.textContent='Assign to team'; } }
function selectAllVisibleIssues(){ var ids=window._visibleIssueIds||[]; ids.forEach(function(id){ var it=allIssues.find(function(x){ return x.id===id; }); if(it&&it.status!=='fixed') selectedIssueIds[id]=true; }); renderIssues(); }
function assignIssueErrorMsg(e) {
  var msg = (e && e.message) ? e.message : 'Assign failed';
  if (/unknown action|invalid server response/i.test(msg)) {
    msg += '\n\nRedeploy empire-all-in-one.gs in Google Apps Script, then hard-refresh this page.';
  } else if (/not_allowed|only engineer/i.test(msg)) {
    msg += '\n\nLog out and log in again, or set your Users sheet role to editor or admin.';
  }
  return msg;
}
function assignSelectedIssues(){ var ids=Object.keys(selectedIssueIds); if(!ids.length){ alert('Select at least one issue first.'); return; } if(!canBulkAssignIssues()) return; var sel=document.getElementById('bulk-assign-group'); if(!sel) return; var group=sel.value; var workersRequired=bulkWorkersRequired(); var label=tradeGroupLabel(group); var twoNote=workersRequired>=2?' <span style="color:var(--c-warn,#b8860b);">(needs 2 workers)</span>':''; uiConfirm('Assign <strong>'+ids.length+'</strong> issue(s) to <strong>'+label+'</strong>?'+twoNote).then(function(ok){ if(!ok) return; var prev={}; ids.forEach(function(id){ var it=allIssues.find(function(x){ return x.id===id; }); if(it){ prev[id]={assignedGroup:it.assignedGroup||'',workersRequired:issueWorkersRequired(it),workerCompletions:it.workerCompletions||[]}; it.assignedGroup=group; it.workersRequired=workersRequired; it.workerCompletions=[]; it.workerDone=0; it.fixedPhoto=''; it.fixedBy=''; } }); writeIssuesCacheAsync(allIssues); setBulkAssignBtnState('saving'); requestAnimationFrame(function(){ renderIssues(); }); fetchJSONRetry({ action:ISSUE_CFG.actions.assign, ids:ids, assignedGroup:group, workersRequired:workersRequired, token:issueToken()||'' }, 2, 90000).then(function(d){ if(d&&d.ok===false){ if(empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return; throw new Error(d.message||d.error||'Assign failed'); } if(d&&d.assignedGroup!==undefined){ ids.forEach(function(id){ var it=allIssues.find(function(x){ return x.id===id; }); if(it){ it.assignedGroup=d.assignedGroup; if(d.workersRequired!==undefined) it.workersRequired=d.workersRequired; } }); } writeIssuesCacheAsync(allIssues); setBulkAssignBtnState('saved'); requestAnimationFrame(function(){ renderIssues(); }); }).catch(function(e){ ids.forEach(function(id){ var it=allIssues.find(function(x){ return x.id===id; }); if(it&&prev[id]){ it.assignedGroup=prev[id].assignedGroup; it.workersRequired=prev[id].workersRequired; it.workerCompletions=prev[id].workerCompletions; it.workerDone=(prev[id].workerCompletions||[]).length; } }); writeIssuesCacheAsync(allIssues); setBulkAssignBtnState('error'); alert('\u274C '+assignIssueErrorMsg(e)); requestAnimationFrame(function(){ renderIssues(); }); }); }); }
function issueSelectToolbarHtml(){ var cnt=selectedIssueCount(); var bulk=canBulkAssignIssues(); var hint=bulk?'Tap cards to select several, then assign to a team or share on WhatsApp.':'Tap cards to pick several, then share on WhatsApp.'; if(!issueSelectMode) return '<div class="issue-select-bar"><span>'+hint+'</span><button type="button" onclick="toggleIssueSelectMode()" style="padding:8px 14px;font-size:12px;margin-left:auto;">Select issues</button></div>'; var h='<div class="issue-select-bar issue-select-bar-active"><div class="issue-select-row"><span><strong>'+cnt+'</strong> selected</span>'; if(bulk){ h+='<select id="bulk-assign-group" class="bulk-assign-select" onclick="event.stopPropagation()">'+bulkAssignTeamOptionsHtml()+'</select><label class="assign-two-workers"><input type="checkbox" id="bulk-assign-two-workers"> 2 workers</label><button type="button" id="bulk-assign-btn" class="bulk-assign-btn" onclick="assignSelectedIssues()" '+(cnt?'':'disabled style="opacity:0.55;"')+'>Assign to team</button>'; } else { h+=bulkAssignBlockedHint(); } h+='</div><div class="issue-select-row">'; h+='<button type="button" onclick="shareSelectedWhatsApp()" style="background:#25D366;color:#fff;border:none;padding:8px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;'+(cnt?'':'opacity:0.55;')+'" '+(cnt?'':'disabled')+'>'+whatsappIconHtml()+' Share on WhatsApp</button><button type="button" onclick="selectAllVisibleIssues()" style="padding:8px 14px;font-size:12px;">Select all</button><button type="button" onclick="clearIssueSelection()" style="padding:8px 14px;font-size:12px;">Clear</button><button type="button" onclick="toggleIssueSelectMode()" style="padding:8px 14px;font-size:12px;margin-left:auto;">Done</button></div></div>'; return h; }
const IMGBB_API_KEY = '273d26dbc835282f5909b5f3e1fb8685';
const projectNames = {ec:'Empire Complex',es:'Empire Square',wd:'West Diamond',ww:'West Wing',ra:'Royal Apartment'};
function selectProjectFilter(p){ var fp=document.getElementById('f-project'); if(fp) fp.value=p; renderIssues(); if(window._issueFilterState) window._issueFilterState.save(); }
const floors = {ec:{EC1:['Ground','F1','F2','F3','F4','F5'],EC2:['Ground','F1','F2','F3','F4','F5'],EC3:['Ground','F1','F2','F3','F4','F5'],EC4:['B1','Ground','F1','F2','F3','F4','F5'],EC5:['B1','Ground','F1','F2','F3','F4','F5'],EC6:['B1','Ground','F1','F2','F3','F4','F5']},es:{ES1:['B1','B2','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'],ES2:['B1','B2','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'],ES3:['B1','B2','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'],ES4:['B1','B2','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'],ES6:['B1','B2','B3','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24']},wd:{'WD-A':['B1','B2','R','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21'],'WD-B':['B1','B2','R','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23'],'WD-C':['B1','B2','R','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21']},ww:{WW1:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8'],WW2:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10'],WW3:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],WW4:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14'],WW5:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16'],WW6:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18'],WW7:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'],WW8:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22'],WW9:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24'],WW10:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26'],WW11:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26'],WW12:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30'],WW13:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30'],WW14:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30'],WW15:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30']},ra:{'RA-A1':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A2':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A3':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A4':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A5':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A6':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A7':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A8':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A9':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A10':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A11':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-A12':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B1':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B2':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B3':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B4':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B5':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B6':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B7':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B8':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B9':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B10':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B11':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-B12':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9'],'RA-C1':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11'],'RA-C2':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11'],'RA-C3':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11'],'RA-C4':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],'RA-C5':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],'RA-C6':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11'],'RA-C7':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11'],'RA-C8':['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11']}};
let allIssues = [];
let currentIssueImage = '';
let uploadingIssue = false;
let PAGEPERMS = {};
function applyPerms(){ if(window.tsPerm) window.tsPerm(); if(window.tsLoadGlobal&&issueToken()) window.tsLoadGlobal();
  try { PAGEPERMS = empireGetPerms(); } catch(e) { PAGEPERMS = {}; }
  var p = PAGEPERMS || {};
  function hideTab(act){ document.querySelectorAll('.tab-btn').forEach(function(b){ var o=b.getAttribute('onclick')||''; if(o.indexOf("'"+act+"'")!==-1) b.style.display='none'; }); }
  if(p.add===false) hideTab('add');
  if(p.analytics===false) hideTab('analytics');
  var hideCategories = isCivilWorker() || p.categories === false;
  document.querySelectorAll('.side-actions button').forEach(function(b){
    var o=b.getAttribute('onclick')||'';
    if(o.indexOf('cleaning.html')!==-1) b.style.display = hideCategories ? 'none' : '';
    if(isCivilWorker() && (o.indexOf('openResetModal')!==-1 || o.indexOf('rbOpen')!==-1)) b.style.display='none';
  });
  var loginBack = document.querySelector('#loginPage .back');
  if (loginBack) {
    var href = loginBack.getAttribute('href') || '';
    if (href.indexOf('cleaning.html') !== -1) loginBack.style.display = hideCategories ? 'none' : '';
  }
  if (isCivilWorker()) {
    hideTab('add');
    hideTab('analytics');
  }
  var rb=document.querySelector('button[onclick="openResetModal()"]'); if(rb && p.reset!==true) rb.style.display='none'; var tb=document.getElementById('btnTrash'); if(tb && p.reset!==true) tb.style.display='none';
  var wl=document.getElementById('whoLabel'); if(wl){ var u=empireGetUser()||''; var role=empireGetRole()||''; wl.textContent = u ? ('Logged in as: '+u+(role?(' ('+role+')'):'')) : ''; }
}
function handleLogin(e){ empireAuthLogin(e, ISSUE_CFG.dept, { onSuccess: function(d){ PAGEPERMS=d.perms||{}; if(typeof empireAuthSet==='function' && d.trade) empireAuthSet('trade', d.trade); if(isCivilWorker()) enterWorkerApp(); else enterApp(); applyPerms(); } }); }
function logout(){ empireAuthLogout({ extraKeys: [ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY], redirect: 'index.html', reload: false }); }
function issueSessionLogoutOpts(){ return { extraKeys: [ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY], redirect: 'index.html', reload: false }; }
function forceSessionLogout(d){ empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts()); }
function uploadToImgbb(file,cb){ const r=new FileReader(); r.onload=e=>{ const b64=e.target.result.split(',')[1]; const fd=new FormData(); fd.append('image',b64); fd.append('key',IMGBB_API_KEY); fetch('https://api.imgbb.com/1/upload',{method:'POST',body:fd}).then(x=>x.json()).then(d=>{ cb(d.success&&d.data?d.data.url:null); }).catch(()=>cb(null)); }; r.readAsDataURL(file); }
function compressImage(file,cb){ const r=new FileReader(); r.onload=e=>{ const img=new Image(); img.onload=()=>{ var mx=1400; var s=Math.min(1, mx/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height); c.toBlob(b=>uploadToImgbb(b,cb),'image/jpeg',0.7); }; img.src=e.target.result; }; r.readAsDataURL(file); }
function processIssuePhoto(file){ if(!file) return; const area=document.getElementById('ci-imageArea'); area.innerHTML='\u23F3 Uploading\u2026'; uploadingIssue=true; compressImage(file,url=>{ uploadingIssue=false; if(url){ currentIssueImage=url; const im=document.getElementById('ci-image'); im.src=url; im.style.display='block'; area.innerHTML='\u2705 Photo uploaded'; } else { area.innerHTML='\u274C Upload failed, try again'; } }); }
function handlePaste(e,which){ const items=e.clipboardData.items; for(let i=0;i<items.length;i++){ if(items[i].type.indexOf('image')!==-1){ e.preventDefault(); processIssuePhoto(items[i].getAsFile()); return; } } }
function handleIssueFile(e){ const f=e.target.files && e.target.files[0]; if(f) processIssuePhoto(f); e.target.value=''; }
function populateSelect(id,arr,useKeys){ const el=document.getElementById(id); el.innerHTML=''; arr.forEach(v=>{ const o=document.createElement('option'); if(useKeys){ o.value=v; o.textContent=projectNames[v]; } else { o.value=v; o.textContent=v; } el.appendChild(o); }); }
function updateCIBuildings(){ const p=document.getElementById('ci-project').value; const bs=Object.keys(floors[p]||{}); const el=document.getElementById('ci-building'); el.innerHTML=''; bs.forEach(b=>{ const o=document.createElement('option'); o.value=b;o.textContent=b; el.appendChild(o); }); updateCIFloors(); }
function updateCIFloors(){ const p=document.getElementById('ci-project').value; const b=document.getElementById('ci-building').value; const fs=(floors[p]&&floors[p][b])?floors[p][b]:[]; const el=document.getElementById('ci-floor'); el.innerHTML=''; fs.forEach(f=>{ const o=document.createElement('option'); o.value=f;o.textContent=f; el.appendChild(o); }); }
function toggleOther(){ document.getElementById('ci-otherwrap').style.display = document.getElementById('ci-issuetype').value==='Other'?'flex':'none'; }
function clearIssueForm(){ currentIssueImage=''; document.getElementById('ci-image').style.display='none'; document.getElementById('ci-imageArea').innerHTML='Click here and paste (Ctrl+V)'; document.getElementById('ci-note').value=''; document.getElementById('ci-other').value=''; var sv=document.getElementById('ci-supervisor'); if(sv) sv.value=''; window._editingId=null; var eb=document.getElementById('editBanner'); if(eb) eb.style.display='none'; }
function saveIssue(){ if(uploadingIssue){ alert('Please wait for the photo to finish uploading.'); return; } let itype=document.getElementById('ci-issuetype').value; if(itype==='Other'){ const o=document.getElementById('ci-other').value.trim(); if(!o){ alert('Please describe the Other issue.'); return; } itype=o; } var supervisor=document.getElementById('ci-supervisor').value; if(!supervisor){ alert('Please select the supervisor.'); return; } function go(){ var btn=document.getElementById('saveIssueBtn'); var oldTxt=btn?btn.innerHTML:''; if(btn){ btn.disabled=true; btn.style.opacity='0.6'; btn.innerHTML='\u23F3 Saving\u2026'; } var newId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(16).slice(2)); const rec={ action:ISSUE_CFG.actions.add, id:newId, project:document.getElementById('ci-project').value, building:document.getElementById('ci-building').value, floor:document.getElementById('ci-floor').value, spot:document.getElementById('ci-spot').value, issueType:itype, note:document.getElementById('ci-note').value, supervisor:supervisor, date:document.getElementById('ci-date').value||new Date().toISOString().split('T')[0], photo:currentIssueImage, token:issueToken()||'' }; if(window._editingId){ rec.id=window._editingId; rec.action=rec.action.replace('add','update'); } fetchJSONRetry(rec).then(function(d){ if(d&&d.ok===false){ if(empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return; throw new Error(d.message||d.error||'Save failed'); } var wasEdit=!!window._editingId; window._editingId=null; alert(wasEdit?'\u2705 Issue updated!':'\u2705 Issue saved!'); clearIssueForm(); loadIssues(true); switchTabTo('list'); }).catch(function(e){ alert('\u274C Error: '+e.message); }).finally(function(){ if(btn){ btn.disabled=false; btn.style.opacity=''; btn.innerHTML=oldTxt; } }); } if(!currentIssueImage){ uiConfirm('No photo attached. Save anyway?').then(function(ok){ if(ok) go(); }); return; } go(); }
var ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY, ISSUE_VIEW_KEY;

var ISSUES_CACHE_TTL=300000;
var _issuesFetchCtrl=null;
function readIssuesCache(){ try{ var s=localStorage.getItem(ISSUES_CACHE_KEY); if(!s) return null; var a=JSON.parse(s); return Array.isArray(a)?a:null; }catch(e){ return null; } }
function readIssuesCacheTs(){ try{ return Number(localStorage.getItem(ISSUES_CACHE_TS_KEY)||0); }catch(e){ return 0; } }
function writeIssuesCache(a){ try{ localStorage.setItem(ISSUES_CACHE_KEY, JSON.stringify(a)); localStorage.setItem(ISSUES_CACHE_TS_KEY, String(Date.now())); }catch(e){} }
function writeIssuesCacheAsync(a){ var run=function(){ writeIssuesCache(a); }; if(window.requestIdleCallback) requestIdleCallback(run,{timeout:3000}); else setTimeout(run,0); }
function fetchIssuesFromServer(signal){ return fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:ISSUE_CFG.actions.get,token:issueToken()||''}),signal:signal}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
var _issuesListSig='';
function issuesListSig(arr){ if(!arr||!arr.length) return '0'; return arr.length+'|'+String(arr[0].id)+'|'+String(arr[arr.length-1].id)+'|'+String(arr[0].status)+'|'+String(arr[arr.length-1].status); }
function setIssuesFromData(arr){ var sig=issuesListSig(arr); var changed=(sig!==_issuesListSig); _issuesListSig=sig; allIssues=arr; return changed; }
function deferHeavyRenders(){ var run=function(){ var ac=document.getElementById('analytics'); if(ac&&ac.classList.contains('active')) renderAnalytics(); }; if(window.requestIdleCallback) requestIdleCallback(run,{timeout:2500}); else setTimeout(run,80); }
function loadIssues(force){ force=!!force; if(isCivilWorker()){ var cached=readIssuesCache(); if(cached){ setIssuesFromData(cached); renderWorkerJobs(); } } var cached=readIssuesCache(); if(cached && !isCivilWorker()){ setIssuesFromData(cached); requestAnimationFrame(function(){ renderIssues(); deferHeavyRenders(); }); } var spinEls=[document.getElementById('listRefreshIcon'),document.getElementById('navRefreshIcon'),document.getElementById('workerRefreshIcon')]; var cacheFresh=cached && !force && (Date.now()-readIssuesCacheTs()<ISSUES_CACHE_TTL); if(cacheFresh) return; var it=document.getElementById('issuesTable'); if(it && !cached && !isCivilWorker()) it.innerHTML=LOADING_HTML; spinEls.forEach(function(el){ if(el) el.classList.add('spinning'); }); if(_issuesFetchCtrl) try{ _issuesFetchCtrl.abort(); }catch(e){} _issuesFetchCtrl=new AbortController(); fetchIssuesFromServer(_issuesFetchCtrl.signal).then(function(d){ if(Array.isArray(d)){ var changed=setIssuesFromData(d); writeIssuesCacheAsync(d); if(isCivilWorker()) renderWorkerJobs(); else if(changed){ requestAnimationFrame(function(){ renderIssues(); deferHeavyRenders(); }); } } else if(d&&d.ok===false){ forceSessionLogout(d); } }).catch(function(e){ if(e&&e.name==='AbortError') return; if(!cached && it && !isCivilWorker()) it.innerHTML='<p>Error loading: '+e.message+'</p>'; if(isCivilWorker()){ var wl=document.getElementById('workerJobList'); if(wl && !cached) wl.innerHTML='<p class="worker-empty">Error: '+e.message+'</p>'; } }).finally(function(){ spinEls.forEach(function(el){ if(el) el.classList.remove('spinning'); }); }); }
function locStr(r){ return r.building+' \u00B7 '+r.floor+' \u00B7 '+r.spot; }
function dayOf(r){ var d=String(r.date||r.createdAt||''); if(/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0,10); var dt=new Date(d.replace(' ','T')); if(!isNaN(dt.getTime())){ var z=function(n){return String(n).padStart(2,'0');}; return dt.getFullYear()+'-'+z(dt.getMonth()+1)+'-'+z(dt.getDate()); } return ''; }
function monthOf(r){ var d=String(r.date||r.createdAt||''); if(!/^\d{4}-\d{2}-\d{2}/.test(d)) return ''; var yr=parseInt(d.slice(0,4),10), mo=parseInt(d.slice(5,7),10), dy=parseInt(d.slice(8,10),10); if(dy>=26){ mo+=1; if(mo>12){mo=1;yr+=1;} } return yr+'-'+String(mo).padStart(2,'0'); }
function removeIssue(id){ uiConfirm('Delete this issue? It will go to the Recycle Bin.').then(function(ok){ if(!ok)return; fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:ISSUE_CFG.actions.delete,id:id,token:issueToken()||''})}).then(function(r){return r.json();}).then(function(d){ if(d&&(d.ok||d.success)){ allIssues=allIssues.filter(function(x){return x.id!==id;}); renderIssues(); renderAnalytics(); } else { alert('\u274C '+((d&&(d.error||d.message))||'Delete failed')); } }).catch(function(e){ alert('\u274C '+e.message); }); }); }
function editIssue(id){ var r=allIssues.find(function(x){return x.id===id;}); if(!r) return; switchTabTo('add'); window._editingId=id;
  var pj=document.getElementById('ci-project'); if(pj) pj.value=r.project||''; updateCIBuildings();
  var bd=document.getElementById('ci-building'); if(bd) bd.value=r.building||''; updateCIFloors();
  var fl=document.getElementById('ci-floor'); if(fl) fl.value=r.floor||'';
  var sp=document.getElementById('ci-spot'); if(sp) sp.value=r.spot||'';
  var it=document.getElementById('ci-issuetype'); var other=document.getElementById('ci-other');
  if(issueTypes.indexOf(r.issueType)!==-1){ it.value=r.issueType; if(other) other.value=''; } else { it.value='Other'; if(other) other.value=r.issueType||''; } toggleOther();
  document.getElementById('ci-date').value=dateOnly(r.date||r.createdAt)||''; document.getElementById('ci-note').value=r.note||'';
  var sv=document.getElementById('ci-supervisor'); if(sv) sv.value=r.createdBy||'';
  currentIssueImage=r.photo||''; var im=document.getElementById('ci-image'); var area=document.getElementById('ci-imageArea');
  if(r.photo){ im.src=r.photo; im.style.display='block'; area.innerHTML='\u2705 Current photo (paste a new one to replace)'; } else { im.style.display='none'; area.innerHTML='Click here and paste (Ctrl+V)'; }
  var eb=document.getElementById('editBanner'); if(eb){ var ref=document.getElementById('editBannerRef'); if(ref) ref.textContent='#'+issueRef(r.num); eb.style.display='block'; }
  window.scrollTo(0,0);
}
function cancelEdit(){ window._editingId=null; var eb=document.getElementById('editBanner'); if(eb) eb.style.display='none'; clearIssueForm(); switchTabTo('list'); }
function numToLetters(n){ var s=''; n=n+1; while(n>0){ var r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; }
function issueRef(num){ num=Number(num||0); if(!num) return ''; var idx=num-1; return numToLetters(Math.floor(idx/999))+((idx%999)+1); }
function issueSortTime(r) {
  return String((r && (r.createdAt || r.date)) || '').replace('T', ' ');
}
function compareIssuesNewestFirst(a, b) {
  var c = issueSortTime(b).localeCompare(issueSortTime(a));
  if (c !== 0) return c;
  return (Number(b.num) || 0) - (Number(a.num) || 0);
}

function getIssueViewMode(){ try{ return localStorage.getItem(ISSUE_VIEW_KEY)==='grid'?'grid':'table'; }catch(e){ return 'table'; } }
function setIssueViewMode(m){ try{ localStorage.setItem(ISSUE_VIEW_KEY,m); }catch(e){} renderIssues(); }
function issueActionBtns(r){ return '<button type="button" onclick="event.stopPropagation();shareIssueWhatsApp(\''+r.id+'\')" title="Share on WhatsApp" style="background:#25D366;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">'+whatsappIconHtml()+'</button>'+(PAGEPERMS.edit!==false?'<button type="button" onclick="event.stopPropagation();editIssue(\''+r.id+'\')" title="Edit issue" style="background:var(--accent2);color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">'+pencilIconHtml()+'</button>':'')+(PAGEPERMS.del!==false?'<button type="button" onclick="event.stopPropagation();removeIssue(\''+r.id+'\')" title="Delete issue" style="background:#C5504F;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;">'+trashIconHtml()+'</button>':''); }
function viewToggleHtml(){ var v=getIssueViewMode(); return '<div class="view-toggle"><button type="button" class="view-toggle-btn'+(v==='table'?' active':'')+'" onclick="setIssueViewMode(\'table\')" title="Table view" aria-label="Table view"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg></button><button type="button" class="view-toggle-btn'+(v==='grid'?' active':'')+'" onclick="setIssueViewMode(\'grid\')" title="Grid view" aria-label="Grid view"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button></div>'; }
function renderIssues(){ if(isCivilWorker()){ renderWorkerJobs(); return; } const fp=document.getElementById('f-project').value; const fs=document.getElementById('f-status').value; const fm=(document.getElementById('f-month')||{}).value||''; const fg=(document.getElementById('f-group')||{}).value||''; const q=(document.getElementById('f-search').value||'').toLowerCase(); let rows=allIssues.filter(r=>{ if(fp&&r.project!==fp)return false; if(fs&&r.status!==fs)return false; if(fm&&dayOf(r)!==fm)return false; if(fg){ if(fg==='unassigned'){ if(r.assignedGroup)return false; } else if(r.assignedGroup!==fg) return false; } if(q){ var qn=q.replace(/[#\s]/g,''); var ref=issueRef(r.num).toLowerCase(); if(/^[a-z]+\d+$/.test(qn)){ if(qn!==ref)return false; } else if(/^\d+$/.test(qn)){ if(String(r.num||'')!==qn)return false; } else { const hay=(r.building+' '+r.floor+' '+r.spot+' '+r.issueType).toLowerCase(); if(hay.indexOf(q)===-1)return false; } } return true; }); rows.sort(compareIssuesNewestFirst); window._visibleIssueIds=rows.map(function(r){ return r.id; }); const oc=rows.filter(r=>r.status!=='fixed').length; const fc=rows.length-oc; const openAll=allIssues.filter(r=>r.status!=='fixed'); const unAssign=openAll.filter(r=>!r.assignedGroup).length; const view=getIssueViewMode(); let teamBits=''; if(tradeGroups().length){ teamBits=' &nbsp;&mdash;&nbsp; <span style="color:var(--c-warn,#b8860b);">'+unAssign+' unassigned</span>'; } let h='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;"><p style="color:var(--text-soft);margin:0;">'+rows.length+' issue(s)'+(fm?(' in '+fm):'')+' &nbsp;&mdash;&nbsp; <span style="color:var(--open-color);">'+squareIconHtml('var(--open-color)')+' '+oc+' open</span> &nbsp;&mdash;&nbsp; <span style="color:#1d9e75;">'+checkIconHtml('#1d9e75')+' '+fc+' fixed</span>'+teamBits+'</p>'+viewToggleHtml()+'</div>'+issueSelectToolbarHtml(); if(rows.length===0){ h+='<p style="color:var(--text-faint);">No issues match.</p>'; } else if(view==='grid'){ h+='<div class="issue-grid">'; rows.forEach(function(r){ var sel=!!selectedIssueIds[r.id]; var cardClick=issueSelectMode?"toggleIssueSelected('"+r.id+"')":"openIssue('"+r.id+"')"; h+='<div class="issue-card'+(sel?' selected':'')+(issueSelectMode?' selecting':'')+'" onclick="'+cardClick+'">'+(issueSelectMode?('<div class="issue-card-check" onclick="event.stopPropagation()"><input type="checkbox"'+(sel?' checked':'')+' onclick="event.stopPropagation();toggleIssueSelected(\''+r.id+'\')" aria-label="Select issue"></div>'):'')+(r.photo?'<img class="issue-card-photo" src="'+r.photo+'" loading="lazy" alt="">':'<div class="issue-card-photo issue-card-nophoto">No photo</div>')+'<div class="issue-card-body"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;"><span style="color:var(--text-faint);font-weight:700;">#'+issueRef(r.num)+'</span>'+issueStatusBadgeHtml(r)+'</div><div style="font-weight:600;line-height:1.35;margin-bottom:6px;">'+r.issueType+tradeBadgeHtml(r)+workersBadgeHtml(r)+workersCompletedSummaryHtml(r)+(r.note?' <span style="color:var(--text-faint);font-weight:400;">('+r.note+')</span>':'')+'</div><div style="color:var(--text-soft);font-size:13px;margin-bottom:4px;">'+locStr(r)+'</div><div style="color:var(--text-faint);font-size:12px;margin-bottom:10px;">'+dateOnly(r.date)+workersCompletedSummaryHtml(r)+'</div>'+(issueSelectMode?'':('<div style="text-align:right;" onclick="event.stopPropagation()">'+issueActionBtns(r)+'</div>'))+'</div></div>'; }); h+='</div>'; } else { var teamTh=tradeGroups().length?'<th>Team</th>':''; h+='<table><thead><tr>'+(issueSelectMode?'<th style="width:36px;"></th>':'')+'<th>#</th><th>Issue</th><th>Location</th>'+teamTh+'<th>Date</th><th>Status</th><th>Photo</th>'+(issueSelectMode?'':'<th></th>')+'</tr></thead><tbody>'; rows.forEach(function(r){ var sel=!!selectedIssueIds[r.id]; var rowClick=issueSelectMode?"toggleIssueSelected('"+r.id+"')":"openIssue('"+r.id+"')"; h+='<tr class="issue-row'+(sel?' selected':'')+'" onclick="'+rowClick+'"'+(sel?' style="background:var(--row-hover);"':'')+'>'; if(issueSelectMode) h+='<td onclick="event.stopPropagation()"><input type="checkbox"'+(sel?' checked':'')+' onclick="event.stopPropagation();toggleIssueSelected(\''+r.id+'\')" aria-label="Select issue"></td>'; h+='<td style="color:var(--text-faint);font-weight:700;white-space:nowrap;">#'+issueRef(r.num)+'</td><td>'+r.issueType+tradeBadgeHtml(r)+workersBadgeHtml(r)+workersCompletedSummaryHtml(r)+(r.note?' <span style="color:var(--text-faint);">('+r.note+')</span>':'')+'</td><td>'+locStr(r)+'</td>'; if(tradeGroups().length) h+='<td>'+tradeGroupLabel(r.assignedGroup)+'</td>'; h+='<td>'+dateOnly(r.date)+'</td><td>'+issueStatusBadgeHtml(r)+'</td><td>'+(r.photo?'<img class="thumb" src="'+r.photo+'" loading="lazy">':'?')+'</td>'; if(!issueSelectMode) h+='<td>'+issueActionBtns(r)+'</td>'; h+='</tr>'; }); h+='</tbody></table>'; } document.getElementById('issuesTable').innerHTML=h; }
function durationStr(a,b){ if(!a||!b) return ''; const pr=s=>new Date(String(s).replace(' ','T')); const d1=pr(a), d2=pr(b); if(isNaN(d1.getTime())||isNaN(d2.getTime())) return ''; let ms=d2-d1; if(ms<0) return ''; const days=Math.floor(ms/86400000); const hrs=Math.floor((ms%86400000)/3600000); const mins=Math.floor((ms%3600000)/60000); let parts=[]; if(days)parts.push(days+'d'); if(hrs)parts.push(hrs+'h'); if(!days&&!hrs)parts.push(mins+'m'); return ' \u2014 took '+parts.join(' '); }
function assignBoxHtml(r) {
  if (!tradeGroups().length || PAGEPERMS.assign === false) return '';
  var opts = '<option value="">Unassigned</option>';
  tradeGroups().forEach(function (g) {
    opts += '<option value="' + g.id + '"' + (r.assignedGroup === g.id ? ' selected' : '') + '>' + g.label + '</option>';
  });
  var twoChecked = issueWorkersRequired(r) >= 2 ? ' checked' : '';
  return '<div class="assign-box" onclick="event.stopPropagation()"><label>Assign to team</label><div class="assign-row"><select id="assign-group-' + r.id + '" onchange="setAssignBtnState(\'' + r.id + '\', \'idle\')">' + opts + '</select><button type="button" id="assign-btn-' + r.id + '" class="assign-save-btn" onclick="assignIssue(\'' + r.id + '\')">Save</button></div><label class="assign-two-workers"><input type="checkbox" id="assign-two-workers-' + r.id + '"' + twoChecked + '> Needs 2 workers (each must take photos)</label></div>';
}
function openIssue(id){ const r=allIssues.find(x=>x.id===id); if(!r)return; if(isCivilWorker() && r.status!=='fixed'){ closeIssueModal(); openWorkerJob(id); return; } let h='<span class="close-x" onclick="closeIssueModal()">&times;</span>'; h+=issueDetailMetaSectionHtml(r); if(r.status!=='fixed') h+=assignBoxHtml(r); h+=workerCompletionsBlockHtml(r); h+='<div style="margin:12px 0 4px;"><button type="button" onclick="shareIssueWhatsApp(\''+r.id+'\')" style="background:#25D366;color:#fff;border:none;padding:10px 16px;border-radius:50px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;box-shadow:none;">'+whatsappIconHtml()+' Share on WhatsApp</button></div>'; h+=issuePhotosSectionHtml(r); if(r.status!=='fixed' && canMarkIssueFixed()){ if(ISSUE_CFG.requireFixByName){ h+='<div style="margin:14px 0 4px;"><label style="font-weight:600;display:block;margin-bottom:6px;">Job was done by:</label><input type="text" id="fix-by" placeholder="Enter the name of who did the job" style="width:100%;max-width:340px;padding:10px;border:2px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:14px;box-sizing:border-box;"></div>'; } h+='<h3>'+checkIconHtml()+' Mark as fixed</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;"><button type="button" onclick="document.getElementById(\'fix-file\').click()"><span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/><circle cx="14" cy="15" r="1"/></svg></span> Upload / Camera</button><span style="color:var(--text-soft);font-size:13px;">? or paste below ?</span><input type="file" id="fix-file" accept="image/*" style="display:none" onchange="handleFixFile(event,\''+r.id+'\')"></div><div class="image-upload" id="fix-area" onpaste="pasteFix(event,\''+r.id+'\')">Click here and paste the photo of the completed fix (Ctrl+V)</div>'; } document.getElementById('issueBox').innerHTML=h; document.getElementById('issueModal').classList.add('show'); }
function closeIssueModal(){ document.getElementById('issueModal').classList.remove('show'); }
function processFix(id, file){ if(!file) return; var by=''; if(ISSUE_CFG.requireFixByName){ const byEl=document.getElementById('fix-by'); by=byEl?byEl.value.trim():''; if(!by){ alert('Please enter who did the job first ("Job was done by")'); if(byEl)byEl.focus(); return; } } const area=document.getElementById('fix-area'); if(area) area.innerHTML='\u23F3 Uploading\u2026'; compressImage(file,url=>{ if(url){ var payload={action:ISSUE_CFG.actions.markFixed,id:id,fixedPhoto:url,token:issueToken()||''}; if(ISSUE_CFG.requireFixByName) payload.fixedByName=by; fetchJSONRetry(payload).then(()=>{ const it=allIssues.find(x=>x.id===id); if(it){ it.status='fixed'; it.fixedPhoto=url; const now=new Date(); const z=n=>String(n).padStart(2,'0'); it.fixedAt=now.getFullYear()+'-'+z(now.getMonth()+1)+'-'+z(now.getDate())+' '+z(now.getHours())+':'+z(now.getMinutes()); it.fixedBy=by||empireGetUser()||''; } renderIssues(); renderAnalytics(); openIssue(id); }).catch(er=>{ if(area) area.innerHTML='\u274C '+er.message; }); } else { if(area) area.innerHTML='\u274C Upload failed, try again'; } }); }
function pasteFix(e,id){ const items=e.clipboardData.items; for(let i=0;i<items.length;i++){ if(items[i].type.indexOf('image')!==-1){ e.preventDefault(); processFix(id, items[i].getAsFile()); return; } } }
function handleFixFile(e,id){ const f=e.target.files && e.target.files[0]; if(f) processFix(id, f); e.target.value=''; }
function bigImg(src){ document.getElementById('imgBig').src=src; document.getElementById('imgModal').classList.add('show'); }
function closeImg(){ document.getElementById('imgModal').classList.remove('show'); }
function donutHtml(open,fixed,total){ if(total===0) return '<p style="color:var(--text-faint);margin:8px 0 18px;">No issues yet.</p>'; var fp=fixed/total*100, op=open/total*100; return '<div style="display:flex;align-items:center;gap:30px;flex-wrap:wrap;margin:10px 0 22px;"><svg width="180" height="180" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="5"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27ae60" stroke-width="5" stroke-dasharray="'+fp+' '+(100-fp)+'" stroke-dashoffset="25"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" style="stroke:var(--open-color)" stroke-width="5" stroke-dasharray="'+op+' '+(100-op)+'" stroke-dashoffset="'+(25-fp)+'"></circle><text x="21" y="20.5" text-anchor="middle" style="font-size:7px;fill:var(--text);font-weight:700;">'+total+'</text><text x="21" y="26" text-anchor="middle" style="font-size:3.2px;fill:var(--text-soft);">issues</text></svg><div style="font-size:15px;line-height:2.1;"><div><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#27ae60;margin-right:9px;vertical-align:middle;"></span>Fixed &mdash; <strong>'+fixed+'</strong> ('+Math.round(fp)+'%)</div><div><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:var(--open-color);margin-right:9px;vertical-align:middle;"></span>Open &mdash; <strong>'+open+'</strong> ('+Math.round(op)+'%)</div></div></div>'; }
function miniDonutHtml(name,open,fixed){ var total=open+fixed; var fp=total?fixed/total*100:0, op=total?open/total*100:0; var ring = total ? '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="6"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27ae60" stroke-width="6" stroke-dasharray="'+fp+' '+(100-fp)+'" stroke-dashoffset="25"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" style="stroke:var(--open-color)" stroke-width="6" stroke-dasharray="'+op+' '+(100-op)+'" stroke-dashoffset="'+(25-fp)+'"></circle>' : '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="6"></circle>'; return '<div style="text-align:center;width:118px;"><svg width="96" height="96" viewBox="0 0 42 42">'+ring+'<text x="21" y="24" text-anchor="middle" style="font-size:10px;fill:var(--text);font-weight:700;">'+total+'</text></svg><div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px;line-height:1.25;">'+name+'</div><div style="font-size:11px;color:var(--text-soft);margin-top:2px;"><span style="color:var(--open-color);">'+open+' open</span> &middot; <span style="color:#1d9e75;">'+fixed+' fixed</span></div></div>'; }
function initRepMonth(){ var mm=document.getElementById('rep-month-m'); var ym=document.getElementById('rep-month-y'); if(mm && mm.options.length<=1){ var names=['January','February','March','April','May','June','July','August','September','October','November','December']; for(var i=0;i<12;i++){ var o=document.createElement('option'); o.value=String(i+1).padStart(2,'0'); o.textContent=names[i]; mm.appendChild(o); } } if(ym && ym.options.length<=1){ var cy=new Date().getFullYear(); for(var y=cy+1;y>=cy-3;y--){ var o2=document.createElement('option'); o2.value=String(y); o2.textContent=String(y); ym.appendChild(o2); } } }
function syncRepMonth(){ var y=(document.getElementById('rep-month-y')||{}).value||''; var m=(document.getElementById('rep-month-m')||{}).value||''; var h=document.getElementById('rep-month'); if(h) h.value=(y&&m)?(y+'-'+m):''; }
function renderAnalytics(){ const total=allIssues.length; const open=allIssues.filter(r=>r.status!=='fixed').length; const fixed=total-open; let h='<div class="stats"><div class="stat-box"><div class="stat-value">'+total+'</div><div class="stat-label">Total Issues</div></div><div class="stat-box"><div class="stat-value" style="color:var(--open-color);">'+open+'</div><div class="stat-label">Open</div></div><div class="stat-box"><div class="stat-value" style="color:#27ae60;">'+fixed+'</div><div class="stat-label">Fixed</div></div></div>'; h+='<h3>Open vs Fixed</h3><div style="display:flex;flex-wrap:wrap;gap:26px;align-items:center;margin:10px 0 22px;">'+donutHtml(open,fixed,total)+'<div style="display:flex;flex-wrap:wrap;gap:12px;">'+['ec','es','wd','ww','ra'].map(function(p){ var pr=allIssues.filter(function(r){return r.project===p;}); var o=pr.filter(function(r){return r.status!=='fixed';}).length; return miniDonutHtml(projectNames[p],o,pr.length-o); }).join('')+'</div></div>'; var colg='<colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>'; h+='<h3>By Project</h3><table style="table-layout:fixed;width:100%;">'+colg+'<thead><tr><th>Project</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; ['ec','es','wd','ww','ra'].forEach(p=>{ const pr=allIssues.filter(r=>r.project===p); if(pr.length===0)return; const o=pr.filter(r=>r.status!=='fixed').length; h+='<tr><td>'+projectNames[p]+'</td><td style="color:var(--open-color);">'+o+'</td><td style="color:#1d9e75;">'+(pr.length-o)+'</td><td>'+pr.length+'</td></tr>'; }); h+='</tbody></table>'; const types={}; allIssues.forEach(r=>{ const t=r.issueType; if(!types[t]) types[t]={open:0,fixed:0}; if(r.status==='fixed') types[t].fixed++; else types[t].open++; }); h+='<h3>By Issue Type</h3><table style="table-layout:fixed;width:100%;">'+colg+'<thead><tr><th>Type</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; Object.keys(types).sort((a,b)=>(types[b].open+types[b].fixed)-(types[a].open+types[a].fixed)).forEach(t=>{ const o=types[t].open,f=types[t].fixed; h+='<tr><td>'+t+'</td><td style="color:var(--open-color);">'+o+'</td><td style="color:#1d9e75;">'+f+'</td><td>'+(o+f)+'</td></tr>'; }); h+='</tbody></table>'; document.getElementById('analyticsContent').innerHTML=h; }
function switchTab(e,t){ document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); document.getElementById(t).classList.add('active'); e.target.classList.add('active'); empireSaveActiveTab(ISSUE_CFG.prefix+'_active_tab', t); if(t==='add'){ window._editingId=null; var eb=document.getElementById('editBanner'); if(eb) eb.style.display='none'; } if(t==='analytics') renderAnalytics(); }
function switchTabTo(t){ document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); document.getElementById(t).classList.add('active'); document.querySelectorAll('.tab-btn').forEach(b=>{ if(b.getAttribute('onclick').indexOf("'"+t+"'")!==-1) b.classList.add('active'); }); }
function enterApp(){ document.getElementById('loginPage').classList.remove('show'); var wa=document.getElementById('workerApp'); if(wa) wa.classList.remove('show'); document.getElementById('mainContainer').classList.add('show'); applyPerms(); refreshPerms(); populateSelect('ci-project',['ec','es','wd','ww','ra'],true); updateCIBuildings(); populateSelect('ci-spot',spots,false); populateSelect('ci-issuetype',issueTypes,false); const fp=document.getElementById('f-project'); if(fp && fp.options.length<=1){ ['ec','es','wd','ww','ra'].forEach(p=>{ const o=document.createElement('option'); o.value=p;o.textContent=projectNames[p]; fp.appendChild(o); }); } initTradeFilters(); window._issueFilterState=empireBindFilterPersistence({ key:ISSUE_CFG.prefix+'_list_filters', fields:['f-project','f-group','f-status','f-month','f-search'], onApply:function(){ renderIssues(); } }); initRepMonth(); document.getElementById('ci-date').value=new Date().toISOString().split('T')[0]; var tab=empireRestoreActiveTab(ISSUE_CFG.prefix+'_active_tab','list'); switchTabTo(tab); if(tab==='analytics') renderAnalytics(); setTimeout(function(){ loadIssues(false); },0); }
var _lastPermFetch=0;
function refreshPerms(){ var tk=issueToken(); if(!tk) return; var now=Date.now(); if(now-_lastPermFetch<300000) return; _lastPermFetch=now; empireAuthRefreshPerms(function(d){ PAGEPERMS=d.perms||empireGetPerms(); applyPerms(); }); }
function bootApp(){ empireAuthPageBoot({ dept: ISSUE_CFG.dept, onEnter: function(){ if(isCivilWorker()) enterWorkerApp(); else enterApp(); } }); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bootApp); else bootApp();
// ===== Reset Data (password) =====
function openResetModal(){ document.getElementById('resetPwInput').value=''; document.getElementById('resetMsg').textContent=''; document.getElementById('resetModal').style.display='flex'; setTimeout(function(){document.getElementById('resetPwInput').focus();},30); }
function closeResetModal(){ document.getElementById('resetModal').style.display='none'; }
function doReset(){ var pw=document.getElementById('resetPwInput').value; var msg=document.getElementById('resetMsg'); if(!pw){ msg.style.color='#C5504F'; msg.textContent='Please enter the password.'; return; } msg.style.color='var(--text-soft)'; msg.textContent='\u23F3 Deleting\u2026'; fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:ISSUE_CFG.actions.clear, resetPassword:pw, dept:ISSUE_CFG.dept, token:issueToken()||''})}).then(r=>r.json()).then(function(d){ if(d&&d.success){ closeResetModal(); allIssues=[]; renderIssues(); renderAnalytics(); uiAlert('\u2705 '+ISSUE_CFG.resetSuccessMsg); } else if(d&&d.error==='bad_password'){ msg.style.color='#C5504F'; msg.textContent='\u274C Wrong password.'; } else if(d&&d.ok===false){ forceSessionLogout(d); } else if(d&&d.error==='not_allowed'){ msg.style.color='#C5504F'; msg.textContent='\u274C Only an admin can reset data.'; } else { msg.style.color='#C5504F'; msg.textContent='\u274C Could not reset. Try again.'; } }).catch(function(e){ msg.style.color='#C5504F'; msg.textContent='? '+e.message; }); }
// ===== Download Civil Issues Report (standalone offline HTML, photos embedded) =====
function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function urlToDataURI(url){ return fetch(url,{mode:'cors'}).then(function(r){return r.blob();}).then(function(blob){ return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){res(fr.result);}; fr.onerror=function(){res(url);}; fr.readAsDataURL(blob); }); }).catch(function(){ return url; }); }
function _box(v,l){ return '<div class="box"><div class="bv">'+v+'</div><div class="bl">'+l+'</div></div>'; }
async function downloadIssueReport(){ const rm=(document.getElementById('rep-month')||{}).value||''; let issues=allIssues.slice(); if(rm) issues=issues.filter(function(r){ return monthOf(r)===rm; }); if(issues.length===0){ uiAlert('No issues to report'+(rm?(' for '+rm):'')+'.'); return; } const btn=document.getElementById(ISSUE_CFG.reportBtnId); const orig=btn?btn.textContent:''; const urls=new Set(); issues.forEach(function(r){ if(r.photo)urls.add(r.photo); issueFixedPhotos(r).forEach(function(u){ urls.add(u); }); }); const list=[...urls]; const map={}; let done=0; if(btn){ btn.disabled=true; btn.textContent='\u23F3 Embedding photos 0/'+list.length; } await Promise.all(list.map(function(u){ return urlToDataURI(u).then(function(d){ map[u]=d; done++; if(btn) btn.textContent='\u23F3 Embedding photos '+done+'/'+list.length; }); })); const html=buildIssueReportHtml(issues,map,rm); const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=ISSUE_CFG.reportFilePrefix+(rm||'all')+'.html'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); },4000); if(btn){ btn.disabled=false; btn.textContent=orig; } }
function buildIssueReportHtml(issues,map,rm){ var logo=''; var le=document.querySelector('img[alt="Empire World"]'); if(le) logo=le.src; var total=issues.length; var open=issues.filter(function(r){return r.status!=='fixed';}).length; var fixed=total-open; var gen=new Date().toLocaleString('en-US'); var monthLabel=rm?rm:'All time'; var fp=total?fixed/total*100:0, op=total?open/total*100:0; var donut=total?('<svg width="160" height="160" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(0,0,0,0.08)" stroke-width="5"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27ae60" stroke-width="5" stroke-dasharray="'+fp+' '+(100-fp)+'" stroke-dashoffset="25"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#C5504F" stroke-width="5" stroke-dasharray="'+op+' '+(100-op)+'" stroke-dashoffset="'+(25-fp)+'"></circle><text x="21" y="20.5" text-anchor="middle" style="font-size:7px;fill:#232a3d;font-weight:700;">'+total+'</text><text x="21" y="26" text-anchor="middle" style="font-size:3.2px;fill:#5b6478;">issues</text></svg>'):''; var b='<div class="hd">'+(logo?'<img class="logo" src="'+logo+'">':'')+'<div><h1>'+ISSUE_CFG.reportTitle+'</h1><div class="sub">'+_esc(monthLabel)+' \u00B7 Generated '+_esc(gen)+'</div><div class="sub">Prepared by Swar Dizayee</div></div></div>'; b+='<div style="display:flex;align-items:center;gap:30px;flex-wrap:wrap;">'+donut+'<div class="stats" style="flex:1;">'+_box(total,'Total')+_box(open,'Open')+_box(fixed,'Fixed')+'</div></div>'; b+='<h2>By Project</h2><table><thead><tr><th>Project</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; ['ec','es','wd','ww','ra'].forEach(function(p){ var pr=issues.filter(function(r){return r.project===p;}); if(!pr.length)return; var o=pr.filter(function(r){return r.status!=='fixed';}).length; b+='<tr><td>'+_esc(projectNames[p])+'</td><td>'+o+'</td><td>'+(pr.length-o)+'</td><td>'+pr.length+'</td></tr>'; }); b+='</tbody></table>'; var types={}; issues.forEach(function(r){ var t=r.issueType; if(!types[t])types[t]={open:0,fixed:0}; if(r.status==='fixed')types[t].fixed++; else types[t].open++; }); b+='<h2>By Issue Type</h2><table><thead><tr><th>Type</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; Object.keys(types).sort(function(a,b2){ return (types[b2].open+types[b2].fixed)-(types[a].open+types[a].fixed); }).forEach(function(t){ var o=types[t].open,f=types[t].fixed; b+='<tr><td>'+_esc(t)+'</td><td>'+o+'</td><td>'+f+'</td><td>'+(o+f)+'</td></tr>'; }); b+='</tbody></table>'; b+='<h2>All Issues ('+total+')</h2>'; var rows=issues.slice().sort(compareIssuesNewestFirst); rows.forEach(function(r){ b+='<div class="issue"><h3>#'+issueRef(r.num)+' '+_esc(r.issueType)+' '+issueStatusBadgeHtml(r)+'</h3>'; b+='<div class="meta"><strong>Location:</strong> '+_esc(locStr(r))+'</div>'; b+='<div class="meta"><strong>'+squareIconHtml()+' Reported:</strong> '+_esc(fmtDT(r.createdAt||r.date||''))+(r.createdBy?(' (by '+_esc(r.createdBy)+')'):'')+'</div>'; if(r.status==='fixed'){ b+='<div class="meta"><strong>'+checkIconHtml()+' Fixed:</strong> '+_esc(fmtDT(r.fixedAt)||'?')+(r.fixedBy?(' (by '+_esc(r.fixedBy)+')'):'')+_esc(durationStr(r.createdAt||r.date, r.fixedAt))+'</div>'; } if(r.note) b+='<div class="meta"><strong>Note:</strong> '+_esc(r.note)+'</div>'; var ph=''; if(r.photo){ var s1=map[r.photo]||r.photo; ph+='<figure><a href="'+s1+'" target="_blank"><img src="'+s1+'"></a><figcaption>Problem</figcaption></figure>'; } if(r.fixedPhoto){ issueFixedPhotos(r).forEach(function(u,idx){ var s2=map[u]||u; var cap=issueFixedPhotos(r).length>1?('Fixed '+(idx+1)):'Fixed'; ph+='<figure><a href="'+s2+'" target="_blank"><img src="'+s2+'"></a><figcaption>'+cap+'</figcaption></figure>'; }); } if(ph) b+='<div class="photos">'+ph+'</div>'; b+='</div>'; }); var css='body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#232a3d;margin:0;padding:24px;}' +'.hd{display:flex;align-items:center;gap:18px;border-bottom:2px solid #8d015d;padding-bottom:16px;margin-bottom:20px;}' +'.hd .logo{height:60px;width:auto;}h1{margin:0;font-size:24px;color:#185fa5;}.sub{color:#5b6478;font-size:13px;margin-top:4px;}' +'h2{color:#232a3d;border-left:4px solid #8d015d;padding-left:10px;margin-top:28px;}' +'.stats{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0;}' +'.box{background:#fff;border:1px solid #efe8ed;border-radius:10px;padding:14px 18px;min-width:110px;text-align:center;flex:1;}' +'.bv{font-size:26px;font-weight:bold;color:#8d015d;}.bl{font-size:12px;color:#5b6478;margin-top:4px;}' +'table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #e6e9f2;padding:8px 10px;text-align:left;font-size:13px;}th{background:#faf6f8;}' +'.issue{background:#fff;border:1px solid #e6e9f2;border-radius:12px;padding:14px 16px;margin:12px 0;}' +'.issue h3{margin:0 0 4px;font-size:16px;}' +'.badge{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;text-transform:uppercase;}.nav-icon{display:inline-flex;vertical-align:middle;align-items:center;}.nav-icon svg{width:14px;height:14px;display:block;}' +'.badge.open{color:#C5504F;}.badge.fixed{color:#27ae60;}' +'.meta{color:#5b6478;font-size:13px;margin:2px 0;}' +'.photos{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;}.photos figure{margin:0;text-align:center;}' +'.photos img{width:200px;height:160px;object-fit:cover;border-radius:8px;border:2px solid #e6cddc;}.photos figcaption{font-size:11px;color:#5b6478;margin-top:3px;}' +'a{color:#185fa5;}'; return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+ISSUE_CFG.reportPageTitle+' \u2014 '+_esc(monthLabel)+'</title><style>'+css+'</style></head><body>'+b+'</body></html>'; }