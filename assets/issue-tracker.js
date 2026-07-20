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
function issueTabNavSel(){ return (ISSUE_CFG && ISSUE_CFG.tabNavScope) ? ISSUE_CFG.tabNavScope + ' .tab-btn' : '.side-nav .tab-btn'; }
function issueTabPaneSel(){ return (ISSUE_CFG && ISSUE_CFG.tabPaneScope) ? ISSUE_CFG.tabPaneScope + ' .tab-content' : '.tab-content'; }
function issueTabBtns(){ return document.querySelectorAll(issueTabNavSel()); }
function issueTabPanes(){ return document.querySelectorAll(issueTabPaneSel()); }
function issueAnalyticsContentEl(){ var id=(ISSUE_CFG && ISSUE_CFG.analyticsContentId) || 'analyticsContent'; return document.getElementById(id); }
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
  return JSON.stringify(normalizePhotoUrls(urls));
}
function normalizePhotoUrls(urls) {
  return (urls || []).map(function (u) {
    return typeof u === 'string' ? u : (u && u.url) || '';
  }).filter(Boolean);
}
function workerPhotoUrl(item) {
  if (!item) return '';
  return typeof item === 'string' ? item : (item.url || '');
}
function workerPhotoSource(item) {
  if (!item || typeof item === 'string') return 'camera';
  var s = String(item.source || 'camera').toLowerCase();
  return s === 'gallery' ? 'gallery' : 'camera';
}
function completionPhotoSource(c, index) {
  if (!c || !c.photoSources || !c.photoSources.length) return 'camera';
  var s = String(c.photoSources[index] || 'camera').toLowerCase();
  return s === 'gallery' ? 'gallery' : 'camera';
}
function photoSourceBadgeHtml(source) {
  if (source === 'gallery') {
    return '<span class="photo-source-badge photo-source-gallery" title="Uploaded from gallery">Uploaded</span>';
  }
  return '<span class="photo-source-badge photo-source-camera" title="Taken with camera">Taken</span>';
}
function completionPhotoGridHtml(photos, completion) {
  if (!photos || !photos.length) return '';
  var h = '<div class="fixed-photo-grid completion-photo-grid">';
  photos.forEach(function (u, i) {
    h += '<div class="completion-photo-wrap"><img src="' + u + '" onclick="bigImg(this.src)" alt="Worker photo ' + (i + 1) + '">'
      + photoSourceBadgeHtml(completionPhotoSource(completion, i)) + '</div>';
  });
  h += '</div>';
  return h;
}
function isOfflinePhotoUrl(url) {
  return String(url || '').indexOf('data:') === 0;
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
function isCivilWorkerAccount_(username) {
  username = String(username || '').trim().toLowerCase();
  if (!username) return false;
  var teams = civilWorkersRoster();
  if (!teams) return false;
  var keys = Object.keys(teams);
  for (var i = 0; i < keys.length; i++) {
    var list = teams[keys[i]] || [];
    for (var j = 0; j < list.length; j++) {
      if (String(list[j].id || '').trim().toLowerCase() === username) return true;
    }
  }
  return false;
}
function isCivilWorker() {
  if (!ISSUE_CFG.workerMode) return false;
  if (String(empireGetRole() || '').toLowerCase() === 'worker') return true;
  return isCivilWorkerAccount_(empireGetUser());
}
function canMarkIssueFixed() {
  var p = PAGEPERMS || {};
  if (isCivilWorker()) return true;
  if (ISSUE_CFG.engineerCanMarkFixed === false) return false;
  return p.fix === true || p.edit !== false;
}
function tradeGroups() { return ISSUE_CFG.tradeGroups || []; }
function issueUi_(key, fallback) {
  var ui = (ISSUE_CFG && ISSUE_CFG.ui) || {};
  return ui[key] != null && ui[key] !== '' ? ui[key] : fallback;
}
function routedDisposition() {
  return String((ISSUE_CFG && ISSUE_CFG.routedDisposition) || 'not_civil').toLowerCase();
}
function gpsTradesFilter() {
  if (ISSUE_CFG && ISSUE_CFG.gpsTrades && ISSUE_CFG.gpsTrades.length) return ISSUE_CFG.gpsTrades.slice();
  return null;
}
function civilWorkersRoster() { return ISSUE_CFG.deptWorkers || ISSUE_CFG.civilWorkers || null; }
function normalizeTradeId(id) {
  id = String(id || '').trim().toLowerCase();
  if (id === 'pipes' || id === 'pipe') return 'plumber';
  return id;
}
function civilWorkersForTeam(teamId) {
  var r = civilWorkersRoster();
  if (!r) return [];
  teamId = normalizeTradeId(teamId);
  return r[teamId] || [];
}
function civilWorkerName(id) {
  id = String(id || '').trim().toLowerCase();
  if (!id) return '';
  var teams = civilWorkersRoster();
  if (!teams) return id;
  var keys = Object.keys(teams);
  for (var i = 0; i < keys.length; i++) {
    var list = teams[keys[i]] || [];
    for (var j = 0; j < list.length; j++) {
      if (String(list[j].id || '').toLowerCase() === id) return list[j].name || id;
    }
  }
  return id;
}
function civilWorkerTeamId(id) {
  id = String(id || '').trim().toLowerCase();
  var teams = civilWorkersRoster();
  if (!teams) return '';
  var keys = Object.keys(teams);
  for (var i = 0; i < keys.length; i++) {
    var list = teams[keys[i]] || [];
    for (var j = 0; j < list.length; j++) {
      if (String(list[j].id || '').toLowerCase() === id) return keys[i];
    }
  }
  return '';
}
function assignedWorkersList(r) {
  if (!r || !r.assignedWorkers || !r.assignedWorkers.length) return [];
  return r.assignedWorkers.map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean);
}
function assignedWorkersDisplay(r) {
  var ids = assignedWorkersList(r);
  if (!ids.length) return '';
  return ids.map(function (id) { return civilWorkerName(id); }).join(', ');
}
function maxAssignWorkers() { return ISSUE_CFG.maxAssignWorkers || 4; }
function isIssueUnassigned(r) {
  return !assignedWorkersList(r).length && !String(r.assignedGroup || '').trim();
}
function isIssueAssigned(r) {
  return !isIssueUnassigned(r);
}
var _assignEditMode = {};
function isAssignEditMode(id) {
  return !!_assignEditMode[String(id || '')];
}
function enterAssignEditMode(id) {
  id = String(id || '');
  if (!id) return;
  _assignEditMode[id] = true;
  refreshAssignBox(id);
}
function exitAssignEditMode(id) {
  id = String(id || '');
  if (!id) return;
  delete _assignEditMode[id];
  if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(id);
  refreshAssignBox(id);
}
function refreshAssignBox(id) {
  var it = allIssues.find(function (x) { return x.id === id; });
  var assignBox = document.querySelector('#issueBox .assign-box');
  if (!assignBox || !it) return;
  assignBox.outerHTML = assignBoxHtml(it);
  if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(document.getElementById('issueBox'));
}
function readAssignWorkerChecks(className, id) {
  className = className || 'assign-worker-cb';
  var selector = id ? ('.' + className + '[data-issue="' + id + '"]') : ('.' + className);
  var boxes = document.querySelectorAll(selector);
  var out = [];
  boxes.forEach(function (cb) {
    if (cb.checked) {
      var v = String(cb.value || '').trim().toLowerCase();
      if (v && out.indexOf(v) === -1) out.push(v);
    }
  });
  return out;
}
function enforceAssignWorkerLimit(boxes, limit) {
  var checked = [];
  boxes.forEach(function (cb) { if (cb.checked) checked.push(cb); });
  if (checked.length <= limit) return;
  for (var i = limit; i < checked.length; i++) checked[i].checked = false;
  uiAlert('You can assign at most ' + limit + ' workers per job.');
}
function onAssignWorkerPick(id) {
  var boxes = document.querySelectorAll('.assign-worker-cb[data-issue="' + id + '"]');
  enforceAssignWorkerLimit(boxes, maxAssignWorkers());
  setAssignBtnState(id, 'idle');
}
function onBulkAssignWorkerPick() {
  var boxes = document.querySelectorAll('.bulk-assign-worker-cb');
  enforceAssignWorkerLimit(boxes, maxAssignWorkers());
}
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
  var names = assignedWorkersDisplay(r);
  if (names) return '<span class="trade-badge">' + names + '</span>';
  var lbl = tradeGroupLabel(r.assignedGroup);
  var cls = r.assignedGroup ? 'trade-badge' : 'trade-badge unassigned';
  return '<span class="' + cls + '">' + lbl + '</span>';
}
function assignWorkersPickerHtml(selectedIds, className, issueId, locked) {
  className = className || 'assign-worker-cb';
  selectedIds = selectedIds || [];
  locked = !!locked;
  var h = '';
  tradeGroups().forEach(function (g) {
    var members = civilWorkersForTeam(g.id);
    if (!members.length) return;
    h += '<div class="assign-team-group"><div class="assign-team-label">' + g.label + '</div><div class="assign-worker-grid">';
    members.forEach(function (w) {
      var checked = selectedIds.indexOf(String(w.id).toLowerCase()) !== -1 ? ' checked' : '';
      var dis = locked ? ' disabled' : '';
      h += '<label class="assign-worker-pick' + (locked ? ' assign-worker-pick-locked' : '') + '"><input type="checkbox" class="' + className + '" data-issue="' + issueId + '" value="' + w.id + '"' + checked + dis;
      if (!locked) {
        h += ' onchange="' + (className.indexOf('bulk') === 0 ? 'onBulkAssignWorkerPick()' : ('onAssignWorkerPick(\'' + issueId + '\')')) + '"';
      }
      h += '> ';
      h += w.name + '</label>';
    });
    h += '</div></div>';
  });
  return h;
}
function issueWorkersRequired(r) {
  if (!r) return 1;
  var n = Number(r.workersRequired);
  if (!n || n < 1) return 1;
  return n > 4 ? 4 : Math.floor(n);
}
function assignWorkersRequiredCount(workers) {
  return workers && workers.length ? workers.length : 1;
}
function issueMatchesTeamFilter(r, fg) {
  if (!fg) return true;
  if (fg === 'unassigned') return isIssueUnassigned(r);
  if (String(r.assignedGroup || '').trim().toLowerCase() === fg) return true;
  var ids = assignedWorkersList(r);
  for (var i = 0; i < ids.length; i++) {
    if (civilWorkerTeamId(ids[i]) === fg) return true;
  }
  return false;
}
function issueWorkerDone(r) {
  if (!r) return 0;
  if (r.workerDone) return Number(r.workerDone) || 0;
  return (r.workerCompletions && r.workerCompletions.length) || 0;
}
function workerCompletedByMe(r) {
  if (!r) return false;
  if (workerHasPendingOfflineFix(r)) return true;
  if (!r.workerCompletions || !r.workerCompletions.length) return false;
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
  var need = issueWorkersRequired(r);
  var done = issueWorkerDone(r);
  var names = workersCompletedNames(r);
  var h = '<p style="margin-top:4px;color:var(--c-warn,#b8860b);"><strong>' + need + ' workers required:</strong> ' + done + '/' + need + ' marked as fixed.</p>';
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
  var assigned = assignedWorkersDisplay(r);
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
  if (assigned) h += issueMetaRow('Assigned to:', assigned);
  h += '</div></div>';
  return h;
}
function workersBadgeHtml(r) {
  var need = issueWorkersRequired(r);
  if (!r || need < 2 || r.status === 'fixed') return '';
  return '<span class="workers-badge">' + issueWorkerDone(r) + '/' + need + ' workers</span>';
}
function issueStatusBadgeHtml(r) {
  var parts = [];
  if (issueIsRoutedAway(r)) parts.push('<span class="badge routed-away">' + issueUi_('routedBadge', 'Not Civil Dept') + '</span>');
  else if (r.status === 'fixed') {
    parts.push('<span class="badge fixed">' + checkIconHtml('currentColor') + ' Fixed</span>');
    if (ISSUE_CFG.embeddedInDept && typeof window.issueMonthlyPending_ === 'function' && window.issueMonthlyPending_(r)) {
      parts.push('<span class="badge open">Report pending</span>');
    }
  } else {
    var done = issueWorkerDone(r);
    var need = issueWorkersRequired(r);
    if (need >= 2 && done > 0) {
      parts.push('<span class="badge partial">' + squareIconHtml('currentColor') + ' ' + done + '/' + need + ' done</span>');
    } else {
      parts.push('<span class="badge open">' + squareIconHtml('currentColor') + ' Open</span>');
    }
  }
  if (isIssueFixDelayed(r) && r.status !== 'fixed' && !issueIsRoutedAway(r)) {
    parts.push('<span class="badge fix-delayed">1+ month</span>');
  }
  return parts.join(' ');
}
function workerCompletionsBlockHtml(r) {
  if (!r || !r.workerCompletions || !r.workerCompletions.length) return '';
  if (issueWorkersRequired(r) >= 2) return '';
  var title = 'Worker progress';
  var h = '<div class="worker-completions"><p style="color:var(--text-soft);margin:0 0 8px;font-weight:600;">' + title + '</p>';
  r.workerCompletions.forEach(function (c) {
    h += '<div class="worker-completion-item"><p style="margin:0 0 6px;font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="worker-done-badge">' + checkIconHtml('#fff') + ' Marked as fixed</span><strong>' + (c.user || 'Worker') + '</strong>' + (c.at ? ('<span style="color:var(--text-faint);font-weight:400;">&middot; ' + dateOnly(c.at) + '</span>') : '') + '</p>';
    h += fixGpsCompletionHtml(c, false);
    if (c.photos && c.photos.length) {
      h += completionPhotoGridHtml(c.photos, c);
    }
    if (c.voiceNote && c.voiceNote.url && typeof assignVoiceNoteDisplayHtml === 'function') {
      h += assignVoiceNoteDisplayHtml(c.voiceNote, { worker: true });
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
      h += '<div class="worker-aside-meta">' + issueMetaRow('Note:', c.note || '') + issueMetaRow('Materials:', c.materials || '') + issueMetaRow('Fixed time:', fmtDT(c.at) || dateOnly(c.at) || '') + '</div>';
      h += fixGpsCompletionHtml(c, false);
      if (c.photos && c.photos.length) {
        h += completionPhotoGridHtml(c.photos, c);
      }
      if (c.voiceNote && c.voiceNote.url && typeof assignVoiceNoteDisplayHtml === 'function') {
        h += assignVoiceNoteDisplayHtml(c.voiceNote, { worker: true });
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
function setAssignBtnState(id, state) {
  var btn = document.getElementById('assign-btn-' + id);
  if (!btn) return;
  btn.classList.remove('saving', 'saved', 'error');
  if (state === 'uploading') {
    btn.disabled = true;
    btn.textContent = 'Uploading voice\u2026';
    btn.classList.add('saving');
  } else if (state === 'saving') {
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';
    btn.classList.add('saving');
  } else if (state === 'saved') {
    btn.disabled = true;
    btn.textContent = 'Assigned';
    btn.classList.add('saved');
  } else if (state === 'error') {
    btn.disabled = false;
    btn.textContent = 'Save assignment';
    btn.classList.add('error');
  } else {
    btn.disabled = false;
    var it = allIssues.find(function (x) { return x.id === id; });
    btn.textContent = (it && isIssueAssigned(it) && isAssignEditMode(id)) ? 'Update assignment' : 'Save assignment';
  }
}
function patchIssueModalAssign(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r) return;
  var wrap = document.querySelector('#issueBox .issue-meta-wrap');
  if (wrap) wrap.outerHTML = issueDetailMetaSectionHtml(r);
}
function assignIssue(id) {
  if (!ISSUE_CFG.actions.assign) return;
  var workers = readAssignWorkerChecks('assign-worker-cb', id);
  if (!workers.length) {
    uiAlert('Select at least one worker.');
    return;
  }
  if (workers.length > maxAssignWorkers()) {
    uiAlert('Select at most ' + maxAssignWorkers() + ' workers.');
    return;
  }
  var workersRequired = assignWorkersRequiredCount(workers);
  var group = workers.length ? civilWorkerTeamId(workers[0]) : '';
  var it = allIssues.find(function (x) { return x.id === id; });
  var prevGroup = it ? (it.assignedGroup || '') : '';
  var prevWorkers = it ? assignedWorkersList(it).slice() : [];
  var prevWorkersRequired = it ? issueWorkersRequired(it) : 1;
  var prevVoiceNote = it && it.assignVoiceNote ? Object.assign({}, it.assignVoiceNote) : null;
  if (it) {
    it.assignedGroup = group;
    it.assignedWorkers = workers.slice();
    it.workersRequired = workersRequired;
    it.workerCompletions = [];
    it.workerDone = 0;
    it.fixedPhoto = '';
    it.fixedBy = '';
  }
  writeIssuesCacheAsync(allIssues);
  var draft = typeof assignVoiceDraft_ === 'function' ? assignVoiceDraft_(id) : null;
  var hasVoice = !!(draft && draft.blob);
  setAssignBtnState(id, hasVoice ? 'uploading' : 'saving');
  patchIssueModalAssign(id);
  var voicePromise = (hasVoice && typeof assignVoiceEnsureUploaded_ === 'function')
    ? assignVoiceEnsureUploaded_(id, 45000)
    : (hasVoice && typeof uploadAssignVoiceForIssue === 'function')
      ? uploadAssignVoiceForIssue(id)
      : Promise.resolve(null);
  voicePromise.then(function (voiceNote) {
    if (hasVoice) setAssignBtnState(id, 'saving');
    var payload = {
      action: ISSUE_CFG.actions.assign,
      id: id,
      assignedGroup: group,
      assignedWorkers: workers,
      workersRequired: workersRequired,
      token: issueToken() || ''
    };
    if (voiceNote && voiceNote.url) payload.assignVoiceNote = voiceNote;
    return fetchJSONRetry(payload, 2, 90000).then(function (d) {
      return { d: d, voiceNote: voiceNote };
    });
  }).then(function (result) {
    var d = result.d;
    var voiceNote = result.voiceNote;
    if (d && d.ok === false) {
      if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
      throw new Error(d.message || d.error || 'Assign failed');
    }
    if (it) {
      if (d && d.assignedGroup !== undefined) it.assignedGroup = d.assignedGroup;
      if (d && d.assignedWorkers) it.assignedWorkers = d.assignedWorkers;
      if (d && d.workersRequired !== undefined) it.workersRequired = d.workersRequired;
      if (voiceNote && voiceNote.url) it.assignVoiceNote = voiceNote;
    }
    if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(id);
    writeIssuesCacheAsync(allIssues);
    delete selectedIssueIds[id];
    delete _assignEditMode[id];
    patchIssueModalAssign(id);
    var assignBox = document.querySelector('#issueBox .assign-box');
    if (assignBox && it) assignBox.outerHTML = assignBoxHtml(it);
    if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(document.getElementById('issueBox'));
    requestAnimationFrame(function () { renderIssues(); });
  }).catch(function (e) {
    if (it) {
      it.assignedGroup = prevGroup;
      it.assignedWorkers = prevWorkers;
      it.workersRequired = prevWorkersRequired;
      it.assignVoiceNote = prevVoiceNote;
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
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  document.getElementById('mainContainer').classList.remove('show');
  document.body.classList.add('civil-worker-mode');
  stopEngineerLocationPoll();
  var wa = document.getElementById('workerApp');
  if (wa) wa.classList.add('show');
  var title = document.getElementById('workerTeamTitle');
  var user = empireGetUser() || '';
  var displayName = civilWorkerName(user) || user;
  if (title) title.textContent = displayName;
  try {
    var bootCached = readIssuesCache();
    if (bootCached && Array.isArray(bootCached)) setIssuesFromData(bootCached);
  } catch (e) {}
  renderWorkerJobs();
  if (typeof workerFieldReportInit_ === 'function') workerFieldReportInit_();
  initWorkerOfflineSync();
  startWorkerLocationPing();
  if (typeof empirePushInitWorker === 'function') empirePushInitWorker();
  if (typeof empirePushCaptureJobFromUrl === 'function') empirePushCaptureJobFromUrl();
  if (typeof empirePushTrySaveAfterLogin === 'function') {
    setTimeout(function () { empirePushTrySaveAfterLogin(); }, 2000);
  }
  bindWorkerAppLifecycle_();
  try { loadIssues(true); } catch (e) { workerShowJobsError_(e); }
}
function workerShowJobsError_(err) {
  var host = document.getElementById('workerJobList');
  var bar = document.getElementById('workerCountBar');
  var msg = String((err && err.message) || err || 'Could not load jobs');
  if (bar) bar.textContent = 'Jobs unavailable';
  if (host) {
    host.innerHTML = '<p class="worker-empty worker-load-error">' + msg + '<br><button type="button" class="worker-loc-enable-btn" onclick="loadIssues(true)" style="margin-top:10px;">Try again</button></p>';
  }
}
var _workerLocWatchId = null;
var _workerLocIntervalId = null;
var _workerLastLocPing = 0;
var _workerLastCoords = null;
var _workerLocDenied = false;
var _workerLocSharing = false;
var _workerLifecycleBound = false;
var _workerVisRefreshTimer = null;
var _workerLastResumeFetch = 0;
var _workerJobsRenderSig = '';
var WORKER_RESUME_FETCH_MIN_MS = 12000;
var WORKER_LOC_PING_MS = 30000;
function workerJobsDisplayed_() {
  var host = document.getElementById('workerJobList');
  if (!host) return false;
  return !!(host.querySelector('.worker-job-card') || host.querySelector('.worker-empty:not(.worker-load-error)'));
}
function workerLocUserKey_() {
  var u = typeof empireGetUser === 'function' ? empireGetUser() : '';
  return String(u || '').trim().toLowerCase();
}
function isIosDevice_() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isWorkerStandaloneApp_() {
  if (window.navigator.standalone === true) return true;
  if (!window.matchMedia) return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;
}
function workerLocDeniedSettingsText_() {
  if (isIosDevice_()) {
    if (isWorkerStandaloneApp_()) {
      return 'Location is blocked on this iPhone. Open Settings, scroll to this Empire app, tap Location, choose While Using the App, then return here and tap Try again.';
    }
    return 'Location is blocked on this iPhone. Open Settings → Privacy & Security → Location Services → Safari Websites → Allow, then return here and tap Try again.';
  }
  if (/Android/i.test(navigator.userAgent)) {
    return 'Location is blocked. Open phone Settings → Apps → Chrome (or your browser) → Permissions → Location → Allow, then tap Try again.';
  }
  return 'Location is blocked in your browser settings. Allow location for this site, then tap Try again.';
}
function queryWorkerGeolocationPermission_(cb) {
  if (!navigator.permissions || !navigator.permissions.query) {
    cb('unknown');
    return;
  }
  navigator.permissions.query({ name: 'geolocation' }).then(function (result) {
    cb(result.state || 'unknown', result);
  }).catch(function () { cb('unknown'); });
}
function showWorkerLocPermissionBanner_(permanentlyDenied) {
  var text = permanentlyDenied
    ? workerLocDeniedSettingsText_()
    : 'Allow location when your phone asks, so the engineer can see where you are on site.';
  setWorkerLocBanner(text, !!permanentlyDenied, true);
}
function resetWorkerLocationWatch_() {
  if (_workerLocWatchId != null && navigator.geolocation) {
    try { navigator.geolocation.clearWatch(_workerLocWatchId); } catch (e) {}
  }
  if (_workerLocIntervalId != null) {
    clearInterval(_workerLocIntervalId);
    _workerLocIntervalId = null;
  }
  _workerLocWatchId = null;
}
function bindWorkerGeolocationPermissionChange_(result) {
  if (!result) return;
  result.onchange = function () {
    if (!isCivilWorker()) return;
    if (result.state === 'granted') {
      _workerLocDenied = false;
      resetWorkerLocationWatch_();
      startWorkerLocationWatch();
      sendWorkerLocationNow(true, false);
    } else if (result.state === 'denied') {
      _workerLocDenied = true;
      showWorkerLocPermissionBanner_(true);
    }
  };
}
function workerLocPromptStorageKey_() {
  return 'empire_worker_loc_asked_' + workerLocUserKey_();
}
function isWorkerLocPromptDone_() {
  if (!workerLocUserKey_()) return false;
  try { return localStorage.getItem(workerLocPromptStorageKey_()) === '1'; } catch (e) { return false; }
}
function markWorkerLocPromptDone_() {
  if (!workerLocUserKey_()) return;
  try { localStorage.setItem(workerLocPromptStorageKey_(), '1'); } catch (e) {}
}
function workerLocationActionsEnabled() {
  return !!(ISSUE_CFG.workerMode && ISSUE_CFG.actions && ISSUE_CFG.actions.reportLocation);
}
function pingWorkerLocation(lat, lng, accuracy, silent) {
  silent = !!silent;
  if (!workerLocationActionsEnabled()) return Promise.resolve(false);
  return fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: ISSUE_CFG.actions.reportLocation,
      lat: lat,
      lng: lng,
      accuracy: accuracy,
      token: issueToken() || ''
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.ok === false) {
        var msg = d.message || d.error || 'Could not share location';
        if (d.error === 'not_allowed') msg = 'This account cannot share location. Log in as a worker account.';
        else if (d.error === 'trade_not_set') msg = 'Worker trade missing in Users sheet (column G).';
        if (!silent) setWorkerLocBanner(msg, true);
        return false;
      }
      _workerLocSharing = true;
      if (!silent) setWorkerLocBanner('', false);
      return true;
    })
    .catch(function () {
      if (!silent) setWorkerLocBanner('Could not reach server to share location. Check your internet connection.', true);
      return false;
    });
}
function setWorkerLocBanner(text, isError, showEnableBtn) {
  var el = document.getElementById('workerLocBanner');
  if (!el) return;
  if (!text && !showEnableBtn) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.classList.toggle('worker-loc-banner-error', !!isError);
  var h = '<span class="worker-loc-banner-text">' + text + '</span>';
  if (showEnableBtn) {
    h += ' <button type="button" class="worker-loc-enable-btn" onclick="requestWorkerLocationAccess()">' + (isError ? 'Try again' : 'Enable location') + '</button>';
  }
  el.innerHTML = h;
}
function storeWorkerCoords_(coords) {
  if (!coords) return;
  _workerLastCoords = {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    ts: Date.now()
  };
}
function beaconWorkerLocationNow_() {
  if (!workerLocationActionsEnabled() || !_workerLastCoords) return;
  var c = _workerLastCoords;
  var payload = JSON.stringify({
    action: ISSUE_CFG.actions.reportLocation,
    lat: c.lat,
    lng: c.lng,
    accuracy: c.accuracy,
    token: issueToken() || ''
  });
  try {
    if (navigator.sendBeacon && GOOGLE_SCRIPT_URL) {
      if (navigator.sendBeacon(GOOGLE_SCRIPT_URL, new Blob([payload], { type: 'text/plain' }))) return;
    }
  } catch (e) {}
  try {
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: payload, keepalive: true }).catch(function () {});
  } catch (e2) {}
}
function bindWorkerAppLifecycle_() {
  if (_workerLifecycleBound) return;
  _workerLifecycleBound = true;
  document.addEventListener('visibilitychange', function () {
    if (!isCivilWorker()) return;
    var wa = document.getElementById('workerApp');
    if (!wa || !wa.classList.contains('show')) return;
    if (document.visibilityState === 'visible') {
      clearTimeout(_workerVisRefreshTimer);
      _workerVisRefreshTimer = setTimeout(function () {
        queryWorkerGeolocationPermission_(function (state) {
          if (state === 'granted') {
            if (_workerLocWatchId == null) startWorkerLocationWatch();
            sendWorkerLocationNow(true, true);
          } else if (state === 'denied') {
            showWorkerLocPermissionBanner_(true);
          }
        });
        var now = Date.now();
        if (now - _workerLastResumeFetch < WORKER_RESUME_FETCH_MIN_MS) return;
        _workerLastResumeFetch = now;
        loadIssues(true);
        if (typeof workerFieldReportRefresh === 'function') workerFieldReportRefresh(true);
      }, 600);
    } else {
      sendWorkerLocationNow(true, true);
      beaconWorkerLocationNow_();
    }
  });
  window.addEventListener('pagehide', function () {
    if (!isCivilWorker()) return;
    beaconWorkerLocationNow_();
  });
  window.addEventListener('pageshow', function (ev) {
    if (!isCivilWorker()) return;
    var wa = document.getElementById('workerApp');
    if (!wa || !wa.classList.contains('show')) return;
    if (ev && ev.persisted) {
      if (_workerLocWatchId == null) startWorkerLocationWatch();
      sendWorkerLocationNow(true, true);
      var now = Date.now();
      if (now - _workerLastResumeFetch >= WORKER_RESUME_FETCH_MIN_MS) {
        _workerLastResumeFetch = now;
        loadIssues(true);
      }
    }
  });
}
function startWorkerLocationInterval_() {
  if (_workerLocIntervalId != null) return;
  _workerLocIntervalId = setInterval(function () {
    if (!isCivilWorker()) return;
    var wa = document.getElementById('workerApp');
    if (!wa || !wa.classList.contains('show')) return;
    sendWorkerLocationNow(false, true);
  }, WORKER_LOC_PING_MS);
}
function sendWorkerLocationNow(force, silent) {
  silent = !!silent;
  if (!isCivilWorker() || !workerLocationActionsEnabled() || !navigator.geolocation) return;
  var now = Date.now();
  if (!force && _workerLastLocPing && now - _workerLastLocPing < WORKER_LOC_PING_MS) return;
  if (!silent) setWorkerLocBanner('Getting GPS position\u2026', false);
  var geoOpts = silent
    ? { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    : { enableHighAccuracy: true, timeout: 20000, maximumAge: force ? 0 : 30000 };
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      if (!pos || !pos.coords) return;
      storeWorkerCoords_(pos.coords);
      _workerLastLocPing = Date.now();
      pingWorkerLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, silent);
    },
    function (err) { onWorkerPositionError(err, silent); },
    geoOpts
  );
}
function onWorkerPosition(pos) {
  if (!pos || !pos.coords) return;
  storeWorkerCoords_(pos.coords);
  var now = Date.now();
  if (_workerLastLocPing && now - _workerLastLocPing < WORKER_LOC_PING_MS) return;
  _workerLastLocPing = now;
  pingWorkerLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, true);
}
function onWorkerPositionError(err, silent) {
  var code = err && err.code;
  if (code === 1) {
    _workerLocDenied = true;
    if (!silent) showWorkerLocPermissionBanner_(true);
    return;
  }
  if (silent) return;
  if (code === 2) {
    setWorkerLocBanner('GPS unavailable. Turn on location services, then tap Enable location.', true, true);
    return;
  }
  if (code === 3) {
    setWorkerLocBanner('GPS timed out. Move to an open area and tap Enable location.', true, true);
    return;
  }
  setWorkerLocBanner('Could not get location. Tap Enable location to try again.', true, true);
}
function requestWorkerLocationAccess() {
  if (!isCivilWorker() || !navigator.geolocation) {
    setWorkerLocBanner('Location is not available in this browser.', true);
    return;
  }
  markWorkerLocPromptDone_();
  _workerLocDenied = false;
  resetWorkerLocationWatch_();
  queryWorkerGeolocationPermission_(function (state, result) {
    bindWorkerGeolocationPermissionChange_(result);
    if (state === 'denied') {
      showWorkerLocPermissionBanner_(true);
      return;
    }
    startWorkerLocationWatch();
    sendWorkerLocationNow(true, false);
  });
}
function startWorkerLocationWatch() {
  if (!isCivilWorker() || !workerLocationActionsEnabled() || !navigator.geolocation) return;
  if (_workerLocWatchId != null) return;
  _workerLocWatchId = navigator.geolocation.watchPosition(onWorkerPosition, function (err) {
    if (err && err.code === 1) onWorkerPositionError(err, true);
  }, {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 20000
  });
  startWorkerLocationInterval_();
}
function maybeResumeWorkerLocationSilently_() {
  if (!navigator.geolocation) return;
  var resume = function () {
    resetWorkerLocationWatch_();
    startWorkerLocationWatch();
    sendWorkerLocationNow(true, true);
  };
  queryWorkerGeolocationPermission_(function (state, result) {
    bindWorkerGeolocationPermissionChange_(result);
    if (state === 'granted') resume();
    else if (state === 'denied') showWorkerLocPermissionBanner_(true);
    else if (state === 'prompt') showWorkerLocPermissionBanner_(false);
    else resume();
  });
}
function startWorkerLocationPing() {
  if (!isCivilWorker() || !workerLocationActionsEnabled() || !navigator.geolocation) return;
  stopWorkerLocationPing();
  _workerLastLocPing = 0;
  _workerLocDenied = false;
  _workerLocSharing = false;
  if (isWorkerLocPromptDone_()) {
    setWorkerLocBanner('');
    maybeResumeWorkerLocationSilently_();
    return;
  }
  showWorkerLocPermissionBanner_(false);
}
function stopWorkerLocationPing() {
  if (_workerLocWatchId != null && navigator.geolocation) {
    try { navigator.geolocation.clearWatch(_workerLocWatchId); } catch (e) {}
  }
  if (_workerLocIntervalId != null) {
    clearInterval(_workerLocIntervalId);
    _workerLocIntervalId = null;
  }
  _workerLocWatchId = null;
  _workerLastLocPing = 0;
  _workerLastCoords = null;
  _workerLocSharing = false;
  setWorkerLocBanner('');
}
var _engineerLocPollTimer = null;
var _workerLocations = [];
var ENGINEER_LOC_POLL_MS = 30000;
function engineerLocationPanelEnabled() {
  var p = PAGEPERMS || {};
  return !!(ISSUE_CFG.workerMode && ISSUE_CFG.actions && ISSUE_CFG.actions.getLocations && !isCivilWorker() && p.liveLocation !== false);
}
function workerLocAgeMs(updatedAt) {
  if (!updatedAt) return Infinity;
  var t = Date.parse(updatedAt);
  if (!isFinite(t)) return Infinity;
  return Math.max(0, Date.now() - t);
}
function workerLocStatusMeta(updatedAt) {
  var age = workerLocAgeMs(updatedAt);
  if (age < 3 * 60 * 1000) return { label: 'Online', cls: 'worker-loc-online' };
  if (age < 15 * 60 * 1000) return { label: 'Recent', cls: 'worker-loc-recent' };
  if (age < 60 * 60 * 1000) return { label: 'Stale', cls: 'worker-loc-stale' };
  return { label: 'Offline', cls: 'worker-loc-offline' };
}
function workerLocLastSeenText(updatedAt) {
  var age = workerLocAgeMs(updatedAt);
  if (!isFinite(age) || age === Infinity) return 'Never';
  if (age < 60000) return 'Just now';
  if (age < 3600000) return Math.round(age / 60000) + ' min ago';
  if (age < 86400000) return Math.round(age / 3600000) + ' hr ago';
  return Math.round(age / 86400000) + ' d ago';
}
function workerLocMapUrl(lat, lng) {
  return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng);
}
function completionHasFixGps_(c) {
  return !!(c && isFinite(Number(c.lat)) && isFinite(Number(c.lng)));
}
function issueFixGpsCompletions_(r) {
  if (!r || !r.workerCompletions || !r.workerCompletions.length) return [];
  return r.workerCompletions.filter(completionHasFixGps_);
}
function fixGpsMapLinkHtml(lat, lng, label, stopProp) {
  if (!isFinite(Number(lat)) || !isFinite(Number(lng))) return '';
  var click = stopProp ? ' onclick="event.stopPropagation()"' : '';
  return '<a class="issue-fix-gps-link" href="' + workerLocMapUrl(lat, lng) + '" target="_blank" rel="noopener"' + click + '>' + (label || 'Open GPS on map') + '</a>';
}
function fixGpsCompletionHtml(c, compact) {
  if (!completionHasFixGps_(c)) return '';
  var who = typeof civilWorkerName === 'function' ? (civilWorkerName(c.user) || c.user) : (c.user || 'Worker');
  var lat = Number(c.lat).toFixed(5);
  var lng = Number(c.lng).toFixed(5);
  if (compact) {
    return '<span class="issue-fix-gps-badge">' + fixGpsMapLinkHtml(c.lat, c.lng, 'Fix GPS', true) + '</span>';
  }
  var acc = isFinite(Number(c.accuracy)) ? (' · ±' + Math.round(Number(c.accuracy)) + 'm') : '';
  return '<p class="issue-fix-gps-row"><strong>Fix GPS (' + who + '):</strong> ' + fixGpsMapLinkHtml(c.lat, c.lng, lat + ', ' + lng, false) + acc + '</p>';
}
function issueFixGpsCardHtml(r) {
  var list = issueFixGpsCompletions_(r);
  if (!list.length) return '';
  if (list.length === 1) return fixGpsCompletionHtml(list[0], true);
  return '<span class="issue-fix-gps-badge">' + list.length + ' fix GPS · <a href="#" onclick="event.stopPropagation();openIssue(\'' + r.id + '\');return false;">view</a></span>';
}
function renderWorkerLocationsPanel() {
  var host = document.getElementById('workerLocationsBody');
  if (!host) return;
  if (!_workerLocations.length) {
    host.innerHTML = '<p class="worker-loc-empty">No worker GPS yet. Workers share location from their phone app after enabling GPS once.</p>';
    return;
  }
  var h = '<div class="worker-loc-table-wrap"><table class="worker-loc-table"><thead><tr>'
    + '<th>Worker</th><th>Team</th><th>Status</th><th>Last seen</th><th>Accuracy</th><th></th>'
    + '</tr></thead><tbody>';
  _workerLocations.forEach(function (w) {
    var st = workerLocStatusMeta(w.updatedAt);
    var acc = isFinite(Number(w.accuracy)) ? (Math.round(Number(w.accuracy)) + ' m') : '—';
    var name = typeof civilWorkerName === 'function' ? (civilWorkerName(w.username) || w.username) : w.username;
    h += '<tr><td><strong>' + String(name || '') + '</strong><br><span style="font-size:11px;color:var(--text-faint);">' + String(w.username || '') + '</span></td>'
      + '<td>' + tradeGroupLabel(w.trade) + '</td>'
      + '<td><span class="worker-loc-status ' + st.cls + '">' + st.label + '</span></td>'
      + '<td>' + workerLocLastSeenText(w.updatedAt) + '</td>'
      + '<td>' + acc + '</td>'
      + '<td><a class="worker-loc-map-link" href="' + workerLocMapUrl(w.lat, w.lng) + '" target="_blank" rel="noopener">Open map</a></td></tr>';
  });
  h += '</tbody></table></div>';
  host.innerHTML = h;
}
function loadWorkerLocations(force) {
  if (!engineerLocationPanelEnabled()) return;
  var spin = document.getElementById('workerLocRefreshIcon');
  if (spin) spin.classList.add('spinning');
  var locBody = { action: ISSUE_CFG.actions.getLocations, token: issueToken() || '' };
  var gpsTrades = gpsTradesFilter();
  if (gpsTrades) locBody.tradeFilter = gpsTrades;
  fetchJSONRetry(locBody, 1, 30000)
    .then(function (d) {
      if (d && d.error === 'Unknown action') {
        throw new Error('Server not updated yet. Redeploy empire-all-in-one.gs in Google Apps Script, then try again.');
      }
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Could not load locations');
      }
      _workerLocations = Array.isArray(d && d.workers) ? d.workers : (Array.isArray(d) ? d : []);
      renderWorkerLocationsPanel();
    })
    .catch(function (e) {
      var host = document.getElementById('workerLocationsBody');
      if (host && (force || !_workerLocations.length)) {
        host.innerHTML = '<p class="worker-loc-empty worker-loc-error">' + String(e.message || e) + '</p>';
      }
    })
    .finally(function () {
      if (spin) spin.classList.remove('spinning');
    });
}
function startEngineerLocationPoll() {
  if (!engineerLocationPanelEnabled()) return;
  stopEngineerLocationPoll();
  var gpsTab = document.getElementById('gps');
  if (!gpsTab || !gpsTab.classList.contains('active')) return;
  loadWorkerLocations(false);
  _engineerLocPollTimer = setInterval(function () {
    if (!engineerLocationPanelEnabled()) return;
    var gt = document.getElementById('gps');
    if (!gt || !gt.classList.contains('active')) return;
    loadWorkerLocations(false);
  }, ENGINEER_LOC_POLL_MS);
}
function stopEngineerLocationPoll() {
  if (_engineerLocPollTimer) clearInterval(_engineerLocPollTimer);
  _engineerLocPollTimer = null;
}
function syncWorkerLocationsUi() {
  var tabBtn = document.getElementById('tabBtnGps');
  if (tabBtn) tabBtn.style.display = engineerLocationPanelEnabled() ? '' : 'none';
  if (!engineerLocationPanelEnabled()) {
    stopEngineerLocationPoll();
    return;
  }
  var gpsTab = document.getElementById('gps');
  if (gpsTab && gpsTab.classList.contains('active')) startEngineerLocationPoll();
  else stopEngineerLocationPoll();
}
var _workerOfflineQueuedIds = {};
var _workerOfflineSyncRunning = false;
var WORKER_OFFLINE_PENDING_KEY = function () { return ISSUE_CFG.prefix + '_worker_offline_pending'; };
function workerHasPendingOfflineFix(r) {
  return !!(r && _workerOfflineQueuedIds[r.id]);
}
function saveWorkerOfflinePendingMap() {
  try { localStorage.setItem(WORKER_OFFLINE_PENDING_KEY(), JSON.stringify(_workerOfflineQueuedIds)); } catch (e) {}
}
function offlineWorkerFixId() {
  return 'wfix-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}
function uploadToImgbbAsync(blob) {
  return empireUploadPhotoAsync(blob, issuePhotoFolder_());
}
async function workerOfflineQueueCount() {
  if (typeof empireOfflineQueueAll !== 'function') return 0;
  var rows = await empireOfflineQueueAll();
  return rows.filter(function (r) {
    return r.type === 'worker_issue_fix' && r.dept === ISSUE_CFG.dept;
  }).length;
}
async function refreshWorkerOfflineBanner() {
  if (!isCivilWorker() || typeof empireOfflineSetBanner !== 'function') return;
  var n = await workerOfflineQueueCount();
  empireOfflineSetBanner(n, function () { syncWorkerOfflineFixes(false); });
}
async function restoreWorkerOfflineQueueState() {
  _workerOfflineQueuedIds = {};
  try {
    var raw = localStorage.getItem(WORKER_OFFLINE_PENDING_KEY());
    if (raw) _workerOfflineQueuedIds = JSON.parse(raw) || {};
  } catch (e) { _workerOfflineQueuedIds = {}; }
  if (typeof empireOfflineQueueAll !== 'function') return;
  var rows = await empireOfflineQueueAll();
  var user = String(empireGetUser() || '').trim().toLowerCase();
  rows.filter(function (r) {
    return r.type === 'worker_issue_fix' && r.dept === ISSUE_CFG.dept && (!r.user || String(r.user).toLowerCase() === user);
  }).forEach(function (r) {
    _workerOfflineQueuedIds[r.issueId] = { queueId: r.id, at: r.createdAt || Date.now() };
  });
  saveWorkerOfflinePendingMap();
}
async function enqueueWorkerFixOffline(issueId, note, photos, coords, voiceNote, materials) {
  if (typeof assignVoiceBlockSaveIfDraftFailed_ === 'function') {
    assignVoiceBlockSaveIfDraftFailed_(workerFixVoiceId_(issueId), voiceNote);
  }
  if (typeof empireOfflineQueuePut !== 'function') throw new Error('Offline queue not available');
  var remoteUrls = [];
  var imageDataUrls = [];
  var orderedPhotos = (photos || []).map(function (p) {
    var url = workerPhotoUrl(p);
    var entry = { url: url, source: workerPhotoSource(p), offline: isOfflinePhotoUrl(url) };
    if (entry.offline) imageDataUrls.push(url);
    else if (url.indexOf('http') === 0) remoteUrls.push(url);
    return entry;
  });
  if (!remoteUrls.length && !imageDataUrls.length) throw new Error('No photos to save');
  var id = offlineWorkerFixId();
  var queueItem = {
    id: id,
    type: 'worker_issue_fix',
    dept: ISSUE_CFG.dept,
    issueId: issueId,
    fixNote: note || '',
    fixMaterials: materials || '',
    imageDataUrls: imageDataUrls,
    remoteUrls: remoteUrls,
    orderedPhotos: orderedPhotos,
    photoSources: orderedPhotos.map(function (p) { return p.source; }),
    user: empireGetUser() || '',
    createdAt: Date.now()
  };
  if (coords && isFinite(Number(coords.lat)) && isFinite(Number(coords.lng))) {
    queueItem.fixLat = Number(coords.lat);
    queueItem.fixLng = Number(coords.lng);
    queueItem.fixAccuracy = coords.accuracy;
  }
  if (voiceNote && voiceNote.url) queueItem.fixVoiceNote = voiceNote;
  await empireOfflineQueuePut(queueItem);
  _workerOfflineQueuedIds[issueId] = { queueId: id, at: Date.now() };
  saveWorkerOfflinePendingMap();
  await refreshWorkerOfflineBanner();
  return id;
}
function markWorkerFixQueuedLocally(id) {
  if (!_workerOfflineQueuedIds[id]) _workerOfflineQueuedIds[id] = { at: Date.now() };
  saveWorkerOfflinePendingMap();
}
async function syncWorkerOfflineFixes(silent) {
  if (_workerOfflineSyncRunning) return;
  if (workerBackgroundPaused_()) return;
  if (!navigator.onLine) {
    if (!silent) uiAlert('No connection — your fix will upload when you have signal.');
    return;
  }
  if (typeof empireOfflineQueueAll !== 'function') return;
  _workerOfflineSyncRunning = true;
  var synced = 0;
  try {
    var rows = await empireOfflineQueueAll();
    var items = rows.filter(function (r) { return r.type === 'worker_issue_fix' && r.dept === ISSUE_CFG.dept; });
    for (var qi = 0; qi < items.length; qi++) {
      var item = items[qi];
      try {
        var remoteUrls = [];
        var photoSources = [];
        var ordered = item.orderedPhotos || [];
        if (ordered.length) {
          for (var oi = 0; oi < ordered.length; oi++) {
            var op = ordered[oi] || {};
            var url = String(op.url || '');
            if (!url) continue;
            if (isOfflinePhotoUrl(url) || op.offline) {
              var blob = empireOfflineDataUrlToBlob(url);
              if (!blob) throw new Error('Invalid saved image');
              url = await uploadToImgbbAsync(blob);
              if (!url) throw new Error('Photo upload failed');
            }
            remoteUrls.push(url);
            photoSources.push(op.source === 'gallery' ? 'gallery' : 'camera');
          }
        } else {
          remoteUrls = (item.remoteUrls || []).slice();
          var dataUrls = item.imageDataUrls || [];
          for (var bi = 0; bi < dataUrls.length; bi++) {
            var blobLegacy = empireOfflineDataUrlToBlob(dataUrls[bi]);
            if (!blobLegacy) throw new Error('Invalid saved image');
            var urlLegacy = await uploadToImgbbAsync(blobLegacy);
            if (!urlLegacy) throw new Error('Photo upload failed');
            remoteUrls.push(urlLegacy);
          }
          photoSources = item.photoSources || [];
          while (photoSources.length < remoteUrls.length) photoSources.push('camera');
          if (photoSources.length > remoteUrls.length) photoSources = photoSources.slice(0, remoteUrls.length);
        }
        if (!remoteUrls.length) throw new Error('No photos to upload');
        var payload = {
          action: ISSUE_CFG.actions.markFixed,
          id: item.issueId,
          fixedPhoto: joinFixedPhotos(remoteUrls),
          fixedPhotos: remoteUrls,
          photoSources: photoSources,
          fixNote: item.fixNote || '',
          token: issueToken() || ''
        };
        if (isFinite(Number(item.fixLat)) && isFinite(Number(item.fixLng))) {
          payload.lat = Number(item.fixLat);
          payload.lng = Number(item.fixLng);
          payload.accuracy = item.fixAccuracy;
        }
        if (item.fixVoiceNote && item.fixVoiceNote.url) payload.fixVoiceNote = item.fixVoiceNote;
        if (item.fixMaterials) payload.fixMaterials = item.fixMaterials;
        var d = await fetchJSONRetry(payload, 3);
        if (d && d.ok === false) {
          if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
          throw new Error(d.message || d.error || 'Could not save fix');
        }
        delete _workerOfflineQueuedIds[item.issueId];
        saveWorkerOfflinePendingMap();
        await empireOfflineQueueDelete(item.id);
        synced++;
      } catch (e) {
        console.warn('Worker offline sync failed for', item.id, e.message);
      }
    }
    if (synced) loadIssues(true);
    await refreshWorkerOfflineBanner();
    if (synced && !silent) uiAlert('\u2705 ' + synced + ' job fix' + (synced === 1 ? '' : 'es') + ' uploaded.');
  } finally {
    _workerOfflineSyncRunning = false;
  }
}
function initWorkerOfflineSync() {
  if (!isCivilWorker()) return;
  restoreWorkerOfflineQueueState().then(function () {
    refreshWorkerOfflineBanner();
    syncWorkerOfflineFixes(true);
  });
  if (!window._workerOfflineOnlineBound) {
    window._workerOfflineOnlineBound = true;
    window.addEventListener('online', function () { syncWorkerOfflineFixes(true); });
  }
  if (!window._workerOfflinePollStarted) {
    window._workerOfflinePollStarted = true;
    setInterval(function () {
      if (!isCivilWorker()) return;
      var wa = document.getElementById('workerApp');
      if (!wa || !wa.classList.contains('show')) return;
      syncWorkerOfflineFixes(true);
    }, 20000);
  }
}
function renderWorkerJobs() {
  var host = document.getElementById('workerJobList');
  var bar = document.getElementById('workerCountBar');
  if (!host) return;
  var rows = allIssues.filter(function (r) { return r.status !== 'fixed' && !workerCompletedByMe(r); });
  rows.sort(compareIssuesNewestFirst);
  if (bar) bar.textContent = rows.length + ' open job' + (rows.length === 1 ? '' : 's') + ' assigned to you';
  var sig = rows.length + '|' + Object.keys(_workerOfflineQueuedIds || {}).length + '|' + rows.map(function (r) { return r.id + ':' + r.status; }).join(',');
  if (sig === _workerJobsRenderSig && workerJobsDisplayed_()) {
    workerPushTryOpenPendingJob_();
    return;
  }
  _workerJobsRenderSig = sig;
  if (!rows.length) {
    var pending = Object.keys(_workerOfflineQueuedIds || {}).length;
    var pendingNote = pending
      ? ('<br><span style="font-size:13px;color:#d68910;">' + pending + ' fix' + (pending === 1 ? '' : 'es') + ' waiting to upload when you have signal.</span>')
      : '';
    host.innerHTML = '<p class="worker-empty">\u2705 No open jobs right now.' + pendingNote + '<br><span style="font-size:13px;color:var(--text-soft);">Pull down or tap refresh when the engineer assigns new work.</span></p>';
    workerPushTryOpenPendingJob_();
    return;
  }
  host.innerHTML = rows.map(function (r) {
    var thumb = r.photo
      ? '<img class="worker-job-thumb" src="' + r.photo + '" loading="lazy" alt="">'
      : '<div class="worker-job-thumb worker-job-thumb-empty">No photo</div>';
    var need = issueWorkersRequired(r);
    var twoBadge = need > 1 ? '<span class="workers-badge">' + issueWorkerDone(r) + '/' + need + ' workers</span>' : '';
    return '<div class="worker-job-card" onclick="openWorkerJob(\'' + r.id + '\')">' + thumb
      + '<div class="worker-job-body"><div class="worker-job-ref">#' + issueRef(r.num) + twoBadge + '</div>'
      + '<div class="worker-job-type">' + r.issueType + '</div>'
      + '<div class="worker-job-loc">' + locStr(r) + '</div>'
      + '<div class="worker-job-proj">' + (projectNames[r.project] || r.project) + '</div></div></div>';
  }).join('');
  workerPushTryOpenPendingJob_();
}
function workerPushTryOpenPendingJob_() {
  if (typeof empirePushTryOpenPendingJob === 'function') {
    setTimeout(function () { empirePushTryOpenPendingJob(); }, 80);
  }
}
function workerFixVoiceId_(issueId) {
  return 'worker-fix-' + String(issueId || '');
}
function openWorkerJob(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r) return;
  if (workerCompletedByMe(r)) {
    if (workerHasPendingOfflineFix(r)) openWorkerJobPendingView(id);
    else openWorkerJobDoneView(id);
    return;
  }
  _workerFixId = id;
  _workerFixPhotos = [];
  _workerUploading = 0;
  var title = document.getElementById('workerModalTitle');
  if (title) title.textContent = '#' + issueRef(r.num);
  var body = document.getElementById('workerModalBody');
  if (!body) return;
  var h = '<h2 class="worker-job-type-title">' + r.issueType + '</h2><p class="loc">' + workerJobLocStr(r) + '</p>';
  if (r.note) h += '<p class="worker-issue-note"><strong>Note:</strong> ' + r.note + '</p>';
  if (r.assignVoiceNote && r.assignVoiceNote.url && typeof assignVoiceNoteDisplayHtml === 'function') {
    h += assignVoiceNoteDisplayHtml(r.assignVoiceNote, { worker: true });
  }
  var need = issueWorkersRequired(r);
  if (need > 1) {
    h += '<p class="worker-two-note">This job needs <strong>' + need + ' workers</strong> to each take photos.' + (issueWorkerDone(r) ? (' <span>(' + issueWorkerDone(r) + '/' + need + ' already done)</span>') : '') + '</p>';
  }
  h += r.photo ? '<img class="worker-problem-img" src="' + r.photo + '" alt="Problem">' : '';
  h += '<div class="worker-fix-section worker-fix-simple">';
  h += '<div id="worker-photo-grid" class="worker-photo-grid"></div>';
  h += '<div class="worker-photo-actions">';
  h += '<div class="worker-camera-zone compact" onclick="triggerWorkerCamera()" role="button" tabindex="0" aria-label="Take completion photo with camera">';
  h += '<span class="worker-camera-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg></span>';
  h += '<strong>Take photo</strong></div>';
  h += '<div class="worker-gallery-zone compact" onclick="triggerWorkerGallery()" role="button" tabindex="0" aria-label="Upload completion photo from gallery">';
  h += '<span class="worker-gallery-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></span>';
  h += '<strong>Upload photo</strong></div></div>';
  h += '<input type="file" id="worker-fix-camera" accept="image/*" capture="environment" style="display:none" onchange="handleWorkerFixFile(event,\'camera\')">';
  h += '<input type="file" id="worker-fix-gallery" accept="image/*" style="display:none" onchange="handleWorkerFixFile(event,\'gallery\')">';
  h += '<input type="text" id="worker-fix-note" class="worker-fix-note" placeholder="Note (optional)">';
  h += '<input type="text" id="worker-fix-materials" class="worker-fix-note" placeholder="Materials used (optional)">';
  h += '<div id="workerFixVoiceHost" class="worker-field-voice-host"></div>';
  h += '<button type="button" id="worker-submit-btn" class="worker-submit-fix" disabled onclick="submitWorkerFix(\'' + id + '\')">Mark as fixed</button></div>';
  body.innerHTML = h;
  var voiceHost = document.getElementById('workerFixVoiceHost');
  if (voiceHost && typeof assignVoiceBoxHtml === 'function') {
    voiceHost.innerHTML = assignVoiceBoxHtml(workerFixVoiceId_(id), null, { workerReport: true });
  }
  renderWorkerPhotoGrid();
  if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(body);
  document.getElementById('workerJobModal').classList.add('show');
  sendWorkerLocationNow(true, isWorkerLocPromptDone_());
}
function openWorkerJobPendingView(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r) return;
  _workerFixId = null;
  _workerFixPhotos = [];
  _workerUploading = 0;
  var title = document.getElementById('workerModalTitle');
  if (title) title.textContent = '#' + issueRef(r.num);
  var body = document.getElementById('workerModalBody');
  if (!body) return;
  body.innerHTML = '<p class="worker-empty">Loading saved fix\u2026</p>';
  document.getElementById('workerJobModal').classList.add('show');
  if (typeof empireOfflineQueueAll !== 'function') {
    body.innerHTML = '<p class="worker-empty">Waiting to upload when you have signal.</p>';
    return;
  }
  empireOfflineQueueAll().then(function (rows) {
    var item = rows.find(function (x) {
      return x.type === 'worker_issue_fix' && x.dept === ISSUE_CFG.dept && x.issueId === id;
    });
    var photos = item ? [].concat(item.remoteUrls || [], item.imageDataUrls || []) : [];
    var itemSources = item ? (item.photoSources || []) : [];
    if (item && item.orderedPhotos && item.orderedPhotos.length) {
      photos = item.orderedPhotos.map(function (p) { return p.url; });
      itemSources = item.orderedPhotos.map(function (p) { return p.source; });
    }
    var h = '<h2 class="worker-job-type-title">' + r.issueType + '</h2><p class="loc">' + workerJobLocStr(r) + '</p>';
    h += '<div class="worker-done-locked worker-pending-sync"><p class="worker-done-msg">' + checkIconHtml('#d68910') + ' Saved on this device</p>';
    h += '<p style="font-size:13px;color:var(--text-soft);margin:0;">Waiting for internet to upload your photos and mark this job fixed. Keep this page open or come back later.</p></div>';
    if (photos.length) {
      h += '<div class="worker-fix-section"><h3>Your photos (not uploaded yet)</h3><div class="worker-photo-grid">';
      photos.forEach(function (url, i) {
        var src = itemSources[i] || 'camera';
        h += '<div class="worker-photo-item"><img src="' + url + '" onclick="bigImg(this.src)" alt="Photo ' + (i + 1) + '"><span class="worker-photo-label">'
          + photoSourceBadgeHtml(src) + ' Photo ' + (i + 1) + (isOfflinePhotoUrl(url) ? ' &middot; on device' : '') + '</span></div>';
      });
      h += '</div></div>';
    }
    if (item && item.fixNote) h += '<p style="font-size:13px;color:var(--text-soft);margin-top:10px;"><strong>Note:</strong> ' + item.fixNote + '</p>';
    body.innerHTML = h;
  }).catch(function () {
    body.innerHTML = '<p class="worker-empty">Waiting to upload when you have signal.</p>';
  });
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
  var h = '<h2 class="worker-job-type-title">' + r.issueType + '</h2><p class="loc">' + workerJobLocStr(r) + '</p>';
  h += '<div class="worker-done-locked"><p class="worker-done-msg">' + checkIconHtml('#1d9e75') + ' You already marked this job as fixed.</p>';
  h += '<p style="font-size:13px;color:var(--text-soft);margin:0;">You cannot add more photos for this issue.</p></div>';
  if (mine && mine.photos && mine.photos.length) {
    h += '<div class="worker-fix-section"><h3>Your submitted photos</h3><div class="worker-photo-grid">';
    mine.photos.forEach(function (url, i) {
      h += '<div class="worker-photo-item"><img src="' + url + '" onclick="bigImg(this.src)" alt="Photo ' + (i + 1) + '"><span class="worker-photo-label">'
        + photoSourceBadgeHtml(completionPhotoSource(mine, i)) + ' Photo ' + (i + 1) + '</span></div>';
    });
    h += '</div></div>';
  }
  if (mine && mine.voiceNote && mine.voiceNote.url && typeof assignVoiceNoteDisplayHtml === 'function') {
    h += '<div class="worker-fix-section"><h3>Your voice note</h3>' + assignVoiceNoteDisplayHtml(mine.voiceNote, { worker: true }) + '</div>';
  }
  var needDone = issueWorkersRequired(r);
  if (needDone > 1 && r.status !== 'fixed') {
    h += '<p class="worker-two-note">Waiting for other workers to complete this job (' + issueWorkerDone(r) + '/' + needDone + ' done).</p>';
  }
  body.innerHTML = h;
  document.getElementById('workerJobModal').classList.add('show');
}
function triggerWorkerCamera() {
  var inp = document.getElementById('worker-fix-camera');
  if (inp) inp.click();
}
function triggerWorkerGallery() {
  var inp = document.getElementById('worker-fix-gallery');
  if (inp) inp.click();
}
function renderWorkerPhotoGrid() {
  var grid = document.getElementById('worker-photo-grid');
  if (!grid) return;
  if (!_workerFixPhotos.length) {
    grid.innerHTML = '';
    grid.classList.add('worker-photo-grid-empty');
  } else {
    grid.classList.remove('worker-photo-grid-empty');
    grid.innerHTML = _workerFixPhotos.map(function (item, i) {
      var url = workerPhotoUrl(item);
      var offline = isOfflinePhotoUrl(url);
      var source = workerPhotoSource(item);
      return '<div class="worker-photo-item"><img src="' + url + '" onclick="bigImg(this.src)" alt="Photo ' + (i + 1) + '">'
        + '<button type="button" class="worker-photo-remove" onclick="removeWorkerFixPhoto(' + i + ')" aria-label="Remove photo">&times;</button>'
        + '<span class="worker-photo-label">' + photoSourceBadgeHtml(source) + ' Photo ' + (i + 1)
        + (offline ? ' <span class="worker-photo-offline">on device</span>' : '') + '</span></div>';
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
  if (_workerFixId && typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFixVoiceId_(_workerFixId));
  document.getElementById('workerJobModal').classList.remove('show');
  _workerFixId = null;
  _workerFixPhotos = [];
  _workerUploading = 0;
}
function handleWorkerFixFile(e, source) {
  var f = e.target.files && e.target.files[0];
  if (f) processWorkerFixPhoto(f, source || 'camera');
  e.target.value = '';
}
function processWorkerFixPhoto(file, source) {
  if (!file || !_workerFixId) return;
  source = source === 'gallery' ? 'gallery' : 'camera';
  _workerUploading++;
  updateWorkerSubmitBtn();
  compressImageToBlob(file, function (blob) {
    if (!blob) {
      _workerUploading = Math.max(0, _workerUploading - 1);
      uiAlert('\u274c Could not process photo. Try again.');
      updateWorkerSubmitBtn();
      return;
    }
    function finishWithLocal(dataUrl) {
      _workerFixPhotos.push({ url: dataUrl, source: source });
      _workerUploading = Math.max(0, _workerUploading - 1);
      renderWorkerPhotoGrid();
      sendWorkerLocationNow(true, isWorkerLocPromptDone_());
      if (!navigator.onLine) {
        uiAlert('\u2705 Photo saved on this device. It will upload when you have signal.');
      }
    }
    function finishWithRemote(url) {
      _workerFixPhotos.push({ url: url, source: source });
      _workerUploading = Math.max(0, _workerUploading - 1);
      renderWorkerPhotoGrid();
      sendWorkerLocationNow(true, isWorkerLocPromptDone_());
    }
    if (!navigator.onLine) {
      empireOfflineBlobToDataUrl(blob).then(finishWithLocal).catch(function () {
        _workerUploading = Math.max(0, _workerUploading - 1);
        uiAlert('\u274c Could not save photo on device.');
        updateWorkerSubmitBtn();
      });
      return;
    }
    empireUploadPhoto(blob, issuePhotoFolder_(), function (url) {
      if (url) finishWithRemote(url);
      else {
        empireOfflineBlobToDataUrl(blob).then(function (dataUrl) {
          finishWithLocal(dataUrl);
          uiAlert('Upload failed — photo saved on this device. It will sync when you have signal.');
        }).catch(function () {
          _workerUploading = Math.max(0, _workerUploading - 1);
          uiAlert('\u274c Photo upload failed. Try again when you have signal.');
          updateWorkerSubmitBtn();
        });
      }
    });
  });
}
function compressImageToBlob(file, cb) {
  var r = new FileReader();
  r.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var mx = 1400;
      var s = Math.min(1, mx / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { cb(b); }, 'image/jpeg', 0.7);
    };
    img.onerror = function () { cb(null); };
    img.src = e.target.result;
  };
  r.onerror = function () { cb(null); };
  r.readAsDataURL(file);
}
function workerFixNeedsOfflineQueue() {
  return !navigator.onLine || _workerFixPhotos.some(function (item) { return isOfflinePhotoUrl(workerPhotoUrl(item)); });
}
function submitWorkerFixSuccess(id, d) {
  if (d && d.partial) {
    allIssues = allIssues.filter(function (x) { return x.id !== id; });
    writeIssuesCacheAsync(allIssues);
    closeWorkerJob();
    renderWorkerJobs();
    uiAlert('\u2705 Your fix was saved. Waiting for other workers (' + (d.workerDone || 1) + '/' + (d.workersRequired || 2) + ').');
    return;
  }
  allIssues = allIssues.filter(function (x) { return x.id !== id; });
  writeIssuesCacheAsync(allIssues);
  closeWorkerJob();
  renderWorkerJobs();
  uiAlert('\u2705 Job marked fixed!');
}
function submitWorkerFixOffline(id, note, btn, coords, voiceNote, materials) {
  enqueueWorkerFixOffline(id, note, _workerFixPhotos.slice(), coords, voiceNote, materials).then(function () {
    if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFixVoiceId_(id));
    markWorkerFixQueuedLocally(id);
    allIssues = allIssues.filter(function (x) { return x.id !== id; });
    writeIssuesCacheAsync(allIssues);
    closeWorkerJob();
    renderWorkerJobs();
    uiAlert('\u2705 Saved on this device. Will upload automatically when you have signal.');
  }).catch(function (e) {
    uiAlert('\u274c ' + (e.message || 'Could not save offline'));
    resetWorkerSubmitBtn_();
  });
}
function resetWorkerSubmitBtn_() {
  var btn = document.getElementById('worker-submit-btn');
  var modal = document.getElementById('workerJobModal');
  if (!btn || !modal || !modal.classList.contains('show')) return;
  btn.disabled = false;
  btn.textContent = 'Mark as fixed';
  updateWorkerSubmitBtn();
}
function getWorkerFixLocationAsync(cb) {
  var done = false;
  function finish(val) {
    if (done) return;
    done = true;
    cb(val);
  }
  setTimeout(function () { finish(null); }, 14000);
  if (!navigator.geolocation) { finish(null); return; }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      if (!pos || !pos.coords) { finish(null); return; }
      finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    },
    function () { finish(null); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
}
function workerFixPayloadExtras_(coords) {
  if (!coords || !isFinite(Number(coords.lat)) || !isFinite(Number(coords.lng))) return {};
  return { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy };
}
function submitWorkerFix(id) {
  if (!_workerFixPhotos.length) { uiAlert('Please add at least one completion photo first.'); return; }
  if (workerCompletedByMe(allIssues.find(function (x) { return x.id === id; }))) {
    uiAlert('You already marked this job as fixed.');
    closeWorkerJob();
    renderWorkerJobs();
    return;
  }
  var btn = document.getElementById('worker-submit-btn');
  var noteEl = document.getElementById('worker-fix-note');
  var materialsEl = document.getElementById('worker-fix-materials');
  var note = noteEl ? noteEl.value.trim() : '';
  var materials = materialsEl ? materialsEl.value.trim() : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
  var voiceUpload = (typeof assignVoiceEnsureUploaded_ === 'function')
    ? assignVoiceEnsureUploaded_(workerFixVoiceId_(id), 45000)
    : Promise.resolve(null);
  voiceUpload.then(function (voiceNote) {
    getWorkerFixLocationAsync(function (coords) {
      try {
        if (typeof assignVoiceBlockSaveIfDraftFailed_ === 'function') {
          assignVoiceBlockSaveIfDraftFailed_(workerFixVoiceId_(id), voiceNote);
        }
      } catch (voiceErr) {
        uiAlert('\u274c ' + voiceErr.message);
        resetWorkerSubmitBtn_();
        return;
      }
      if (workerFixNeedsOfflineQueue()) {
        submitWorkerFixOffline(id, note, btn, coords, voiceNote, materials);
        return;
      }
      var urls = normalizePhotoUrls(_workerFixPhotos);
      var photoSources = _workerFixPhotos.map(workerPhotoSource);
      var payload = Object.assign({
        action: ISSUE_CFG.actions.markFixed,
        id: id,
        fixedPhoto: joinFixedPhotos(urls),
        fixedPhotos: urls,
        photoSources: photoSources,
        fixNote: note,
        fixMaterials: materials,
        token: issueToken() || ''
      }, workerFixPayloadExtras_(coords));
      if (voiceNote && voiceNote.url) payload.fixVoiceNote = voiceNote;
      fetchJSONRetry(payload, 2, 45000)
      .then(function (d) {
        if (d && d.ok === false) {
          if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) {
            resetWorkerSubmitBtn_();
            return;
          }
          throw new Error(d.message || d.error || 'Could not save');
        }
        if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFixVoiceId_(id));
        submitWorkerFixSuccess(id, d);
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
        if (!navigator.onLine || /fetch|network|failed|timeout/i.test(e.message || '')) {
          try {
            if (typeof assignVoiceBlockSaveIfDraftFailed_ === 'function') {
              assignVoiceBlockSaveIfDraftFailed_(workerFixVoiceId_(id), voiceNote);
            }
          } catch (voiceErr) {
            uiAlert('\u274c ' + voiceErr.message);
            resetWorkerSubmitBtn_();
            return;
          }
          submitWorkerFixOffline(id, note, btn, coords, voiceNote, materials);
          return;
        }
        uiAlert('\u274c ' + (e.message || 'Could not save'));
        resetWorkerSubmitBtn_();
      });
    });
  }).catch(function (e) {
    uiAlert('\u274c ' + (e.message || 'Voice note upload failed. The job was not saved — try again or delete the recording.'));
    resetWorkerSubmitBtn_();
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
function bulkAssignBlockedHint(){ if(canBulkAssignIssues()||!tradeGroups().length||!ISSUE_CFG.actions.assign) return ''; return '<span class="issue-select-hint">Worker assign needs an <strong>editor</strong> or <strong>admin</strong> account. Log out and ask your admin to set your role in the Users sheet.</span>'; }
function bulkAssignWorkersPickerHtml() {
  return '<div class="bulk-assign-workers" onclick="event.stopPropagation()">' + assignWorkersPickerHtml([], 'bulk-assign-worker-cb', 'bulk') + '</div>';
}
var _bulkAssignBtnState = 'idle';
var _bulkAssignBtnResetTimer = null;
function clearBulkAssignWorkerChecks() {
  document.querySelectorAll('.bulk-assign-worker-cb').forEach(function (cb) { cb.checked = false; });
}
function scheduleBulkAssignBtnReset(ms) {
  if (_bulkAssignBtnResetTimer) clearTimeout(_bulkAssignBtnResetTimer);
  _bulkAssignBtnResetTimer = setTimeout(function () {
    _bulkAssignBtnResetTimer = null;
    _bulkAssignBtnState = 'idle';
    if (issueSelectMode) renderIssues();
  }, ms || 4000);
}
function bulkAssignBtnHtml(cnt) {
  var disabled = cnt ? '' : 'disabled style="opacity:0.55;"';
  var cls = 'bulk-assign-btn';
  var text = 'Assign workers';
  var style = '';
  if (_bulkAssignBtnState === 'saving') {
    cls += ' saving';
    text = 'Assigning\u2026';
    disabled = 'disabled style="opacity:0.55;"';
  } else if (_bulkAssignBtnState === 'saved') {
    cls += ' saved';
    text = 'Assigned';
    style = ' style="background:#1d9e75 !important;color:#fff !important;border:none !important;"';
  } else if (_bulkAssignBtnState === 'error') {
    cls += ' error';
    text = 'Retry';
    style = ' style="background:#C5504F !important;color:#fff !important;border:none !important;"';
  }
  return '<button type="button" id="bulk-assign-btn" class="' + cls + '"' + style + ' onclick="assignSelectedIssues()" ' + disabled + '>' + text + '</button>';
}
function setBulkAssignBtnState(state) {
  _bulkAssignBtnState = state || 'idle';
  var btn = document.getElementById('bulk-assign-btn');
  if (!btn) return;
  btn.classList.remove('saving', 'saved', 'error');
  btn.disabled = false;
  btn.style.background = '';
  btn.style.color = '';
  btn.style.border = '';
  if (state === 'saving') {
    btn.disabled = true;
    btn.textContent = 'Assigning\u2026';
    btn.classList.add('saving');
  } else if (state === 'saved') {
    btn.textContent = 'Assigned';
    btn.classList.add('saved');
    btn.style.background = '#1d9e75';
    btn.style.color = '#fff';
    btn.style.border = 'none';
  } else if (state === 'error') {
    btn.textContent = 'Retry';
    btn.classList.add('error');
    btn.style.background = '#C5504F';
    btn.style.color = '#fff';
    btn.style.border = 'none';
  } else {
    btn.textContent = 'Assign workers';
  }
}
function finishBulkAssignSuccess(assignedIds) {
  if (assignedIds && assignedIds.length) {
    assignedIds.forEach(function (id) { delete selectedIssueIds[id]; });
  } else {
    selectedIssueIds = {};
  }
  clearBulkAssignWorkerChecks();
  writeIssuesCacheAsync(allIssues);
  _bulkAssignBtnState = 'saved';
  renderIssues();
  scheduleBulkAssignBtnReset(4000);
}
function selectAllVisibleIssues(){ var ids=window._visibleIssueIds||[]; ids.forEach(function(id){ selectedIssueIds[id]=true; }); renderIssues(); }
function assignIssueErrorMsg(e) {
  var msg = (e && e.message) ? e.message : 'Assign failed';
  if (/unknown action|invalid server response/i.test(msg)) {
    msg += '\n\nRedeploy empire-all-in-one.gs in Google Apps Script, then hard-refresh this page.';
  } else if (/not_allowed|only engineer/i.test(msg)) {
    msg += '\n\nLog out and log in again, or set your Users sheet role to editor or admin.';
  }
  return msg;
}
function assignSelectedIssues() {
  var ids = Object.keys(selectedIssueIds).filter(function (id) {
    var it = allIssues.find(function (x) { return x.id === id; });
    return it && it.status !== 'fixed';
  });
  if (!ids.length) { alert('Select at least one open issue first.'); return; }
  if (!canBulkAssignIssues()) return;
  var workers = readAssignWorkerChecks('bulk-assign-worker-cb');
  if (!workers.length) { alert('Select at least one worker.'); return; }
  if (workers.length > maxAssignWorkers()) { alert('Select at most ' + maxAssignWorkers() + ' workers.'); return; }
  var workersRequired = assignWorkersRequiredCount(workers);
  var group = civilWorkerTeamId(workers[0]);
  var label = workers.map(function (w) { return civilWorkerName(w); }).join(', ');
  var confirmMsg = ids.length === 1
    ? 'Are you sure you want to assign to ' + label + '?'
    : 'Are you sure you want to assign ' + ids.length + ' issues to ' + label + '?';
  uiConfirm(confirmMsg).then(function (ok) {
    if (!ok) return;
    var prev = {};
    ids.forEach(function (id) {
      var it = allIssues.find(function (x) { return x.id === id; });
      if (it) {
        prev[id] = {
          assignedGroup: it.assignedGroup || '',
          assignedWorkers: assignedWorkersList(it).slice(),
          workersRequired: issueWorkersRequired(it),
          workerCompletions: it.workerCompletions || []
        };
        it.assignedGroup = group;
        it.assignedWorkers = workers.slice();
        it.workersRequired = workersRequired;
        it.workerCompletions = [];
        it.workerDone = 0;
        it.fixedPhoto = '';
        it.fixedBy = '';
      }
    });
    writeIssuesCacheAsync(allIssues);
    setBulkAssignBtnState('saving');
    fetchJSONRetry({
      action: ISSUE_CFG.actions.assign,
      ids: ids,
      assignedGroup: group,
      assignedWorkers: workers,
      workersRequired: workersRequired,
      token: issueToken() || ''
    }, 2, 90000).then(function (d) {
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Assign failed');
      }
      if (d && d.assignedGroup !== undefined) {
        ids.forEach(function (id) {
          var it = allIssues.find(function (x) { return x.id === id; });
          if (it) {
            it.assignedGroup = d.assignedGroup;
            if (d.assignedWorkers) it.assignedWorkers = d.assignedWorkers;
            if (d.workersRequired !== undefined) it.workersRequired = d.workersRequired;
          }
        });
      }
      writeIssuesCacheAsync(allIssues);
      finishBulkAssignSuccess(ids);
    }).catch(function (e) {
      ids.forEach(function (id) {
        var it = allIssues.find(function (x) { return x.id === id; });
        if (it && prev[id]) {
          it.assignedGroup = prev[id].assignedGroup;
          it.assignedWorkers = prev[id].assignedWorkers;
          it.workersRequired = prev[id].workersRequired;
          it.workerCompletions = prev[id].workerCompletions;
          it.workerDone = (prev[id].workerCompletions || []).length;
        }
      });
      writeIssuesCacheAsync(allIssues);
      _bulkAssignBtnState = 'error';
      renderIssues();
      setBulkAssignBtnState('error');
      scheduleBulkAssignBtnReset(3500);
      alert('\u274C ' + assignIssueErrorMsg(e));
    });
  });
}
function issueSelectToolbarHtml() {
  var cnt = selectedIssueCount();
  var bulk = canBulkAssignIssues();
  var canDel = canBulkDeleteIssues();
  var hint = 'Select issues, then assign workers, delete, or share on WhatsApp.';
  if (!issueSelectMode) {
    return '<div class="issue-select-bar"><span>' + hint + '</span><button type="button" onclick="toggleIssueSelectMode()" style="padding:8px 14px;font-size:12px;margin-left:auto;">Select issues</button></div>';
  }
  var h = '<div class="issue-select-bar issue-select-bar-active"><div class="issue-select-row"><span><strong>' + cnt + '</strong> selected</span>';
  if (bulk) {
    h += bulkAssignBtnHtml(cnt);
  } else {
    h += bulkAssignBlockedHint();
  }
  if (canDel) {
    h += '<button type="button" class="bulk-delete-btn" onclick="deleteSelectedIssues()" ' + (cnt ? '' : 'disabled style="opacity:0.55;"') + '>Delete selected</button>';
  }
  h += '</div>';
  if (bulk) {
    h += '<p class="assign-multi-hint">Assign 1 worker, or 2–4 workers — if more than one, <strong>each</strong> must upload photos on their phone before the job is complete.</p>';
    h += bulkAssignWorkersPickerHtml();
  }
  h += '<div class="issue-select-row">';
  h += '<button type="button" onclick="shareSelectedWhatsApp()" style="background:#25D366;color:#fff;border:none;padding:8px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;' + (cnt ? '' : 'opacity:0.55;') + '" ' + (cnt ? '' : 'disabled') + '>' + whatsappIconHtml() + ' Share on WhatsApp</button>';
  h += '<button type="button" onclick="selectAllVisibleIssues()" style="padding:8px 14px;font-size:12px;">Select all</button>';
  h += '<button type="button" onclick="clearIssueSelection()" style="padding:8px 14px;font-size:12px;">Clear</button>';
  h += '<button type="button" onclick="toggleIssueSelectMode()" style="padding:8px 14px;font-size:12px;margin-left:auto;">Done</button>';
  h += '</div></div>';
  return h;
}
function issuePhotoFolder_() {
  var d = (typeof ISSUE_CFG !== 'undefined' && ISSUE_CFG.dept) ? ISSUE_CFG.dept : 'general';
  return 'issues/' + String(d).replace(/\s+/g, '-').toLowerCase();
}
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
  function hideTab(act){ issueTabBtns().forEach(function(b){ var o=b.getAttribute('onclick')||''; if(o.indexOf("'"+act+"'")!==-1) b.style.display='none'; }); }
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
    hideTab('notcivil');
    hideTab('fixdelay');
    hideTab('gps');
  }
  if (!civilNotCivilTabEnabled()) hideTab('notcivil');
  if (!civilFixDelayTabEnabled()) hideTab('fixdelay');
  if (!engineerLocationPanelEnabled()) hideTab('gps');
  updateNotCivilNavBadge();
  updateFixDelayNavBadge();
  syncWorkerLocationsUi();
  var rb=document.querySelector((ISSUE_CFG.tabNavScope||'.side-nav')+' button[onclick*="openIssueResetModal"], button[onclick="openResetModal()"]'); if(rb && p.reset!==true) rb.style.display='none'; var tb=document.getElementById('btnIssueTrash'); if(!tb) tb=document.getElementById('btnTrash'); if(tb && p.reset!==true) tb.style.display='none';
  var wl=document.getElementById('whoLabel'); if(wl){ var u=empireGetUser()||''; var role=empireGetRole()||''; wl.textContent = u ? ('Logged in as: '+u+(role?(' ('+role+')'):'')) : ''; }
}
var _issueRouteLock = false;
function routeCivilIssueView_() {
  if (_issueRouteLock) return;
  _issueRouteLock = true;
  applyPerms();
  if (isCivilWorker()) {
    enterWorkerApp();
    return;
  }
  enterApp();
}
function syncWorkerRoleThenRoute_() {
  var routed = false;
  var timer = null;
  function done() {
    if (routed) return;
    routed = true;
    if (timer) clearTimeout(timer);
    routeCivilIssueView_();
  }
  if (!ISSUE_CFG.workerMode || !empireGetToken()) {
    done();
    return;
  }
  if (String(empireGetRole() || '').toLowerCase() === 'worker' || !isCivilWorkerAccount_(empireGetUser())) {
    done();
    return;
  }
  empireAuthRefreshPerms(function () { done(); });
  timer = setTimeout(done, 1200);
}
function handleLogin(e){ empireAuthLogin(e, ISSUE_CFG.dept, { onSuccess: function(d){ PAGEPERMS=d.perms||{}; if(typeof empireAuthSet==='function' && d.trade) empireAuthSet('trade', d.trade); if(ISSUE_CFG.workerMode) prefetchWorkerIssues_(); routeCivilIssueView_(); if(typeof empirePushTrySaveAfterLogin==='function'){ setTimeout(function(){ empirePushTrySaveAfterLogin(); }, 2000); } } }); }
function logout(){ stopWorkerLocationPing(); if(typeof empirePushStopWorker==='function') empirePushStopWorker(); stopEngineerLocationPoll(); empireAuthLogout({ extraKeys: [ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY], redirect: 'index.html', reload: false }); }
function issueSessionLogoutOpts(){ return { extraKeys: [ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY], redirect: 'index.html', reload: false }; }
function forceSessionLogout(d){ return empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts()); }
function compressImage(file, cb) {
  empireCompressImage(file, issuePhotoFolder_(), cb, { maxSize: 1400, quality: 0.7 });
}
function processIssuePhoto(file){ if(!file) return; const area=document.getElementById('ci-imageArea'); area.innerHTML='\u23F3 Uploading\u2026'; uploadingIssue=true; compressImage(file,url=>{ uploadingIssue=false; if(url){ currentIssueImage=url; const im=document.getElementById('ci-image'); im.src=url; im.style.display='block'; area.innerHTML='\u2705 Photo uploaded'; } else { area.innerHTML='\u274C ' + (_lastEmpireUploadError || 'Upload failed, try again'); } }); }
function handlePaste(e,which){ const items=e.clipboardData.items; for(let i=0;i<items.length;i++){ if(items[i].type.indexOf('image')!==-1){ e.preventDefault(); processIssuePhoto(items[i].getAsFile()); return; } } }
function handleIssueFile(e){ const f=e.target.files && e.target.files[0]; if(f) processIssuePhoto(f); e.target.value=''; }
function populateSelect(id,arr,useKeys){ const el=document.getElementById(id); el.innerHTML=''; arr.forEach(v=>{ const o=document.createElement('option'); if(useKeys){ o.value=v; o.textContent=projectNames[v]; } else { o.value=v; o.textContent=v; } el.appendChild(o); }); }
function updateCIBuildings(){ const p=document.getElementById('ci-project').value; const bs=Object.keys(floors[p]||{}); const el=document.getElementById('ci-building'); el.innerHTML=''; bs.forEach(b=>{ const o=document.createElement('option'); o.value=b;o.textContent=b; el.appendChild(o); }); updateCIFloors(); }
function updateCIFloors(){ const p=document.getElementById('ci-project').value; const b=document.getElementById('ci-building').value; const fs=(floors[p]&&floors[p][b])?floors[p][b]:[]; const el=document.getElementById('ci-floor'); el.innerHTML=''; fs.forEach(f=>{ const o=document.createElement('option'); o.value=f;o.textContent=f; el.appendChild(o); }); }
function toggleOther(){ document.getElementById('ci-otherwrap').style.display = document.getElementById('ci-issuetype').value==='Other'?'flex':'none'; }
function clearIssueForm(){ currentIssueImage=''; document.getElementById('ci-image').style.display='none'; document.getElementById('ci-imageArea').innerHTML='Click here and paste (Ctrl+V)'; document.getElementById('ci-note').value=''; document.getElementById('ci-other').value=''; var sv=document.getElementById('ci-supervisor'); if(sv) sv.value=''; window._editingId=null; var eb=document.getElementById('editBanner'); if(eb) eb.style.display='none'; }
function saveIssue(){ if(uploadingIssue){ alert('Please wait for the photo to finish uploading.'); return; } let itype=document.getElementById('ci-issuetype').value; if(itype==='Other'){ const o=document.getElementById('ci-other').value.trim(); if(!o){ alert('Please describe the Other issue.'); return; } itype=o; } var supervisor=document.getElementById('ci-supervisor').value; if(!supervisor){ alert('Please select the supervisor.'); return; } function go(){ var btn=document.getElementById('saveIssueBtn'); var oldTxt=btn?btn.innerHTML:''; if(btn){ btn.disabled=true; btn.style.opacity='0.6'; btn.innerHTML='\u23F3 Saving\u2026'; } var newId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(16).slice(2)); const rec={ action:ISSUE_CFG.actions.add, id:newId, project:document.getElementById('ci-project').value, building:document.getElementById('ci-building').value, floor:document.getElementById('ci-floor').value, spot:document.getElementById('ci-spot').value, issueType:itype, note:document.getElementById('ci-note').value, supervisor:supervisor, date:document.getElementById('ci-date').value||empireLocalDateIso(), photo:currentIssueImage, token:issueToken()||'' }; if(window._editingId){ rec.id=window._editingId; rec.action=rec.action.replace('add','update'); } fetchJSONRetry(rec).then(function(d){ if(d&&d.ok===false){ if(empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return; throw new Error(d.message||d.error||'Save failed'); } var wasEdit=!!window._editingId; window._editingId=null; alert(wasEdit?'\u2705 Issue updated!':'\u2705 Issue saved!'); clearIssueForm(); loadIssues(true); switchTabTo('list'); }).catch(function(e){ alert('\u274C Error: '+e.message); }).finally(function(){ if(btn){ btn.disabled=false; btn.style.opacity=''; btn.innerHTML=oldTxt; } }); } if(!currentIssueImage){ uiConfirm('No photo attached. Save anyway?').then(function(ok){ if(ok) go(); }); return; } go(); }
var ISSUES_CACHE_KEY, ISSUES_CACHE_TS_KEY, ISSUE_VIEW_KEY;

var ISSUES_CACHE_TTL=300000;
var _issuesFetchCtrl=null;
var _workerBgPausedUntil=0;
window.empirePauseWorkerBackgroundRequests=function(ms){
  _workerBgPausedUntil=Date.now()+(ms||35000);
};
function workerBackgroundPaused_(){ return isCivilWorker() && Date.now()<_workerBgPausedUntil; }
function readIssuesCache(){ try{ var s=localStorage.getItem(ISSUES_CACHE_KEY); if(!s) return null; var a=JSON.parse(s); return Array.isArray(a)?a:null; }catch(e){ return null; } }
function readIssuesCacheTs(){ try{ return Number(localStorage.getItem(ISSUES_CACHE_TS_KEY)||0); }catch(e){ return 0; } }
function writeIssuesCache(a){ try{ localStorage.setItem(ISSUES_CACHE_KEY, JSON.stringify(a)); localStorage.setItem(ISSUES_CACHE_TS_KEY, String(Date.now())); }catch(e){} }
function writeIssuesCacheAsync(a){ var run=function(){ writeIssuesCache(a); }; if(window.requestIdleCallback) requestIdleCallback(run,{timeout:3000}); else setTimeout(run,0); }
function fetchIssuesFromServer(signal){ return fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:ISSUE_CFG.actions.get,token:issueToken()||''}),signal:signal}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
var _issuesListSig='';
function issueMetaCounts_(arr) {
  var delayed = 0, routed = 0;
  if (!arr || !arr.length) return { delayed: 0, routed: 0 };
  for (var i = 0; i < arr.length; i++) {
    if (String(arr[i].fixDelay || '').toLowerCase() === 'month_plus') delayed++;
    if (String(arr[i].disposition || '').toLowerCase() === routedDisposition()) routed++;
  }
  return { delayed: delayed, routed: routed };
}
function issuesListSig(arr) {
  if (!arr || !arr.length) return '0';
  var meta = issueMetaCounts_(arr);
  return arr.length + '|' + String(arr[0].id) + '|' + String(arr[arr.length - 1].id) + '|' + String(arr[0].status) + '|' + String(arr[arr.length - 1].status) + '|d' + meta.delayed + '|r' + meta.routed;
}
function mergeIssueMetaFromServer(next, prev) {
  if (!prev || !prev.length || !next || !next.length) return next;
  var map = {};
  prev.forEach(function (p) { if (p && p.id) map[p.id] = p; });
  return next.map(function (n) {
    var p = map[n.id];
    if (!p) return n;
    var out = Object.assign({}, n);
    if (!out.fixDelay && p.fixDelay) out.fixDelay = p.fixDelay;
    if (!out.disposition && p.disposition) out.disposition = p.disposition;
    if (!out.assignVoiceNote && p.assignVoiceNote) out.assignVoiceNote = p.assignVoiceNote;
    return out;
  });
}
function setIssuesFromData(arr){ if(!Array.isArray(arr)) arr=[]; var sig=issuesListSig(arr); var changed=(sig!==_issuesListSig); _issuesListSig=sig; allIssues=arr; return changed; }
function prefetchWorkerIssues_() {
  if (!ISSUE_CFG.workerMode || !issueToken() || !isCivilWorker()) return;
  fetchJSONRetry({ action: ISSUE_CFG.actions.get, token: issueToken() || '' }, 1, 45000)
    .then(function (d) {
      if (Array.isArray(d)) {
        setIssuesFromData(d);
        writeIssuesCacheAsync(d);
        renderWorkerJobs();
      }
    })
    .catch(function () {});
}
function scheduleWorkerLocationPing_(force) {
  if (!isCivilWorker() || !workerLocationActionsEnabled()) return;
  setTimeout(function () { sendWorkerLocationNow(!!force, true); }, force ? 400 : 0);
}
function deferHeavyRenders(){ var run=function(){ var ac=document.getElementById('analytics'); if(ac&&ac.classList.contains('active')) renderAnalytics(); }; if(window.requestIdleCallback) requestIdleCallback(run,{timeout:2500}); else setTimeout(run,80); }
var _workerIssuesFetchSeq = 0;
function loadIssues(force){ force=!!force; try {
  if(isCivilWorker()&&!force&&workerBackgroundPaused_()) return;
  if(isCivilWorker()&&force) scheduleWorkerLocationPing_(true);
  var cached=readIssuesCache();
  if(isCivilWorker()){
    if(cached){
      var changedFromCache=setIssuesFromData(cached);
      if(changedFromCache) renderWorkerJobs();
      if(typeof empirePushOnIssuesLoaded==='function') empirePushOnIssuesLoaded(cached);
    }
  }
  var prevIssues=allIssues.slice();
  if(cached && !isCivilWorker()){ setIssuesFromData(cached); requestAnimationFrame(function(){ refreshAllIssueTabs(); }); }
  var spinEls=[document.getElementById('listRefreshIcon'),document.getElementById('navRefreshIcon'),document.getElementById('workerRefreshIcon'),document.getElementById('notCivilRefreshIcon'),document.getElementById('fixDelayRefreshIcon')];
  var cacheFresh=cached && !force && (Date.now()-readIssuesCacheTs()<ISSUES_CACHE_TTL);
  if(cacheFresh) return;
  if(isCivilWorker() && force && cached && (Date.now()-readIssuesCacheTs()<WORKER_RESUME_FETCH_MIN_MS)) return;
  var it=document.getElementById('issuesTable');
  if(it && !cached && !isCivilWorker()) it.innerHTML=LOADING_HTML;
  if(isCivilWorker() && !workerJobsDisplayed_() && !cached){
    var wbar=document.getElementById('workerCountBar');
    if(wbar) wbar.textContent='Loading jobs\u2026';
  }
  spinEls.forEach(function(el){ if(el) el.classList.add('spinning'); });
  var fetchSeq=++_workerIssuesFetchSeq;
  var workerFetch=isCivilWorker();
  if(!workerFetch){
    if(_issuesFetchCtrl) try{ _issuesFetchCtrl.abort(); }catch(e){}
    _issuesFetchCtrl=new AbortController();
  }
  var fetchTimeout=workerFetch ? null : setTimeout(function(){ try{ if(_issuesFetchCtrl) _issuesFetchCtrl.abort(); }catch(e){} }, 45000);
  var fetchPromise=workerFetch
    ? fetchJSONRetry({ action: ISSUE_CFG.actions.get, token: issueToken() || '' }, 2, 45000)
    : fetchIssuesFromServer(_issuesFetchCtrl.signal);
  fetchPromise.then(function(d){
    if(workerFetch && fetchSeq!==_workerIssuesFetchSeq) return;
    if(Array.isArray(d)){
      var merged=mergeIssueMetaFromServer(d, prevIssues.length?prevIssues:(cached||[]));
      var changed=setIssuesFromData(merged);
      writeIssuesCacheAsync(merged);
      if(isCivilWorker()){
        if(changed) renderWorkerJobs();
        if(typeof empirePushOnIssuesLoaded==='function') empirePushOnIssuesLoaded(merged);
      }
      else { requestAnimationFrame(function(){ refreshAllIssueTabs(); }); }
    } else if(d&&d.ok===false){
      if(forceSessionLogout(d)) return;
      if(isCivilWorker() && !workerJobsDisplayed_()) workerShowJobsError_(new Error(d.message||d.error||'Could not load jobs'));
    } else if(isCivilWorker() && !Array.isArray(d) && !workerJobsDisplayed_()){
      workerShowJobsError_(new Error('Unexpected server response. Redeploy empire-all-in-one.gs, then try again.'));
    }
  }).catch(function(e){
    if(workerFetch && fetchSeq!==_workerIssuesFetchSeq) return;
    if(e&&e.name==='AbortError') return;
    if(!cached && it && !isCivilWorker()) it.innerHTML='<p>Error loading: '+e.message+'</p>';
    if(isCivilWorker() && !workerJobsDisplayed_() && !cached) workerShowJobsError_(e);
  }).finally(function(){
    if(workerFetch && fetchSeq!==_workerIssuesFetchSeq) return;
    if(fetchTimeout) clearTimeout(fetchTimeout);
    spinEls.forEach(function(el){ if(el) el.classList.remove('spinning'); });
  });
} catch (e) {
  if(isCivilWorker() && !workerJobsDisplayed_()) workerShowJobsError_(e);
  else throw e;
}}
function locStr(r){ return r.building+' \u00B7 '+r.floor+' \u00B7 '+r.spot; }
function workerJobLocStr(r) {
  var b = String((r && r.building) || '').trim();
  var f = String((r && r.floor) || '').trim();
  var s = String((r && r.spot) || '').trim();
  if (b && f) return b + '-' + f + (s ? '. ' + s : '');
  if (b || f || s) return [b, f, s].filter(Boolean).join(' \u00B7 ');
  return '';
}
function dayOf(r){ var d=String(r.date||r.createdAt||''); if(/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0,10); var dt=new Date(d.replace(' ','T')); if(!isNaN(dt.getTime())){ var z=function(n){return String(n).padStart(2,'0');}; return dt.getFullYear()+'-'+z(dt.getMonth()+1)+'-'+z(dt.getDate()); } return ''; }
function monthOf(r){ var d=String(r.date||r.createdAt||''); if(!/^\d{4}-\d{2}-\d{2}/.test(d)) return ''; var yr=parseInt(d.slice(0,4),10), mo=parseInt(d.slice(5,7),10), dy=parseInt(d.slice(8,10),10); if(dy>=26){ mo+=1; if(mo>12){mo=1;yr+=1;} } return yr+'-'+String(mo).padStart(2,'0'); }
function canBulkDeleteIssues() {
  return !isCivilWorker() && PAGEPERMS.del !== false;
}
function deleteSelectedIssues() {
  var ids = Object.keys(selectedIssueIds);
  if (!ids.length) { alert('Select at least one issue first.'); return; }
  if (!canBulkDeleteIssues()) { alert('You do not have permission to delete.'); return; }
  uiConfirm('Delete <strong>' + ids.length + '</strong> issue(s)? They will go to the Recycle Bin.').then(function (ok) {
    if (!ok) return;
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ISSUE_CFG.actions.delete, ids: ids, token: issueToken() || '' })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Delete failed');
      }
      if (!(d && (d.ok || d.success))) throw new Error((d && (d.error || d.message)) || 'Delete failed');
      var idSet = {};
      ids.forEach(function (id) { idSet[id] = true; });
      allIssues = allIssues.filter(function (x) { return !idSet[x.id]; });
      selectedIssueIds = {};
      writeIssuesCacheAsync(allIssues);
      renderIssues();
      renderAnalytics();
    }).catch(function (e) { alert('\u274C ' + e.message); });
  });
}
function removeIssue(id){ uiConfirm('Delete this issue? It will go to the Recycle Bin.').then(function(ok){ if(!ok)return; fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:ISSUE_CFG.actions.delete,ids:[id],token:issueToken()||''})}).then(function(r){return r.json();}).then(function(d){ if(d&&(d.ok||d.success)){ allIssues=allIssues.filter(function(x){return x.id!==id;}); renderIssues(); renderAnalytics(); } else { alert('\u274C '+((d&&(d.error||d.message))||'Delete failed')); } }).catch(function(e){ alert('\u274C '+e.message); }); }); }
function issueIsRoutedAway(r) {
  return String((r && r.disposition) || '').toLowerCase() === routedDisposition();
}
function civilNotCivilTabEnabled() {
  return !!(ISSUE_CFG.actions && ISSUE_CFG.actions.routeNotCivil);
}
function civilFixDelayTabEnabled() {
  return !!(ISSUE_CFG.actions && ISSUE_CFG.actions.setFixDelay);
}
function countRoutedAwayIssues() {
  return allIssues.filter(function (r) { return issueIsRoutedAway(r); }).length;
}
function countFixDelayedIssues() {
  return allIssues.filter(function (r) { return isIssueFixDelayed(r) && r.status !== 'fixed' && !issueIsRoutedAway(r); }).length;
}
function updateNotCivilNavBadge() {
  if (!civilNotCivilTabEnabled()) return;
  var badge = document.getElementById('notCivilNavBadge');
  if (!badge) return;
  var n = countRoutedAwayIssues();
  badge.textContent = n > 0 ? String(n) : '';
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
}
function updateFixDelayNavBadge() {
  if (!civilFixDelayTabEnabled()) return;
  var badge = document.getElementById('fixDelayNavBadge');
  if (!badge) return;
  var n = countFixDelayedIssues();
  badge.textContent = n > 0 ? String(n) : '';
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
}
function refreshAllIssueTabs() {
  updateNotCivilNavBadge();
  updateFixDelayNavBadge();
  var list = document.getElementById('list');
  if (list && list.classList.contains('active')) renderIssues();
  var nc = document.getElementById('notcivil');
  if (nc && nc.classList.contains('active')) renderRoutedIssues();
  var fd = document.getElementById('fixdelay');
  if (fd && fd.classList.contains('active')) renderFixDelayIssues();
}
function issueMatchesIssueFilters(r, fp, fs, fm, fg, q) {
  if (fp && r.project !== fp) return false;
  if (fs && r.status !== fs) return false;
  if (fm && dayOf(r) !== fm) return false;
  if (fg && !issueMatchesTeamFilter(r, fg)) return false;
  if (q) {
    var qn = q.replace(/[#\s]/g, '');
    var ref = issueRef(r.num).toLowerCase();
    if (/^[a-z]+\d+$/.test(qn)) {
      if (qn !== ref) return false;
    } else if (/^\d+$/.test(qn)) {
      if (String(r.num || '') !== qn) return false;
    } else {
      var hay = (r.building + ' ' + r.floor + ' ' + r.spot + ' ' + r.issueType).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
  }
  return true;
}
function canRouteIssueAway(r) {
  return !!(ISSUE_CFG.actions && ISSUE_CFG.actions.routeNotCivil && PAGEPERMS.edit !== false && r && !issueIsRoutedAway(r) && r.status !== 'fixed');
}
function isIssueFixDelayed(r) {
  return String((r && r.fixDelay) || '').toLowerCase() === 'month_plus';
}
function canToggleFixDelay(r) {
  return !!(ISSUE_CFG.actions && ISSUE_CFG.actions.setFixDelay && PAGEPERMS.edit !== false && r && !issueIsRoutedAway(r) && r.status !== 'fixed');
}
function fixDelayIconHtml() {
  return '<span class="nav-icon" style="width:13px;height:13px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>';
}
function toggleIssueFixDelay(id) {
  var r = allIssues.find(function (x) { return x.id === id; });
  if (!r || !canToggleFixDelay(r)) return;
  var marking = !isIssueFixDelayed(r);
  var msg = marking
    ? 'Mark this issue as needing more than 1 month to fix?\n\nThe card will turn silver so everyone knows it cannot be fixed soon.'
    : 'Remove the 1+ month delay mark from this issue?';
  uiConfirm(msg).then(function (ok) {
    if (!ok) return;
    fetchJSONRetry({ action: ISSUE_CFG.actions.setFixDelay, id: id, toggle: true, token: issueToken() || '' }).then(function (d) {
      if (d && d.error === 'Unknown action') {
        throw new Error('Server not updated yet. Paste the latest empire-all-in-one.gs into Apps Script and deploy a new web app version.');
      }
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Could not update fix delay');
      }
      var it = allIssues.find(function (x) { return x.id === id; });
      if (it) it.fixDelay = d && d.fixDelay ? d.fixDelay : (marking ? 'month_plus' : '');
      writeIssuesCacheAsync(allIssues);
      closeIssueModal();
      refreshAllIssueTabs();
      uiAlert(marking ? '\u2705 Marked as needing 1+ month to fix.' : '\u2705 Delay mark removed.');
    }).catch(function (e) { uiAlert('\u274c ' + (e.message || 'Could not update fix delay')); });
  });
}
function routeAwayIconHtml() {
  return '<span class="nav-icon" style="width:13px;height:13px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></span>';
}
function restoreCivilIconHtml() {
  return '<span class="nav-icon" style="width:13px;height:13px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></span>';
}
function routeIssueNotCivil(id) {
  uiConfirm(issueUi_('routeConfirm', 'Move this issue out of Civil?\n\nIt will go to the "Not Civil Department" section. You can re-create it in Electric, Fire, or the correct department.')).then(function (ok) {
    if (!ok) return;
    fetchJSONRetry({ action: ISSUE_CFG.actions.routeNotCivil, id: id, token: issueToken() || '' }).then(function (d) {
      if (d && d.error === 'Unknown action') {
        throw new Error('Server not updated yet. Paste the latest empire-all-in-one.gs into Apps Script and deploy a new web app version.');
      }
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Could not route issue');
      }
      var it = allIssues.find(function (x) { return x.id === id; });
      if (it) it.disposition = routedDisposition();
      writeIssuesCacheAsync(allIssues);
      closeIssueModal();
      refreshAllIssueTabs();
      switchTabTo('notcivil');
      uiAlert('\u2705 ' + issueUi_('routeSuccess', 'Issue moved to Not Civil Department.'));
    }).catch(function (e) { uiAlert('\u274c ' + (e.message || 'Could not route issue')); });
  });
}
function restoreCivilIssue(id) {
  uiConfirm(issueUi_('restoreConfirm', 'Restore this issue to the Civil queue?')).then(function (ok) {
    if (!ok) return;
    fetchJSONRetry({ action: ISSUE_CFG.actions.restoreCivil, id: id, token: issueToken() || '' }).then(function (d) {
      if (d && d.error === 'Unknown action') {
        throw new Error('Server not updated yet. Paste the latest empire-all-in-one.gs into Apps Script and deploy a new web app version.');
      }
      if (d && d.ok === false) {
        if (empireAuthHandleInvalidSession_(d, issueSessionLogoutOpts())) return;
        throw new Error(d.message || d.error || 'Could not restore issue');
      }
      var it = allIssues.find(function (x) { return x.id === id; });
      if (it) it.disposition = '';
      writeIssuesCacheAsync(allIssues);
      closeIssueModal();
      refreshAllIssueTabs();
      uiAlert('\u2705 ' + issueUi_('restoreSuccess', 'Issue restored to Civil queue.'));
    }).catch(function (e) { uiAlert('\u274c ' + (e.message || 'Could not restore issue')); });
  });
}
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
function issueDisplayDate(r) {
  return dateOnly((r && (r.date || r.createdAt)) || '');
}
function issueReportDate(r) {
  return dayOf(r);
}
function compareIssuesNewestFirst(a, b) {
  var c = issueReportDate(b).localeCompare(issueReportDate(a));
  if (c !== 0) return c;
  c = String((b && b.createdAt) || '').replace('T', ' ').localeCompare(String((a && a.createdAt) || '').replace('T', ' '));
  if (c !== 0) return c;
  return (Number(b.num) || 0) - (Number(a.num) || 0);
}

function getIssueViewMode(){ try{ return localStorage.getItem(ISSUE_VIEW_KEY)==='grid'?'grid':'table'; }catch(e){ return 'table'; } }
function setIssueViewMode(m){ try{ localStorage.setItem(ISSUE_VIEW_KEY,m); }catch(e){} refreshAllIssueTabs(); }
function issueActionBtns(r, listMode) {
  listMode = listMode || 'civil';
  var h = '<button type="button" onclick="event.stopPropagation();shareIssueWhatsApp(\'' + r.id + '\')" title="Share on WhatsApp" style="background:#25D366;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">' + whatsappIconHtml() + '</button>';
  if (listMode === 'routed') {
    if (PAGEPERMS.edit !== false && ISSUE_CFG.actions && ISSUE_CFG.actions.restoreCivil) {
      h += '<button type="button" onclick="event.stopPropagation();restoreCivilIssue(\'' + r.id + '\')" title="' + issueUi_('restoreButton', 'Restore to Civil queue') + '" style="background:#1d9e75;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">' + restoreCivilIconHtml() + '</button>';
    }
    if (PAGEPERMS.del !== false) {
      h += '<button type="button" onclick="event.stopPropagation();removeIssue(\'' + r.id + '\')" title="Delete issue" style="background:#C5504F;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;">' + trashIconHtml() + '</button>';
    }
    return h;
  }
  if (PAGEPERMS.edit !== false) {
    h += '<button type="button" onclick="event.stopPropagation();editIssue(\'' + r.id + '\')" title="Edit issue" style="background:var(--accent2);color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">' + pencilIconHtml() + '</button>';
  }
  if (canRouteIssueAway(r)) {
    h += '<button type="button" onclick="event.stopPropagation();routeIssueNotCivil(\'' + r.id + '\')" title="' + issueUi_('routeButton', 'Not Civil Department') + ' — route elsewhere" style="background:#d68910;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">' + routeAwayIconHtml() + '</button>';
  }
  if (canToggleFixDelay(r)) {
    var delayBg = isIssueFixDelayed(r) ? '#8b939e' : '#c5cad3';
    var delayTitle = isIssueFixDelayed(r) ? 'Needs 1+ month — click to remove delay mark' : 'Needs 1+ month to fix — mark as delayed';
    h += '<button type="button" onclick="event.stopPropagation();toggleIssueFixDelay(\'' + r.id + '\')" title="' + delayTitle + '" style="background:' + delayBg + ';color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;margin-right:6px;">' + fixDelayIconHtml() + '</button>';
  }
  if (PAGEPERMS.del !== false) {
    h += '<button type="button" onclick="event.stopPropagation();removeIssue(\'' + r.id + '\')" title="Delete issue" style="background:#C5504F;color:#fff;border:none;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:none;">' + trashIconHtml() + '</button>';
  }
  return h;
}
function viewToggleHtml(){ var v=getIssueViewMode(); return '<div class="view-toggle"><button type="button" class="view-toggle-btn'+(v==='table'?' active':'')+'" onclick="setIssueViewMode(\'table\')" title="Table view" aria-label="Table view"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg></button><button type="button" class="view-toggle-btn'+(v==='grid'?' active':'')+'" onclick="setIssueViewMode(\'grid\')" title="Grid view" aria-label="Grid view"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button></div>'; }
function renderIssueListHtml(rows, listMode) {
  if (!rows.length) return '';
  var view = getIssueViewMode();
  var h = '';
  if (view === 'grid') {
    h += '<div class="issue-grid' + (listMode === 'routed' ? ' issue-grid-routed' : '') + '">';
    rows.forEach(function (r) {
      var sel = !!selectedIssueIds[r.id];
      var cardClick = issueSelectMode ? "toggleIssueSelected('" + r.id + "')" : "openIssue('" + r.id + "')";
      h += '<div class="issue-card' + (sel ? ' selected' : '') + (issueSelectMode ? ' selecting' : '') + (listMode === 'routed' ? ' issue-card-routed' : '') + (isIssueFixDelayed(r) && r.status !== 'fixed' && (listMode === 'civil' || listMode === 'delayed') ? ' issue-card-delayed' : '') + '" onclick="' + cardClick + '">';
      if (issueSelectMode) {
        h += '<div class="issue-card-check" onclick="event.stopPropagation()"><input type="checkbox"' + (sel ? ' checked' : '') + ' onclick="event.stopPropagation();toggleIssueSelected(\'' + r.id + '\')" aria-label="Select issue"></div>';
      }
      h += (r.photo ? '<img class="issue-card-photo" src="' + r.photo + '" loading="lazy" alt="">' : '<div class="issue-card-photo issue-card-nophoto">No photo</div>');
      h += '<div class="issue-card-body"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;"><span style="color:var(--text-faint);font-weight:700;">#' + issueRef(r.num) + '</span>' + issueStatusBadgeHtml(r) + '</div>';
      h += '<div style="font-weight:600;line-height:1.35;margin-bottom:6px;">' + r.issueType + tradeBadgeHtml(r) + workersBadgeHtml(r) + workersCompletedSummaryHtml(r) + (r.note ? ' <span style="color:var(--text-faint);font-weight:400;">(' + r.note + ')</span>' : '') + '</div>';
      h += '<div style="color:var(--text-soft);font-size:13px;margin-bottom:4px;">' + locStr(r) + '</div>';
      h += '<div style="color:var(--text-faint);font-size:12px;margin-bottom:10px;">' + issueDisplayDate(r) + workersCompletedSummaryHtml(r) + issueFixGpsCardHtml(r) + '</div>';
      if (!issueSelectMode) h += '<div style="text-align:right;" onclick="event.stopPropagation()">' + issueActionBtns(r, listMode) + '</div>';
      h += '</div></div>';
    });
    h += '</div>';
    return h;
  }
  var teamTh = tradeGroups().length ? '<th>Team</th>' : '';
  h += '<table><thead><tr>' + (issueSelectMode ? '<th style="width:36px;"></th>' : '') + '<th>#</th><th>Issue</th><th>Location</th>' + teamTh + '<th>Date</th><th>Status</th><th>Photo</th>' + (issueSelectMode ? '' : '<th></th>') + '</tr></thead><tbody>';
  rows.forEach(function (r) {
    var sel = !!selectedIssueIds[r.id];
    var rowClick = issueSelectMode ? "toggleIssueSelected('" + r.id + "')" : "openIssue('" + r.id + "')";
    h += '<tr class="issue-row' + (sel ? ' selected' : '') + (listMode === 'routed' ? ' issue-row-routed' : '') + (isIssueFixDelayed(r) && r.status !== 'fixed' && (listMode === 'civil' || listMode === 'delayed') ? ' issue-row-delayed' : '') + '" onclick="' + rowClick + '"' + (sel ? ' style="background:var(--row-hover);"' : '') + '>';
    if (issueSelectMode) h += '<td onclick="event.stopPropagation()"><input type="checkbox"' + (sel ? ' checked' : '') + ' onclick="event.stopPropagation();toggleIssueSelected(\'' + r.id + '\')" aria-label="Select issue"></td>';
    h += '<td style="color:var(--text-faint);font-weight:700;white-space:nowrap;">#' + issueRef(r.num) + '</td><td>' + r.issueType + tradeBadgeHtml(r) + workersBadgeHtml(r) + workersCompletedSummaryHtml(r) + (r.note ? ' <span style="color:var(--text-faint);">(' + r.note + ')</span>' : '') + '</td><td>' + locStr(r) + '</td>';
    if (tradeGroups().length) h += '<td>' + (assignedWorkersDisplay(r) || tradeGroupLabel(r.assignedGroup) || 'Unassigned') + '</td>';
    h += '<td>' + issueDisplayDate(r) + issueFixGpsCardHtml(r) + '</td><td>' + issueStatusBadgeHtml(r) + '</td><td>' + (r.photo ? '<img class="thumb" src="' + r.photo + '" loading="lazy">' : '?') + '</td>';
    if (!issueSelectMode) h += '<td>' + issueActionBtns(r, listMode) + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table>';
  return h;
}
function renderIssues() {
  if (isCivilWorker()) { renderWorkerJobs(); return; }
  var fp = document.getElementById('f-project').value;
  var fs = document.getElementById('f-status').value;
  var fm = (document.getElementById('f-month') || {}).value || '';
  var fg = (document.getElementById('f-group') || {}).value || '';
  var q = (document.getElementById('f-search').value || '').toLowerCase();
  var matched = allIssues.filter(function (r) { return issueMatchesIssueFilters(r, fp, fs, fm, fg, q); });
  var rows = matched.filter(function (r) { return !issueIsRoutedAway(r); });
  rows.sort(compareIssuesNewestFirst);
  window._visibleIssueIds = rows.map(function (r) { return r.id; });
  var oc = rows.filter(function (r) { return r.status !== 'fixed'; }).length;
  var fc = rows.length - oc;
  var openAll = allIssues.filter(function (r) { return r.status !== 'fixed' && !issueIsRoutedAway(r); });
  var unAssign = openAll.filter(function (r) { return isIssueUnassigned(r); }).length;
  var teamBits = '';
  if (tradeGroups().length) teamBits = ' &nbsp;&mdash;&nbsp; <span class="issues-unassigned-count">' + unAssign + ' unassigned</span>';
  var routedTotal = countRoutedAwayIssues();
  if (routedTotal && civilNotCivilTabEnabled()) {
    teamBits += ' &nbsp;&mdash;&nbsp; <span style="color:#d68910;">' + routedTotal + ' ' + issueUi_('routedCountLabel', 'in Not Civil Dept') + '</span>';
  }
  var delayedCount = openAll.filter(function (r) { return isIssueFixDelayed(r); }).length;
  if (delayedCount && ISSUE_CFG.actions && ISSUE_CFG.actions.setFixDelay) {
    teamBits += ' &nbsp;&mdash;&nbsp; <span style="color:#8b939e;">' + delayedCount + ' need 1+ month</span>';
  }
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;"><p style="color:var(--text-soft);margin:0;">' + rows.length + ' issue(s)' + (fm ? (' in ' + fm) : '') + ' &nbsp;&mdash;&nbsp; <span style="color:var(--open-color);">' + squareIconHtml('var(--open-color)') + ' ' + oc + ' open</span> &nbsp;&mdash;&nbsp; <span style="color:#1d9e75;">' + checkIconHtml('#1d9e75') + ' ' + fc + ' fixed</span>' + teamBits + '</p>' + viewToggleHtml() + '</div>' + issueSelectToolbarHtml();
  if (rows.length === 0) h += '<p style="color:var(--text-faint);">' + issueUi_('emptyIssues', 'No civil issues match.') + '</p>';
  else h += renderIssueListHtml(rows, 'civil');
  document.getElementById('issuesTable').innerHTML = h;
  updateNotCivilNavBadge();
  updateFixDelayNavBadge();
}
function renderFixDelayIssues() {
  if (isCivilWorker() || !civilFixDelayTabEnabled()) return;
  var host = document.getElementById('issuesFixDelayTable');
  if (!host) return;
  var fp = (document.getElementById('f-fd-project') || {}).value || '';
  var q = ((document.getElementById('f-fd-search') || {}).value || '').toLowerCase();
  var rows = allIssues.filter(function (r) {
    if (!isIssueFixDelayed(r) || issueIsRoutedAway(r)) return false;
    if (fp && r.project !== fp) return false;
    return issueMatchesIssueFilters(r, '', '', '', '', q);
  });
  rows.sort(compareIssuesNewestFirst);
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;"><p style="color:var(--text-soft);margin:0;">' + rows.length + ' issue(s) needing 1+ month to fix</p>' + viewToggleHtml() + '</div>';
  if (!rows.length) {
    h += '<p style="color:var(--text-faint);">No delayed issues yet. Use the clock button on a civil issue card to mark issues that cannot be fixed soon.</p>';
  } else {
    h += renderIssueListHtml(rows, 'delayed');
  }
  host.innerHTML = h;
  updateFixDelayNavBadge();
}
function renderRoutedIssues() {
  if (isCivilWorker() || !civilNotCivilTabEnabled()) return;
  var host = document.getElementById('issuesNotCivilTable');
  if (!host) return;
  var fp = (document.getElementById('f-nc-project') || {}).value || '';
  var q = ((document.getElementById('f-nc-search') || {}).value || '').toLowerCase();
  var rows = allIssues.filter(function (r) {
    if (!issueIsRoutedAway(r)) return false;
    if (fp && r.project !== fp) return false;
    return issueMatchesIssueFilters(r, '', '', '', '', q);
  });
  rows.sort(compareIssuesNewestFirst);
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;"><p style="color:var(--text-soft);margin:0;">' + rows.length + ' ' + issueUi_('routedListSummary', 'issue(s) routed away from Civil') + '</p>' + viewToggleHtml() + '</div>';
  if (!rows.length) {
    h += '<p style="color:var(--text-faint);">' + issueUi_('routedListEmpty', 'No issues here yet. Use the orange button on a civil issue card to move misfiled reports here.') + '</p>';
  } else {
    h += renderIssueListHtml(rows, 'routed');
  }
  host.innerHTML = h;
  updateNotCivilNavBadge();
}
function durationStr(a,b){ if(!a||!b) return ''; const pr=s=>new Date(String(s).replace(' ','T')); const d1=pr(a), d2=pr(b); if(isNaN(d1.getTime())||isNaN(d2.getTime())) return ''; let ms=d2-d1; if(ms<0) return ''; const days=Math.floor(ms/86400000); const hrs=Math.floor((ms%86400000)/3600000); const mins=Math.floor((ms%3600000)/60000); let parts=[]; if(days)parts.push(days+'d'); if(hrs)parts.push(hrs+'h'); if(!days&&!hrs)parts.push(mins+'m'); return ' \u2014 took '+parts.join(' '); }
function assignBoxHtml(r) {
  if (!tradeGroups().length || PAGEPERMS.assign === false || !civilWorkersRoster()) return '';
  var selected = assignedWorkersList(r);
  var assigned = isIssueAssigned(r);
  var editing = isAssignEditMode(r.id);
  var locked = assigned && !editing;
  var h = '<div class="assign-box' + (locked ? ' assign-box-locked' : '') + '" onclick="event.stopPropagation()">';
  if (locked) {
    h += '<div class="assign-locked-header">';
    h += '<span class="assign-assigned-badge">' + checkIconHtml('#fff') + ' Assigned</span>';
    h += '<button type="button" class="assign-edit-btn" onclick="enterAssignEditMode(\'' + r.id + '\')">Edit</button>';
    h += '</div>';
    h += '<p class="assign-locked-summary"><strong>Worker(s):</strong> ' + (assignedWorkersDisplay(r) || tradeGroupLabel(r.assignedGroup)) + '</p>';
    if (issueWorkersRequired(r) > 1) {
      h += '<p class="assign-locked-summary">Each worker must submit photos before this job is complete.</p>';
    }
  } else {
    h += '<label>Assign worker(s) — up to ' + maxAssignWorkers() + '. If you pick more than one, <strong>each</strong> must submit photos before the job is complete.</label>';
  }
  h += '<div class="assign-box-body' + (locked ? ' assign-box-body-locked' : '') + '">';
  h += assignWorkersPickerHtml(selected, 'assign-worker-cb', r.id, locked);
  if (typeof assignVoiceBoxHtml === 'function') h += assignVoiceBoxHtml(r.id, r.assignVoiceNote, { locked: locked });
  h += '</div>';
  if (!locked) {
    h += '<div class="assign-row assign-save-row">';
    if (assigned && editing) {
      h += '<button type="button" class="assign-cancel-btn" onclick="exitAssignEditMode(\'' + r.id + '\')">Cancel</button>';
    }
    h += '<button type="button" id="assign-btn-' + r.id + '" class="assign-save-btn" onclick="assignIssue(\'' + r.id + '\')">' + (assigned && editing ? 'Update assignment' : 'Save assignment') + '</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}
function openIssue(id) {
  const r = allIssues.find(x => x.id === id);
  if (!r) return;
  delete _assignEditMode[id];
  if (isCivilWorker() && r.status !== 'fixed') { closeIssueModal(); openWorkerJob(id); return; }
  let h = '<span class="close-x" onclick="closeIssueModal()">&times;</span>';
  h += issueDetailMetaSectionHtml(r);
  if (issueIsRoutedAway(r)) {
    h += '<div class="routed-away-banner"><strong>' + issueUi_('notDeptPageTitle', 'Not Civil Department') + '</strong> — this issue was routed out of the ' + issueUi_('deptShortName', 'Civil') + ' queue. Re-create it in the correct department.</div>';
  }
  if (isIssueFixDelayed(r) && r.status !== 'fixed' && !issueIsRoutedAway(r)) {
    h += '<div class="fix-delayed-banner"><strong>Needs 1+ month</strong> — this issue cannot be fixed soon. The card is marked silver until the delay is removed.</div>';
  }
  if (r.status !== 'fixed' && !issueIsRoutedAway(r)) h += assignBoxHtml(r);
  h += workerCompletionsBlockHtml(r);
  if (r.status === 'fixed' && typeof window.issueMonthlyTransferBlockHtml === 'function') {
    h += window.issueMonthlyTransferBlockHtml(r);
  }
  h += '<div style="margin:12px 0 4px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">';
  h += '<button type="button" onclick="shareIssueWhatsApp(\'' + r.id + '\')" style="background:#25D366;color:#fff;border:none;padding:10px 16px;border-radius:50px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;box-shadow:none;">' + whatsappIconHtml() + ' Share on WhatsApp</button>';
  if (canRouteIssueAway(r)) {
    h += '<button type="button" onclick="routeIssueNotCivil(\'' + r.id + '\')" class="route-not-civil-btn">' + routeAwayIconHtml() + ' ' + issueUi_('routeButton', 'Not Civil Department') + '</button>';
  }
  if (canToggleFixDelay(r)) {
    h += '<button type="button" onclick="toggleIssueFixDelay(\'' + r.id + '\')" class="fix-delay-btn' + (isIssueFixDelayed(r) ? ' active' : '') + '">' + fixDelayIconHtml() + (isIssueFixDelayed(r) ? ' Remove 1+ month mark' : ' Needs 1+ month') + '</button>';
  }
  if (issueIsRoutedAway(r) && PAGEPERMS.edit !== false && ISSUE_CFG.actions && ISSUE_CFG.actions.restoreCivil) {
    h += '<button type="button" onclick="restoreCivilIssue(\'' + r.id + '\')" class="restore-civil-btn">' + restoreCivilIconHtml() + ' ' + issueUi_('restoreButton', 'Restore to Civil queue') + '</button>';
  }
  h += '</div>';
  h += issuePhotosSectionHtml(r);
  if (r.status !== 'fixed' && canMarkIssueFixed() && !issueIsRoutedAway(r)) {
    if (ISSUE_CFG.requireFixByName) {
      h += '<div style="margin:14px 0 4px;"><label style="font-weight:600;display:block;margin-bottom:6px;">Job was done by:</label><input type="text" id="fix-by" placeholder="Enter the name of who did the job" style="width:100%;max-width:340px;padding:10px;border:2px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:14px;box-sizing:border-box;"></div>';
    }
    h += '<h3>' + checkIconHtml() + ' Mark as fixed</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;"><button type="button" onclick="document.getElementById(\'fix-file\').click()"><span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/><circle cx="14" cy="15" r="1"/></svg></span> Upload / Camera</button><span style="color:var(--text-soft);font-size:13px;">? or paste below ?</span><input type="file" id="fix-file" accept="image/*" style="display:none" onchange="handleFixFile(event,\'' + r.id + '\')"></div><div class="image-upload" id="fix-area" onpaste="pasteFix(event,\'' + r.id + '\')">Click here and paste the photo of the completed fix (Ctrl+V)</div>';
  }
  document.getElementById('issueBox').innerHTML = h;
  if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(document.getElementById('issueBox'));
  document.getElementById('issueModal').classList.add('show');
}
function closeIssueModal(){
  if (typeof assignVoiceOnModalClose_ === 'function') assignVoiceOnModalClose_();
  document.getElementById('issueModal').classList.remove('show');
}
function processFix(id, file){ if(!file) return; var by=''; if(ISSUE_CFG.requireFixByName){ const byEl=document.getElementById('fix-by'); by=byEl?byEl.value.trim():''; if(!by){ alert('Please enter who did the job first ("Job was done by")'); if(byEl)byEl.focus(); return; } } const area=document.getElementById('fix-area'); if(area) area.innerHTML='\u23F3 Uploading\u2026'; compressImage(file,url=>{ if(url){ var payload={action:ISSUE_CFG.actions.markFixed,id:id,fixedPhoto:url,token:issueToken()||''}; if(ISSUE_CFG.requireFixByName) payload.fixedByName=by; fetchJSONRetry(payload).then(()=>{ const it=allIssues.find(x=>x.id===id); if(it){ it.status='fixed'; it.fixedPhoto=url; const now=new Date(); const z=n=>String(n).padStart(2,'0'); it.fixedAt=now.getFullYear()+'-'+z(now.getMonth()+1)+'-'+z(now.getDate())+' '+z(now.getHours())+':'+z(now.getMinutes()); it.fixedBy=by||empireGetUser()||''; } renderIssues(); renderAnalytics(); openIssue(id); }).catch(er=>{ if(area) area.innerHTML='\u274C '+er.message; }); } else { if(area) area.innerHTML='\u274C Upload failed, try again'; } }); }
function pasteFix(e,id){ const items=e.clipboardData.items; for(let i=0;i<items.length;i++){ if(items[i].type.indexOf('image')!==-1){ e.preventDefault(); processFix(id, items[i].getAsFile()); return; } } }
function handleFixFile(e,id){ const f=e.target.files && e.target.files[0]; if(f) processFix(id, f); e.target.value=''; }
function bigImg(src){ document.getElementById('imgBig').src=src; document.getElementById('imgModal').classList.add('show'); }
function closeImg(){ document.getElementById('imgModal').classList.remove('show'); }
function donutHtml(open,fixed,total){ if(total===0) return '<p style="color:var(--text-faint);margin:8px 0 18px;">No issues yet.</p>'; var fp=fixed/total*100, op=open/total*100; return '<div style="display:flex;align-items:center;gap:30px;flex-wrap:wrap;margin:10px 0 22px;"><svg width="180" height="180" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="5"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27ae60" stroke-width="5" stroke-dasharray="'+fp+' '+(100-fp)+'" stroke-dashoffset="25"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" style="stroke:var(--open-color)" stroke-width="5" stroke-dasharray="'+op+' '+(100-op)+'" stroke-dashoffset="'+(25-fp)+'"></circle><text x="21" y="20.5" text-anchor="middle" style="font-size:7px;fill:var(--text);font-weight:700;">'+total+'</text><text x="21" y="26" text-anchor="middle" style="font-size:3.2px;fill:var(--text-soft);">issues</text></svg><div style="font-size:15px;line-height:2.1;"><div><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#27ae60;margin-right:9px;vertical-align:middle;"></span>Fixed &mdash; <strong>'+fixed+'</strong> ('+Math.round(fp)+'%)</div><div><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:var(--open-color);margin-right:9px;vertical-align:middle;"></span>Open &mdash; <strong>'+open+'</strong> ('+Math.round(op)+'%)</div></div></div>'; }
function miniDonutHtml(name,open,fixed){ var total=open+fixed; var fp=total?fixed/total*100:0, op=total?open/total*100:0; var ring = total ? '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="6"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27ae60" stroke-width="6" stroke-dasharray="'+fp+' '+(100-fp)+'" stroke-dashoffset="25"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" style="stroke:var(--open-color)" stroke-width="6" stroke-dasharray="'+op+' '+(100-op)+'" stroke-dashoffset="'+(25-fp)+'"></circle>' : '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--donut-track)" stroke-width="6"></circle>'; return '<div style="text-align:center;width:118px;"><svg width="96" height="96" viewBox="0 0 42 42">'+ring+'<text x="21" y="24" text-anchor="middle" style="font-size:10px;fill:var(--text);font-weight:700;">'+total+'</text></svg><div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px;line-height:1.25;">'+name+'</div><div style="font-size:11px;color:var(--text-soft);margin-top:2px;"><span style="color:var(--open-color);">'+open+' open</span> &middot; <span style="color:#1d9e75;">'+fixed+' fixed</span></div></div>'; }
function initRepMonth(){ var mm=document.getElementById('rep-month-m'); var ym=document.getElementById('rep-month-y'); if(mm && mm.options.length<=1){ var names=['January','February','March','April','May','June','July','August','September','October','November','December']; for(var i=0;i<12;i++){ var o=document.createElement('option'); o.value=String(i+1).padStart(2,'0'); o.textContent=names[i]; mm.appendChild(o); } } if(ym && ym.options.length<=1){ var cy=new Date().getFullYear(); for(var y=cy+1;y>=cy-3;y--){ var o2=document.createElement('option'); o2.value=String(y); o2.textContent=String(y); ym.appendChild(o2); } } }
function syncRepMonth(){ var y=(document.getElementById('rep-month-y')||{}).value||''; var m=(document.getElementById('rep-month-m')||{}).value||''; var h=document.getElementById('rep-month'); if(h) h.value=(y&&m)?(y+'-'+m):''; }
function renderAnalytics(){ const queue=allIssues.filter(function(r){ return !issueIsRoutedAway(r); }); const total=queue.length; const open=queue.filter(r=>r.status!=='fixed').length; const fixed=total-open; let h='<div class="stats"><div class="stat-box"><div class="stat-value">'+total+'</div><div class="stat-label">Total Issues</div></div><div class="stat-box"><div class="stat-value" style="color:var(--open-color);">'+open+'</div><div class="stat-label">Open</div></div><div class="stat-box"><div class="stat-value" style="color:#27ae60;">'+fixed+'</div><div class="stat-label">Fixed</div></div></div>'; h+='<h3>Open vs Fixed</h3><div style="display:flex;flex-wrap:wrap;gap:26px;align-items:center;margin:10px 0 22px;">'+donutHtml(open,fixed,total)+'<div style="display:flex;flex-wrap:wrap;gap:12px;">'+['ec','es','wd','ww','ra'].map(function(p){ var pr=queue.filter(function(r){return r.project===p;}); var o=pr.filter(function(r){return r.status!=='fixed';}).length; return miniDonutHtml(projectNames[p],o,pr.length-o); }).join('')+'</div></div>'; var colg='<colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>'; h+='<h3>By Project</h3><table style="table-layout:fixed;width:100%;">'+colg+'<thead><tr><th>Project</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; ['ec','es','wd','ww','ra'].forEach(p=>{ const pr=queue.filter(r=>r.project===p); if(pr.length===0)return; const o=pr.filter(r=>r.status!=='fixed').length; h+='<tr><td>'+projectNames[p]+'</td><td style="color:var(--open-color);">'+o+'</td><td style="color:#1d9e75;">'+(pr.length-o)+'</td><td>'+pr.length+'</td></tr>'; }); h+='</tbody></table>'; const types={}; queue.forEach(r=>{ const t=r.issueType; if(!types[t]) types[t]={open:0,fixed:0}; if(r.status==='fixed') types[t].fixed++; else types[t].open++; }); h+='<h3>By Issue Type</h3><table style="table-layout:fixed;width:100%;">'+colg+'<thead><tr><th>Type</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; Object.keys(types).sort((a,b)=>(types[b].open+types[b].fixed)-(types[a].open+types[a].fixed)).forEach(t=>{ const o=types[t].open,f=types[t].fixed; h+='<tr><td>'+t+'</td><td style="color:var(--open-color);">'+o+'</td><td style="color:#1d9e75;">'+f+'</td><td>'+(o+f)+'</td></tr>'; }); h+='</tbody></table>'; var ac=issueAnalyticsContentEl(); if(ac) ac.innerHTML=h; }
function switchTab(e,t){ issueTabPanes().forEach(x=>x.classList.remove('active')); issueTabBtns().forEach(x=>x.classList.remove('active')); document.getElementById(t).classList.add('active'); e.target.classList.add('active'); empireSaveActiveTab(ISSUE_CFG.prefix+'_active_tab', t); if(t==='add'){ window._editingId=null; var eb=document.getElementById('editBanner'); if(eb) eb.style.display='none'; } if(t==='analytics') renderAnalytics(); if(t==='notcivil') renderRoutedIssues(); if(t==='fixdelay') renderFixDelayIssues(); if(t==='gps'){ loadWorkerLocations(false); startEngineerLocationPoll(); } else stopEngineerLocationPoll(); }
function switchTabTo(t){ issueTabPanes().forEach(x=>x.classList.remove('active')); issueTabBtns().forEach(x=>x.classList.remove('active')); document.getElementById(t).classList.add('active'); issueTabBtns().forEach(b=>{ var o=b.getAttribute('onclick')||''; if(o.indexOf("'"+t+"'")!==-1) b.classList.add('active'); }); if(t==='analytics') renderAnalytics(); if(t==='notcivil') renderRoutedIssues(); if(t==='fixdelay') renderFixDelayIssues(); if(t==='gps'){ loadWorkerLocations(false); startEngineerLocationPoll(); } else stopEngineerLocationPoll(); }
function enterApp(){ document.body.classList.remove('civil-worker-mode'); document.getElementById('loginPage').classList.remove('show'); if(typeof empireAuthMarkLoginVisible==='function') empireAuthMarkLoginVisible(false); var wa=document.getElementById('workerApp'); if(wa) wa.classList.remove('show'); stopWorkerLocationPing(); document.getElementById('mainContainer').classList.add('show'); applyPerms(); refreshPerms(); populateSelect('ci-project',['ec','es','wd','ww','ra'],true); updateCIBuildings(); populateSelect('ci-spot',spots,false); populateSelect('ci-issuetype',issueTypes,false); const fp=document.getElementById('f-project'); if(fp && fp.options.length<=1){ ['ec','es','wd','ww','ra'].forEach(p=>{ const o=document.createElement('option'); o.value=p;o.textContent=projectNames[p]; fp.appendChild(o); }); } const fnc=document.getElementById('f-nc-project'); if(fnc && fnc.options.length<=1){ ['ec','es','wd','ww','ra'].forEach(p=>{ const o=document.createElement('option'); o.value=p;o.textContent=projectNames[p]; fnc.appendChild(o); }); } const ffd=document.getElementById('f-fd-project'); if(ffd && ffd.options.length<=1){ ['ec','es','wd','ww','ra'].forEach(p=>{ const o=document.createElement('option'); o.value=p;o.textContent=projectNames[p]; ffd.appendChild(o); }); } initTradeFilters(); window._issueFilterState=empireBindFilterPersistence({ key:ISSUE_CFG.prefix+'_list_filters', fields:['f-project','f-group','f-status','f-month','f-search'], onApply:function(){ renderIssues(); } }); initRepMonth(); document.getElementById('ci-date').value=empireLocalDateIso(); if(!ISSUE_CFG.embeddedInDept){ var tab=empireRestoreActiveTab(ISSUE_CFG.prefix+'_active_tab','list'); switchTabTo(tab); if(tab==='analytics') renderAnalytics(); } setTimeout(function(){ loadIssues(false); },0); syncWorkerLocationsUi(); }
var _lastPermFetch=0;
function refreshPerms(){ var tk=issueToken(); if(!tk) return; var now=Date.now(); if(now-_lastPermFetch<300000) return; _lastPermFetch=now; empireAuthRefreshPerms(function(d){ PAGEPERMS=d.perms||empireGetPerms(); applyPerms(); }); }
function bootApp(){ empireAuthPageBoot({ dept: ISSUE_CFG.dept, sendToHomeLogin: false, onEnter: function(){ syncWorkerRoleThenRoute_(); } }); }
if (!ISSUE_CFG.embeddedInDept) {
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bootApp); else bootApp();
}
window.loadIssues = loadIssues;
window.renderIssueAnalytics = renderAnalytics;
window.getAllIssues = function(){ return allIssues; };
// ===== Reset Data (password) =====
function issueResetPwEl(){ return document.getElementById(ISSUE_CFG.embeddedInDept ? 'issueResetPwInput' : 'resetPwInput'); }
function issueResetMsgEl(){ return document.getElementById(ISSUE_CFG.embeddedInDept ? 'issueResetMsg' : 'resetMsg'); }
function issueResetModalEl(){ return document.getElementById(ISSUE_CFG.embeddedInDept ? 'issueResetModal' : 'resetModal'); }
function openIssueResetModal(){ var pw=issueResetPwEl(), msg=issueResetMsgEl(), modal=issueResetModalEl(); if(!pw||!msg||!modal) return; pw.value=''; msg.textContent=''; modal.style.display='flex'; setTimeout(function(){ pw.focus(); },30); }
function closeIssueResetModal(){ var modal=issueResetModalEl(); if(modal) modal.style.display='none'; }
function doIssueReset(){ var pwEl=issueResetPwEl(), msg=issueResetMsgEl(); if(!pwEl||!msg) return; var pw=pwEl.value; if(!pw){ msg.style.color='#C5504F'; msg.textContent='Please enter the password.'; return; } msg.style.color='var(--text-soft)'; msg.textContent='\u23F3 Deleting\u2026'; fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:ISSUE_CFG.actions.clear, resetPassword:pw, dept:ISSUE_CFG.dept, token:issueToken()||''})}).then(r=>r.json()).then(function(d){ if(d&&d.success){ closeIssueResetModal(); allIssues=[]; renderIssues(); renderAnalytics(); uiAlert('\u2705 '+ISSUE_CFG.resetSuccessMsg); } else if(d&&d.error==='bad_password'){ msg.style.color='#C5504F'; msg.textContent='\u274C Wrong password.'; } else if(d&&d.ok===false){ forceSessionLogout(d); } else if(d&&d.error==='not_allowed'){ msg.style.color='#C5504F'; msg.textContent='\u274C Only an admin can reset data.'; } else { msg.style.color='#C5504F'; msg.textContent='\u274C Could not reset. Try again.'; } }).catch(function(e){ msg.style.color='#C5504F'; msg.textContent='? '+e.message; }); }
if (!ISSUE_CFG.embeddedInDept) {
  window.openResetModal = openIssueResetModal;
  window.closeResetModal = closeIssueResetModal;
  window.doReset = doIssueReset;
} else {
  window.issueEnterApp = enterApp;
}
// ===== Download Civil Issues Report (standalone offline HTML, photos embedded) =====
function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function urlToDataURI(url){ return fetch(url,{mode:'cors'}).then(function(r){return r.blob();}).then(function(blob){ return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){res(fr.result);}; fr.onerror=function(){res(url);}; fr.readAsDataURL(blob); }); }).catch(function(){ return url; }); }
function _box(v,l){ return '<div class="box"><div class="bv">'+v+'</div><div class="bl">'+l+'</div></div>'; }
async function downloadIssueReport(){ const rm=(document.getElementById('rep-month')||{}).value||''; let issues=allIssues.slice(); if(rm) issues=issues.filter(function(r){ return monthOf(r)===rm; }); if(issues.length===0){ uiAlert('No issues to report'+(rm?(' for '+rm):'')+'.'); return; } const btn=document.getElementById(ISSUE_CFG.reportBtnId); const orig=btn?btn.textContent:''; const urls=new Set(); issues.forEach(function(r){ if(r.photo)urls.add(r.photo); issueFixedPhotos(r).forEach(function(u){ urls.add(u); }); }); const list=[...urls]; const map={}; let done=0; if(btn){ btn.disabled=true; btn.textContent='\u23F3 Embedding photos 0/'+list.length; } await Promise.all(list.map(function(u){ return urlToDataURI(u).then(function(d){ map[u]=d; done++; if(btn) btn.textContent='\u23F3 Embedding photos '+done+'/'+list.length; }); })); const html=buildIssueReportHtml(issues,map,rm); const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=ISSUE_CFG.reportFilePrefix+(rm||'all')+'.html'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); },4000); if(btn){ btn.disabled=false; btn.textContent=orig; } }
function buildIssueReportHtml(issues,map,rm){ var logo=''; var le=document.querySelector('img[alt="Empire World"]'); if(le) logo=le.src; var total=issues.length; var open=issues.filter(function(r){return r.status!=='fixed';}).length; var fixed=total-open; var gen=new Date().toLocaleString('en-US'); var monthLabel=rm?rm:'All time'; var fp=total?fixed/total*100:0, op=total?open/total*100:0; var donut=total?('<svg width="160" height="160" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(0,0,0,0.08)" stroke-width="5"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27ae60" stroke-width="5" stroke-dasharray="'+fp+' '+(100-fp)+'" stroke-dashoffset="25"></circle><circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#C5504F" stroke-width="5" stroke-dasharray="'+op+' '+(100-op)+'" stroke-dashoffset="'+(25-fp)+'"></circle><text x="21" y="20.5" text-anchor="middle" style="font-size:7px;fill:#232a3d;font-weight:700;">'+total+'</text><text x="21" y="26" text-anchor="middle" style="font-size:3.2px;fill:#5b6478;">issues</text></svg>'):''; var b='<div class="hd">'+(logo?'<img class="logo" src="'+logo+'">':'')+'<div><h1>'+ISSUE_CFG.reportTitle+'</h1><div class="sub">'+_esc(monthLabel)+' \u00B7 Generated '+_esc(gen)+'</div><div class="sub">Prepared by Swar Dizayee</div></div></div>'; b+='<div style="display:flex;align-items:center;gap:30px;flex-wrap:wrap;">'+donut+'<div class="stats" style="flex:1;">'+_box(total,'Total')+_box(open,'Open')+_box(fixed,'Fixed')+'</div></div>'; b+='<h2>By Project</h2><table><thead><tr><th>Project</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; ['ec','es','wd','ww','ra'].forEach(function(p){ var pr=issues.filter(function(r){return r.project===p;}); if(!pr.length)return; var o=pr.filter(function(r){return r.status!=='fixed';}).length; b+='<tr><td>'+_esc(projectNames[p])+'</td><td>'+o+'</td><td>'+(pr.length-o)+'</td><td>'+pr.length+'</td></tr>'; }); b+='</tbody></table>'; var types={}; issues.forEach(function(r){ var t=r.issueType; if(!types[t])types[t]={open:0,fixed:0}; if(r.status==='fixed')types[t].fixed++; else types[t].open++; }); b+='<h2>By Issue Type</h2><table><thead><tr><th>Type</th><th>Open</th><th>Fixed</th><th>Total</th></tr></thead><tbody>'; Object.keys(types).sort(function(a,b2){ return (types[b2].open+types[b2].fixed)-(types[a].open+types[a].fixed); }).forEach(function(t){ var o=types[t].open,f=types[t].fixed; b+='<tr><td>'+_esc(t)+'</td><td>'+o+'</td><td>'+f+'</td><td>'+(o+f)+'</td></tr>'; }); b+='</tbody></table>'; b+='<h2>All Issues ('+total+')</h2>'; var rows=issues.slice().sort(compareIssuesNewestFirst); rows.forEach(function(r){ b+='<div class="issue"><h3>#'+issueRef(r.num)+' '+_esc(r.issueType)+' '+issueStatusBadgeHtml(r)+'</h3>'; b+='<div class="meta"><strong>Location:</strong> '+_esc(locStr(r))+'</div>'; b+='<div class="meta"><strong>'+squareIconHtml()+' Reported:</strong> '+_esc(fmtDT(r.createdAt||r.date||''))+(r.createdBy?(' (by '+_esc(r.createdBy)+')'):'')+'</div>'; if(r.status==='fixed'){ b+='<div class="meta"><strong>'+checkIconHtml()+' Fixed:</strong> '+_esc(fmtDT(r.fixedAt)||'?')+(r.fixedBy?(' (by '+_esc(r.fixedBy)+')'):'')+_esc(durationStr(r.createdAt||r.date, r.fixedAt))+'</div>'; } if(r.note) b+='<div class="meta"><strong>Note:</strong> '+_esc(r.note)+'</div>'; var ph=''; if(r.photo){ var s1=map[r.photo]||r.photo; ph+='<figure><a href="'+s1+'" target="_blank"><img src="'+s1+'"></a><figcaption>Problem</figcaption></figure>'; } if(r.fixedPhoto){ issueFixedPhotos(r).forEach(function(u,idx){ var s2=map[u]||u; var cap=issueFixedPhotos(r).length>1?('Fixed '+(idx+1)):'Fixed'; ph+='<figure><a href="'+s2+'" target="_blank"><img src="'+s2+'"></a><figcaption>'+cap+'</figcaption></figure>'; }); } if(ph) b+='<div class="photos">'+ph+'</div>'; b+='</div>'; }); var css='body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#232a3d;margin:0;padding:24px;}' +'.hd{display:flex;align-items:center;gap:18px;border-bottom:2px solid #8d015d;padding-bottom:16px;margin-bottom:20px;}' +'.hd .logo{height:60px;width:auto;}h1{margin:0;font-size:24px;color:#185fa5;}.sub{color:#5b6478;font-size:13px;margin-top:4px;}' +'h2{color:#232a3d;border-left:4px solid #8d015d;padding-left:10px;margin-top:28px;}' +'.stats{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0;}' +'.box{background:#fff;border:1px solid #efe8ed;border-radius:10px;padding:14px 18px;min-width:110px;text-align:center;flex:1;}' +'.bv{font-size:26px;font-weight:bold;color:#8d015d;}.bl{font-size:12px;color:#5b6478;margin-top:4px;}' +'table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #e6e9f2;padding:8px 10px;text-align:left;font-size:13px;}th{background:#faf6f8;}' +'.issue{background:#fff;border:1px solid #e6e9f2;border-radius:12px;padding:14px 16px;margin:12px 0;}' +'.issue h3{margin:0 0 4px;font-size:16px;}' +'.badge{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;text-transform:uppercase;}.nav-icon{display:inline-flex;vertical-align:middle;align-items:center;}.nav-icon svg{width:14px;height:14px;display:block;}' +'.badge.open{color:#C5504F;}.badge.fixed{color:#27ae60;}' +'.meta{color:#5b6478;font-size:13px;margin:2px 0;}' +'.photos{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;}.photos figure{margin:0;text-align:center;}' +'.photos img{width:200px;height:160px;object-fit:cover;border-radius:8px;border:2px solid #e6cddc;}.photos figcaption{font-size:11px;color:#5b6478;margin-top:3px;}' +'a{color:#185fa5;}'; return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+ISSUE_CFG.reportPageTitle+' \u2014 '+_esc(monthLabel)+'</title><style>'+css+'</style></head><body>'+b+'</body></html>'; }