var SHEET_ID = '1D9EgQfQmnJblq-_CZytGBnBccOBy_RK2ZHRpX7IwUv4';
var USERS_SHEET = 'Users';
var TOKENS_SHEET = 'Tokens';
var CLEANING_SHEET = 'Reports';
var TASKS_SHEET = 'Tasks';
var TASK_PHOTOS_SHEET = 'TaskPhotos';
var WEEK_COVERAGE_SHEET = 'WeekCoverage';
var TASK_LOG_SHEET = 'TaskLog';
var CIVIL_SHEET = 'CivilIssues';
var ELECTRIC_SHEET = 'ElectricIssues';
var FIRE_SHEET = 'FireIssues';
var HSE_SHEET = 'HseInspections';
var ELECTRICAL_JOBS_SHEET = 'ElectricalJobs';
var ELECTRICAL_SUMMARY_SHEET = 'ElectricalSummary';
var ELECTRIC_WORKER_REPORTS_SHEET = 'ElectricWorkerReports';
var CIVIL_JOBS_SHEET = 'CivilJobs';
var CIVIL_SUMMARY_SHEET = 'CivilSummary';
var TRASH_SHEET = 'Trash';
var WORKER_LOCATIONS_SHEET = 'WorkerLocations';
var WORKER_PUSH_SHEET = 'WorkerPushTokens';
var RESET_PASSWORD = 'empire2026';
var TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;

var SCRIPT_VERSION = '2026-07-18-electric-field-reports-v1';
var CIVIL_ASSIGNED_COL = 17;
var CIVIL_WORKERS_REQUIRED_COL = 18;
var CIVIL_WORKER_COMPLETIONS_COL = 19;
var CIVIL_ASSIGNED_WORKERS_COL = 20;
var CIVIL_DISPOSITION_COL = 21;
var CIVIL_FIX_DELAY_COL = 22;
var CIVIL_ASSIGN_VOICE_COL = 23;
var CIVIL_TRADE_IDS = {plumber:1, pipes:1, painting:1, tiles:1, wood:1};
var CIVIL_WORKER_TEAM = {
  mohammed_luqman: 'wood',
  saeed_shahuth: 'wood',
  shakhwan_dilshad: 'wood',
  abdulsamad_sulaiaman: 'wood',
  mohammed_qasim: 'tiles',
  rayan_hazhar: 'tiles',
  farman_ahmed: 'tiles',
  sear_samad: 'plumber',
  aram_majid: 'plumber',
  dlawar_kamal: 'plumber',
  shwan_ali: 'plumber',
  halmat_abozaid: 'painting',
  sardam_sardar: 'painting'
};
var ELECTRIC_TRADE_IDS = {electric: 1};
var ELECTRIC_WORKER_TEAM = {
  hashim_omar: 'electric',
  ibrahim_sadi: 'electric',
  ahmad_sadullah: 'electric',
  mariwan_saeed: 'electric',
  soran_ibrahim: 'electric',
  darbaz_majid: 'electric',
  jasim_muhammad: 'electric',
  chia_mustafa: 'electric',
  wrya_muhammad: 'electric',
  ibrahim_muhammad: 'electric',
  muhammad_hassan: 'electric',
  harim_sarkawt: 'electric'
};
var HSE_INSPECTOR = 'Evan Mansour';
var HSE_ASSETKEY_COL = 17;
var HSE_PERIOD_COL = 18;
var HSE_JOBDEPT_COL = 19;
var _SS_CACHE = null;
function getSS_() { if (!_SS_CACHE) _SS_CACHE = SpreadsheetApp.openById(SHEET_ID); return _SS_CACHE; }
function issuesCacheKey_(sheetName) { return 'issues_v2_' + sheetName; }
function invalidateIssuesCache_(sheetName) {
  try {
    var cache = CacheService.getScriptCache();
    var ckey = issuesCacheKey_(sheetName);
    try {
      var meta = cache.get(ckey + '_meta');
      if (meta) {
        var m = JSON.parse(meta);
        for (var p = 0; p < m.parts; p++) cache.remove(ckey + '_' + p);
        cache.remove(ckey + '_meta');
      }
    } catch(e2){}
    cache.remove(ckey);
    if (sheetName === CIVIL_SHEET) {
      var workers = Object.keys(CIVIL_WORKER_TEAM);
      for (var wi = 0; wi < workers.length; wi++) {
        cache.remove(ckey + '_wu_' + workers[wi]);
      }
      ['plumber', 'pipes', 'painting', 'tiles', 'wood'].forEach(function (t) {
        var wk = ckey + '_w_' + t;
        cache.remove(wk);
      });
    }
    if (sheetName === ELECTRIC_SHEET) {
      var eworkers = Object.keys(ELECTRIC_WORKER_TEAM);
      for (var ew = 0; ew < eworkers.length; ew++) {
        cache.remove(ckey + '_wu_' + eworkers[ew]);
      }
      cache.remove(ckey + '_w_electric');
    }
  } catch(e){}
}
function issuesCacheGet_(ckey) {
  var cache = CacheService.getScriptCache();
  try {
    var meta = cache.get(ckey + '_meta');
    if (meta) {
      var m = JSON.parse(meta);
      var parts = [];
      for (var p = 0; p < m.parts; p++) {
        var chunk = cache.get(ckey + '_' + p);
        if (!chunk) return null;
        parts.push(chunk);
      }
      return JSON.parse(parts.join(''));
    }
    var hit = cache.get(ckey);
    if (hit) return JSON.parse(hit);
  } catch(e){}
  return null;
}
function issuesCachePut_(ckey, out) {
  var cache = CacheService.getScriptCache();
  try {
    var js = JSON.stringify(out);
    var ttl = 300;
    if (js.length < 95000) {
      cache.put(ckey, js, ttl);
      return;
    }
    var partSize = 90000;
    var parts = Math.ceil(js.length / partSize);
    for (var p = 0; p < parts; p++) {
      cache.put(ckey + '_' + p, js.slice(p * partSize, (p + 1) * partSize), ttl);
    }
    cache.put(ckey + '_meta', JSON.stringify({parts: parts}), ttl);
  } catch(e){}
}
function reportsCacheKey_() { return 'reports_v1'; }
function invalidateReportsCache_() { try { CacheService.getScriptCache().remove(reportsCacheKey_()); } catch(e){} }
function taskPhotosCacheKey_(prefix) { return 'tphotos_v1_' + String(prefix||''); }
function invalidateTaskPhotosCache_(prefix) { try { CacheService.getScriptCache().remove(taskPhotosCacheKey_(prefix)); } catch(e){} }

// ---- Permanent, never-reused issue numbers (#1, #2, ...) per department sheet ----
// The number lives in column 16 ('num') and is also mirrored in a Script Property
// counter so numbers are never reused even after an issue is deleted/recycled.
var ISSUE_NUM_COL = 16; // 1-based column index (index 15)
function issnumKey_(sheetName) { return 'issnum_' + sheetName; }
// Ensures every data row has a num. Assigns to any missing rows in row order
// (row order = creation order because rows are appended). Mutates `rows` in place
// so callers can read rows[i][15] immediately. Returns the highest num in use.
function ensureIssueNums_(sheet, sheetName, rows) {
  if (!rows || rows.length < 2) return 0;
  if (String(rows[0][ISSUE_NUM_COL-1]||'') !== 'num') { sheet.getRange(1, ISSUE_NUM_COL).setValue('num'); }
  var maxNum = 0, missing = false, i;
  for (i=1;i<rows.length;i++) { var v = Number(rows[i][ISSUE_NUM_COL-1]||0); if (v>maxNum) maxNum=v; if (!v) missing=true; }
  if (!missing) return maxNum;
  var next = maxNum, out = [];
  for (i=1;i<rows.length;i++) {
    var cur = Number(rows[i][ISSUE_NUM_COL-1]||0);
    if (!cur) { next++; cur = next; rows[i][ISSUE_NUM_COL-1] = cur; }
    out.push([cur]);
  }
  sheet.getRange(2, ISSUE_NUM_COL, out.length, 1).setValues(out);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = issnumKey_(sheetName);
    if (next > Number(props.getProperty(key)||0)) props.setProperty(key, String(next));
  } catch(e){}
  invalidateIssuesCache_(sheetName);
  return next;
}
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ok:true,msg:'Empire API running',version:SCRIPT_VERSION})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    // Fast path: push actions must not wait on spreadsheet locks / password rechecks.
    if (action === 'saveWorkerPushToken') return respond(handleSaveWorkerPushToken_(body));
    if (action === 'testWorkerPush') return respond(handleTestWorkerPush_(body));
    if (action === 'debugWorkerPush') return respond(handleDebugWorkerPush_(body));
    if (action === 'login' || action === 'verifyLogin') return respond(handleLogin(body));
    if (action === 'getPerms') return respond(handleGetPerms(body));
    if (action === 'getSummary') return respond(handleGetSummary(body));
    var deptByAction = {
      'saveReport':'cleaning','getReports':'cleaning','deleteReport':'cleaning','saveTasks':'cleaning','getTasks':'cleaning','clearAll':'cleaning',
      'setTask':'cleaning','resetTasks':'cleaning',
      'getWeekCoverage':'cleaning','markTaskWeek':'cleaning','getRangeCoverage':'cleaning',
      'getTaskPhotos':'cleaning','addTaskPhoto':'cleaning','addTaskPhotos':'cleaning','deleteTaskPhoto':'cleaning',
      'logTask':'cleaning','getTaskLog':'cleaning',
      'addCivilIssue':'civil issue','updateCivilIssue':'civil issue','getCivilIssues':'civil issue','markCivilFixed':'civil issue','clearCivilIssues':'civil issue','deleteCivilIssue':'civil issue','assignCivilIssue':'civil issue','markCivilNotDept':'civil issue','restoreCivilIssue':'civil issue','setCivilFixDelay':'civil issue','reportWorkerLocation':'civil issue','getWorkerLocations':'civil issue','saveWorkerPushToken':'civil issue','testWorkerPush':'civil issue','debugWorkerPush':'civil issue',
      'addElectricIssue':'electric issue','updateElectricIssue':'electric issue','getElectricIssues':'electric issue','markElectricFixed':'electric issue','clearElectricIssues':'electric issue','deleteElectricIssue':'electric issue','assignElectricIssue':'electric issue','markElectricNotDept':'electric issue','restoreElectricIssue':'electric issue','setElectricFixDelay':'electric issue',
      'addFireIssue':'fire','updateFireIssue':'fire','getFireIssues':'fire','markFireFixed':'fire','clearFireIssues':'fire','deleteFireIssue':'fire',
      'addHseInspection':'hse','updateHseInspection':'hse','getHseInspections':'hse','markHseResolved':'hse','clearHseInspections':'hse','deleteHseInspection':'hse',
      'addElectricalJob':'electrical department','getElectricalJobs':'electrical department','updateElectricalJob':'electrical department',
      'deleteElectricalJob':'electrical department','clearElectricalJobs':'electrical department',
      'getElectricalSummary':'electrical department','saveElectricalSummary':'electrical department',
      'getElectricWorkerReports':'electrical department',
      'addElectricWorkerReport':'electric issue',
      'addCivilJob':'civil department','getCivilJobs':'civil department','updateCivilJob':'civil department',
      'deleteCivilJob':'civil department','clearCivilJobs':'civil department',
      'getCivilSummary':'civil department','saveCivilSummary':'civil department'
    };
    var trashActions = {getTrash:1, restoreTrash:1, purgeTrash:1, getUiSettings:1, saveUiSettings:1};
    var requiredDept = trashActions[action] ? body.dept : deptByAction[action];
    if (!requiredDept) return respond({ok:false,error:'Unknown action'});
    var auth;
    if (action === 'getWorkerLocations' || action === 'reportWorkerLocation') {
      auth = verifyToken(body.token, 'civil issue');
      if (!auth.ok) auth = verifyToken(body.token, 'electric issue');
    } else if (action === 'getElectricWorkerReports') {
      auth = verifyToken(body.token, 'electrical department');
      if (!auth.ok) auth = verifyToken(body.token, 'electric issue');
    } else {
      auth = verifyToken(body.token, requiredDept);
    }
    if (!auth.ok) return respond(auth);
    body.username = auth.username;
    body._authRole = String(auth.role || '').toLowerCase();
    body._authTrade = String(auth.trade || '').toLowerCase();
    if (body._authRole === 'worker') {
      var workerBlocked = {addCivilIssue:1, updateCivilIssue:1, deleteCivilIssue:1, clearCivilIssues:1, assignCivilIssue:1, markCivilNotDept:1, restoreCivilIssue:1, setCivilFixDelay:1, getWorkerLocations:1, addElectricIssue:1, updateElectricIssue:1, deleteElectricIssue:1, clearElectricIssues:1, assignElectricIssue:1, markElectricNotDept:1, restoreElectricIssue:1, setElectricFixDelay:1, addFireIssue:1, updateFireIssue:1, deleteFireIssue:1, clearFireIssues:1};
      if (workerBlocked[action]) return respond({ok:false,success:false,error:'not_allowed',message:'Not allowed for worker accounts.'});
    }
    if (action === 'reportWorkerLocation' && body._authRole !== 'worker') {
      return respond({ok:false,success:false,error:'not_allowed',message:'Only worker accounts can report location.'});
    }
    if (action === 'addElectricWorkerReport') {
      if (body._authRole !== 'worker') return respond({ok:false,success:false,error:'not_allowed',message:'Only electric workers can submit field reports.'});
      if (!isElectricWorkerId_(body.username)) return respond({ok:false,success:false,error:'not_allowed',message:'This account is not an electric field worker.'});
    }
    var adminOnly = {saveUiSettings:1, clearElectricalJobs:1, clearCivilJobs:1, clearCivilIssues:1, clearElectricIssues:1, clearFireIssues:1, clearHseInspections:1, clearAll:1, getTrash:1, restoreTrash:1, purgeTrash:1};
    if (adminOnly[action] && String(auth.role||'').toLowerCase()!=='admin') return respond({ok:false,success:false,error:'not_allowed',message:'Only an admin can do that.'});
    if (action==='saveReport') return respond(handleSaveReport(body));
    if (action==='getReports') return respond(handleGetReports(body));
    if (action==='deleteReport') return respond(handleDeleteReport(body));
    if (action==='saveTasks') return respond(handleSaveTasks(body));
    if (action==='getTasks') return respond(handleGetTasks(body));
    if (action==='setTask') return respond(handleSetTask(body));
    if (action==='resetTasks') return respond(handleResetTasks(body));
    if (action==='clearAll') return respond(handleClearAll(body));
    if (action==='getWeekCoverage') return respond(handleGetWeekCoverage(body));
    if (action==='markTaskWeek') return respond(handleMarkTaskWeek(body));
    if (action==='getRangeCoverage') return respond(handleGetRangeCoverage(body));
    if (action==='getTaskPhotos') return respond(handleGetTaskPhotos(body));
    if (action==='addTaskPhoto') return respond(handleAddTaskPhoto(body));
    if (action==='addTaskPhotos') return respond(handleAddTaskPhotos(body));
    if (action==='deleteTaskPhoto') return respond(handleDeleteTaskPhoto(body));
    if (action==='logTask') return respond(handleLogTask(body));
    if (action==='getTaskLog') return respond(handleGetTaskLog(body));
    if (action==='getUiSettings') return respond(handleGetUiSettings(body));
    if (action==='saveUiSettings') return respond(handleSaveUiSettings(body));
    if (action==='addCivilIssue') return respond(handleAddIssue(body, CIVIL_SHEET));
    if (action==='updateCivilIssue') return respond(handleUpdateIssue(body, CIVIL_SHEET));
    if (action==='getCivilIssues') return respond(handleGetIssues(body, CIVIL_SHEET, auth));
    if (action==='assignCivilIssue') return respond(handleAssignCivilIssue(body, auth));
    if (action==='markCivilNotDept') return respond(handleRouteCivilNotDept(body, auth));
    if (action==='restoreCivilIssue') return respond(handleRestoreCivilIssue(body, auth));
    if (action==='setCivilFixDelay') return respond(handleSetCivilFixDelay(body, auth));
    if (action==='reportWorkerLocation') return respond(handleReportWorkerLocation(body, auth));
    if (action==='getWorkerLocations') return respond(handleGetWorkerLocations(body, auth));
    if (action==='markCivilFixed') return respond(handleMarkFixed(body, CIVIL_SHEET, auth));
    if (action==='clearCivilIssues') return respond(handleClearIssues(body, CIVIL_SHEET));
    if (action==='deleteCivilIssue') return respond(handleDeleteIssue(body, CIVIL_SHEET));
    if (action==='addElectricIssue') return respond(handleAddIssue(body, ELECTRIC_SHEET));
    if (action==='updateElectricIssue') return respond(handleUpdateIssue(body, ELECTRIC_SHEET));
    if (action==='getElectricIssues') return respond(handleGetIssues(body, ELECTRIC_SHEET, auth));
    if (action==='assignElectricIssue') return respond(handleAssignElectricIssue(body, auth));
    if (action==='markElectricNotDept') return respond(handleRouteElectricNotDept(body, auth));
    if (action==='restoreElectricIssue') return respond(handleRestoreElectricIssue(body, auth));
    if (action==='setElectricFixDelay') return respond(handleSetElectricFixDelay(body, auth));
    if (action==='markElectricFixed') return respond(handleMarkFixed(body, ELECTRIC_SHEET, auth));
    if (action==='clearElectricIssues') return respond(handleClearIssues(body, ELECTRIC_SHEET));
    if (action==='deleteElectricIssue') return respond(handleDeleteIssue(body, ELECTRIC_SHEET));
    if (action==='addFireIssue') return respond(handleAddIssue(body, FIRE_SHEET));
    if (action==='updateFireIssue') return respond(handleUpdateIssue(body, FIRE_SHEET));
    if (action==='getFireIssues') return respond(handleGetIssues(body, FIRE_SHEET));
    if (action==='markFireFixed') return respond(handleMarkFixed(body, FIRE_SHEET));
    if (action==='clearFireIssues') return respond(handleClearIssues(body, FIRE_SHEET));
    if (action==='deleteFireIssue') return respond(handleDeleteIssue(body, FIRE_SHEET));
    if (action==='addHseInspection') return respond(handleAddHseInspection(body));
    if (action==='updateHseInspection') return respond(handleUpdateHseInspection(body));
    if (action==='getHseInspections') return respond(handleGetHseInspections(body));
    if (action==='markHseResolved') return respond(handleMarkFixed(body, HSE_SHEET));
    if (action==='clearHseInspections') return respond(handleClearIssues(body, HSE_SHEET));
    if (action==='deleteHseInspection') return respond(handleDeleteIssue(body, HSE_SHEET));
    if (action==='addElectricalJob') return respond(handleAddElectricalJob(body));
    if (action==='getElectricalJobs') return respond(handleGetElectricalJobs(body));
    if (action==='updateElectricalJob') return respond(handleUpdateElectricalJob(body));
    if (action==='deleteElectricalJob') return respond(handleDeleteElectricalJob(body));
    if (action==='clearElectricalJobs') return respond(handleClearElectricalJobs(body));
    if (action==='getElectricalSummary') return respond(handleGetElectricalSummary(body));
    if (action==='saveElectricalSummary') return respond(handleSaveElectricalSummary(body));
    if (action==='getElectricWorkerReports') return respond(handleGetElectricWorkerReports(body, auth));
    if (action==='addElectricWorkerReport') return respond(handleAddElectricWorkerReport(body, auth));
    if (action==='addCivilJob') return respond(handleAddCivilJob(body));
    if (action==='getCivilJobs') return respond(handleGetCivilJobs(body));
    if (action==='updateCivilJob') return respond(handleUpdateCivilJob(body));
    if (action==='deleteCivilJob') return respond(handleDeleteCivilJob(body));
    if (action==='clearCivilJobs') return respond(handleClearCivilJobs(body));
    if (action==='getCivilSummary') return respond(handleGetCivilSummary(body));
    if (action==='saveCivilSummary') return respond(handleSaveCivilSummary(body));
    if (action==='getTrash') return respond(handleGetTrash(body));
    if (action==='restoreTrash') return respond(handleRestoreTrash(body));
    if (action==='purgeTrash') return respond(handlePurgeTrash(body));
    return respond({ok:false,error:'Unhandled action'});
  } catch(err) {
    return respond({ok:false,error:err.message});
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Roles: admin = everything incl reset; editor = add/edit/delete + analytics + report (no reset); viewer = read-only; worker = assigned civil jobs + fix only.
// Optional "Hide" column (col E) removes extra abilities: list any of add, edit, delete, analytics, report, dashboard, categories, live location.
function computePerms_(role, hide) {
  role = normalizeRole_(role);
  var p;
  if (role==='admin') p = {view:true,add:true,edit:true,del:true,analytics:true,report:true,dashboard:true,reset:true,assign:true,fix:true,categories:true,liveLocation:true};
  else if (role==='worker') p = {view:true,add:false,edit:false,del:false,analytics:false,report:false,dashboard:true,reset:false,assign:false,fix:true,categories:true,liveLocation:false};
  else if (role==='viewer') p = {view:true,add:false,edit:false,del:false,analytics:true,report:true,dashboard:true,reset:false,assign:false,fix:false,categories:true,liveLocation:true};
  else p = {view:true,add:true,edit:true,del:true,analytics:true,report:true,dashboard:true,reset:false,assign:true,fix:true,categories:true,liveLocation:true};
  var raw = String(hide||'').toLowerCase();
  if (!raw) return {role:role, perms:p};
  var tokens = raw.indexOf(',') === -1 ? [raw] : raw.split(',');
  tokens.forEach(function (tok) {
    tok = String(tok || '').trim();
    if (!tok) return;
    if (tok.indexOf('add') !== -1) p.add = false;
    if (tok.indexOf('edit') !== -1) p.edit = false;
    if (tok.indexOf('delete') !== -1 || tok.indexOf('del') !== -1) p.del = false;
    if (tok.indexOf('analytic') !== -1) p.analytics = false;
    if (tok.indexOf('report') !== -1 || tok.indexOf('monthly') !== -1) p.report = false;
    if (tok.indexOf('dashboard') !== -1 || tok === 'dash') p.dashboard = false;
    if (tok.indexOf('categor') !== -1) p.categories = false;
    if (tok.indexOf('live') !== -1 && tok.indexOf('loc') !== -1) p.liveLocation = false;
  });
  return {role:role, perms:p};
}
function normalizeProjectsField_(raw, userDept) {
  userDept = String(userDept || '').trim().toLowerCase();
  if (userDept === 'all') return [];
  raw = String(raw || '').trim().toLowerCase();
  if (!raw || raw === 'all') return [];
  var valid = {ec:1, es:1, wd:1, ww:1, ww2:1, ra:1};
  if (raw.indexOf(',') === -1) return valid[raw] ? [raw] : [];
  var out = [];
  raw.split(',').forEach(function (p) {
    p = p.trim();
    if (valid[p] && out.indexOf(p) === -1) out.push(p);
  });
  return out;
}
function projectsForUserRow_(row) {
  if (!row) return [];
  return normalizeProjectsField_(row[5], row[2]);
}
function normalizeTrade_(raw) {
  raw = String(raw || '').trim().toLowerCase();
  if (raw === 'pipes' || raw === 'pipe' || raw === 'plumbing') return 'plumber';
  if (raw === 'carpentry' || raw === 'carpenter' || raw === 'doors') return 'wood';
  if (raw === 'electrician') return 'electric';
  if (ELECTRIC_TRADE_IDS[raw]) return raw;
  if (CIVIL_TRADE_IDS[raw]) return raw === 'pipes' ? 'plumber' : raw;
  return '';
}
function isWorkerIssueSheet_(sheetName) {
  return sheetName === CIVIL_SHEET || sheetName === ELECTRIC_SHEET;
}
function routedDispositionForSheet_(sheetName) {
  if (sheetName === ELECTRIC_SHEET) return 'not_electric';
  return 'not_civil';
}
function ensureExtendedIssueHeaders_(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id','project','building','floor','spot','issueType','note','date','photo','fixedPhoto','status','createdBy','createdAt','fixedBy','fixedAt','num','assignedGroup','workersRequired','workerCompletions','assignedWorkers','disposition','fixDelay','assignVoiceNote']);
    return;
  }
  if (String(sheet.getRange(1, CIVIL_ASSIGNED_COL).getValue() || '') !== 'assignedGroup') {
    sheet.getRange(1, CIVIL_ASSIGNED_COL).setValue('assignedGroup');
  }
  if (String(sheet.getRange(1, CIVIL_WORKERS_REQUIRED_COL).getValue() || '') !== 'workersRequired') {
    sheet.getRange(1, CIVIL_WORKERS_REQUIRED_COL).setValue('workersRequired');
  }
  if (String(sheet.getRange(1, CIVIL_WORKER_COMPLETIONS_COL).getValue() || '') !== 'workerCompletions') {
    sheet.getRange(1, CIVIL_WORKER_COMPLETIONS_COL).setValue('workerCompletions');
  }
  if (String(sheet.getRange(1, CIVIL_ASSIGNED_WORKERS_COL).getValue() || '') !== 'assignedWorkers') {
    sheet.getRange(1, CIVIL_ASSIGNED_WORKERS_COL).setValue('assignedWorkers');
  }
  if (String(sheet.getRange(1, CIVIL_DISPOSITION_COL).getValue() || '') !== 'disposition') {
    sheet.getRange(1, CIVIL_DISPOSITION_COL).setValue('disposition');
  }
  if (String(sheet.getRange(1, CIVIL_FIX_DELAY_COL).getValue() || '') !== 'fixDelay') {
    sheet.getRange(1, CIVIL_FIX_DELAY_COL).setValue('fixDelay');
  }
  if (String(sheet.getRange(1, CIVIL_ASSIGN_VOICE_COL).getValue() || '') !== 'assignVoiceNote') {
    sheet.getRange(1, CIVIL_ASSIGN_VOICE_COL).setValue('assignVoiceNote');
  }
}
function ensureCivilIssueHeaders_(sheet) {
  ensureExtendedIssueHeaders_(sheet);
}
function tradeForUserRow_(row) {
  if (!row) return '';
  return normalizeTrade_(row[6]);
}
function parseAssignVoiceNote_(raw) {
  raw = String(raw || '').trim();
  if (!raw) return null;
  if (raw.charAt(0) === '{') {
    try {
      var o = JSON.parse(raw);
      if (o && o.url) {
        return {
          url: String(o.url || ''),
          by: String(o.by || ''),
          at: String(o.at || ''),
          durationSec: Number(o.durationSec) || 0,
          mimeType: String(o.mimeType || '')
        };
      }
    } catch (e) {}
  }
  if (raw.indexOf('http') === 0) return { url: raw, by: '', at: '', durationSec: 0 };
  return null;
}
function formatAssignVoiceNote_(note) {
  if (!note || !note.url) return '';
  return JSON.stringify({
    url: String(note.url),
    by: String(note.by || ''),
    at: String(note.at || ''),
    durationSec: Number(note.durationSec) || 0,
    mimeType: String(note.mimeType || '')
  });
}
function normalizeWorkerId_(raw) {
  return String(raw || '').trim().toLowerCase();
}
function parseAssignedWorkers_(raw) {
  raw = String(raw || '').trim();
  if (!raw) return [];
  if (raw.charAt(0) === '[') {
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var id = normalizeWorkerId_(arr[i]);
        if (id && out.indexOf(id) === -1) out.push(id);
      }
      return out;
    } catch (e) {}
  }
  if (raw.indexOf(',') !== -1) {
    var parts = raw.split(',');
    var list = [];
    for (var j = 0; j < parts.length; j++) {
      var p = normalizeWorkerId_(parts[j]);
      if (p && list.indexOf(p) === -1) list.push(p);
    }
    return list;
  }
  var one = normalizeWorkerId_(raw);
  return one ? [one] : [];
}
function formatAssignedWorkers_(workers) {
  return JSON.stringify(workers || []);
}
function isKnownWorkerId_(id) {
  id = normalizeWorkerId_(id);
  return !!(id && (CIVIL_WORKER_TEAM[id] || ELECTRIC_WORKER_TEAM[id]));
}
function isElectricWorkerId_(id) {
  id = normalizeWorkerId_(id);
  return !!(id && ELECTRIC_WORKER_TEAM[id]);
}
function isKnownCivilWorkerId_(id) {
  return isKnownWorkerId_(id);
}
function workerIssueDeptForUser_(username) {
  username = normalizeWorkerId_(username);
  if (username && ELECTRIC_WORKER_TEAM[username]) return 'electric issue';
  if (username && CIVIL_WORKER_TEAM[username]) return 'civil issue';
  return '';
}
function normalizeAssignedWorkersInput_(body) {
  var out = [];
  if (body && body.assignedWorkers && body.assignedWorkers.length) {
    for (var i = 0; i < body.assignedWorkers.length; i++) {
      var id = normalizeWorkerId_(body.assignedWorkers[i]);
      if (!id || out.indexOf(id) !== -1) continue;
      if (!isKnownWorkerId_(id)) continue;
      out.push(id);
    }
  }
  return out;
}
function workerAssignedToIssue_(assignedWorkers, username) {
  username = normalizeWorkerId_(username);
  if (!username || !assignedWorkers || !assignedWorkers.length) return false;
  for (var i = 0; i < assignedWorkers.length; i++) {
    if (normalizeWorkerId_(assignedWorkers[i]) === username) return true;
  }
  return false;
}
function primaryTeamForWorkers_(workerIds) {
  if (!workerIds || !workerIds.length) return '';
  for (var i = 0; i < workerIds.length; i++) {
    var team = CIVIL_WORKER_TEAM[normalizeWorkerId_(workerIds[i])] || ELECTRIC_WORKER_TEAM[normalizeWorkerId_(workerIds[i])];
    if (team) return normalizeTrade_(team);
  }
  return '';
}
function assignWorkersRequiredCount_(workers) {
  return workers && workers.length ? workers.length : 1;
}
function parseWorkersRequired_(raw) {
  var n = Math.floor(Number(raw || 1));
  if (!n || n < 1) return 1;
  return n > 4 ? 4 : n;
}
function normalizePhotoSources_(body, photoCount) {
  var sources = [];
  if (body && body.photoSources && body.photoSources.length) {
    for (var i = 0; i < body.photoSources.length; i++) {
      var s = String(body.photoSources[i] || 'camera').toLowerCase();
      sources.push(s === 'gallery' ? 'gallery' : 'camera');
    }
  }
  while (sources.length < photoCount) sources.push('camera');
  if (sources.length > photoCount) sources = sources.slice(0, photoCount);
  return sources;
}
function parseWorkerCompletions_(raw) {
  raw = String(raw || '').trim();
  if (!raw || raw.charAt(0) !== '[') return [];
  try {
    var arr = JSON.parse(raw);
    if (!arr || !arr.length) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i] || {};
      var photos = [];
      if (item.photos && item.photos.length) {
        for (var j = 0; j < item.photos.length; j++) {
          var u = String(item.photos[j] || '').trim();
          if (u) photos.push(u);
        }
      }
      if (!photos.length) continue;
      var photoSources = [];
      if (item.photoSources && item.photoSources.length) {
        for (var k = 0; k < item.photoSources.length; k++) {
          var src = String(item.photoSources[k] || 'camera').toLowerCase();
          photoSources.push(src === 'gallery' ? 'gallery' : 'camera');
        }
      }
      while (photoSources.length < photos.length) photoSources.push('camera');
      if (photoSources.length > photos.length) photoSources = photoSources.slice(0, photos.length);
      out.push({
        user: String(item.user || '').trim(),
        photos: photos,
        photoSources: photoSources,
        at: String(item.at || '').trim(),
        note: String(item.note || '').trim(),
        lat: isFinite(Number(item.lat)) ? Number(item.lat) : null,
        lng: isFinite(Number(item.lng)) ? Number(item.lng) : null,
        accuracy: item.accuracy === '' || item.accuracy === null || item.accuracy === undefined ? null : Number(item.accuracy)
      });
    }
    return out;
  } catch (e) {
    return [];
  }
}
function formatWorkerCompletions_(completions) {
  return JSON.stringify(completions || []);
}
function workerAlreadyCompleted_(completions, username) {
  username = String(username || '').trim().toLowerCase();
  if (!username) return false;
  for (var i = 0; i < completions.length; i++) {
    if (String((completions[i] && completions[i].user) || '').trim().toLowerCase() === username) return true;
  }
  return false;
}
function mergeWorkerCompletionPhotos_(completions) {
  var photos = [];
  for (var i = 0; i < completions.length; i++) {
    var list = completions[i].photos || [];
    for (var j = 0; j < list.length; j++) {
      if (photos.indexOf(list[j]) === -1) photos.push(list[j]);
    }
  }
  return photos;
}
function getUserRowByName_(username) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) return null;
  var rows = sheet.getDataRange().getValues();
  username = String(username || '').trim().toLowerCase();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === username) return rows[i];
  }
  return null;
}
function normalizeRole_(role) {
  role = String(role || '').trim().toLowerCase();
  if (role === 'engineer') return 'editor';
  if (role === 'admin' || role === 'viewer' || role === 'editor' || role === 'worker') return role;
  return 'editor';
}
function roleFromAuth_(auth) {
  var row = getUserRowByName_(auth && auth.username);
  if (row) return normalizeRole_(computePerms_(row[3], row[4]).role);
  return normalizeRole_((auth && auth.role) || '');
}
function enrichAuthRole_(auth) {
  if (!auth || auth.ok === false) return auth;
  auth.role = roleFromAuth_(auth);
  return auth;
}
function projectAllowedForUser_(username, project) {
  var projects = projectsForUserRow_(getUserRowByName_(username));
  if (!projects.length) return true;
  return projects.indexOf(String(project || '').trim().toLowerCase()) !== -1;
}
function passwordDigest_(pw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw || ''));
  return Utilities.base64EncodeWebSafe(bytes);
}
function currentPasswordDigestForUser_(username) {
  var row = getUserRowByName_(username);
  if (!row) return '';
  return passwordDigest_(String(row[1] || '').trim());
}
function invalidateTokenCache_(token) {
  try {
    var tkey = 'tok_' + Utilities.base64EncodeWebSafe(String(token)).slice(0, 40);
    CacheService.getScriptCache().remove(tkey);
  } catch (e) {}
}
function revokeAllTokensForUser_(ss, username) {
  var tsheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tsheet || tsheet.getLastRow() < 2) return;
  var rows = tsheet.getDataRange().getValues();
  username = String(username || '').trim().toLowerCase();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1] || '').trim().toLowerCase() === username) {
      invalidateTokenCache_(rows[i][0]);
      tsheet.deleteRow(i + 1);
    }
  }
}
function passwordChangedResponse_() {
  return {ok:false, error:'password_changed', message:'Your password was changed. Please sign in again.'};
}
function ensureTokenPasswordValid_(ss, tsheet, sheetRowNum, tokenRow, username, token) {
  var current = currentPasswordDigestForUser_(username);
  if (!current) {
    revokeAllTokensForUser_(ss, username);
    return passwordChangedResponse_();
  }
  var stored = String(tokenRow[5] || '').trim();
  if (!stored) {
    tsheet.getRange(sheetRowNum, 6).setValue(current);
    return {ok:true};
  }
  if (stored !== current) {
    revokeAllTokensForUser_(ss, username);
    return passwordChangedResponse_();
  }
  return {ok:true};
}
function pruneExpiredTokens_(ss) {
  // Keeps the Tokens sheet small so verifyToken()'s scan stays fast on every API call.
  try {
    var tsheet = ss.getSheetByName(TOKENS_SHEET);
    if (!tsheet || tsheet.getLastRow() < 2) return;
    var rows = tsheet.getDataRange().getValues();
    var now = new Date().getTime();
    var keep = [];
    for (var i = 1; i < rows.length; i++) {
      if (now - Number(rows[i][3]) <= TOKEN_TTL) keep.push(rows[i]);
    }
    if (keep.length === rows.length - 1) return;
    var lastRow = tsheet.getLastRow();
    if (lastRow > 1) tsheet.deleteRows(2, lastRow - 1);
    if (keep.length > 0) tsheet.getRange(2, 1, keep.length, 6).setValues(keep);
  } catch (e) { /* never let cleanup break login */ }
}
function maybePruneExpiredTokens_(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty('tokens_pruned_at') || 0);
    var now = new Date().getTime();
    if (now - last < 3600000) return;
    props.setProperty('tokens_pruned_at', String(now));
    pruneExpiredTokens_(ss);
  } catch (e) {}
}
function normalizeDeptField_(userDept) {
  userDept = String(userDept || '').trim().toLowerCase();
  if (!userDept) return '';
  if (userDept === 'all') return 'all';
  if (userDept.indexOf(',') === -1) return userDept;
  return userDept.split(',').map(function (p) { return p.trim(); }).filter(Boolean).join(',');
}
function deptListAllows_(userDept, requestedDept) {
  userDept = normalizeDeptField_(userDept);
  requestedDept = String(requestedDept || '').trim().toLowerCase();
  if (!userDept || !requestedDept) return false;
  if (userDept === 'all') return true;
  if (userDept === requestedDept) return true;
  if (userDept.indexOf(',') !== -1) {
    var parts = userDept.split(',');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].trim() === requestedDept) return true;
    }
  }
  return false;
}
function tokenDeptAllows_(tokenDept, requiredDept) {
  return deptListAllows_(tokenDept, requiredDept);
}
function tokenCacheKey_(token) {
  return 'tok_' + Utilities.base64EncodeWebSafe(String(token)).slice(0, 40);
}
function pushAuthPropKey_(token) {
  return 'pushauth_' + tokenCacheKey_(token);
}
/** Remember session for fast push-token save (cache + Script properties). */
function rememberPushAuth_(token, username, tokenDept, role) {
  if (!token || !username) return;
  var rec = {
    ok: true,
    username: String(username),
    dept: String(tokenDept || '').trim().toLowerCase(),
    role: String(role || '').trim().toLowerCase()
  };
  try {
    CacheService.getScriptCache().put(tokenCacheKey_(token), JSON.stringify(rec), 21600);
  } catch (e) {}
  try {
    PropertiesService.getScriptProperties().setProperty(pushAuthPropKey_(token), JSON.stringify({
      username: rec.username,
      dept: rec.dept,
      role: rec.role,
      savedAt: new Date().getTime()
    }));
  } catch (e) {}
  try {
    PropertiesService.getScriptProperties().setProperty(
      'worker_sess_' + String(username).trim().toLowerCase(),
      String(token)
    );
  } catch (e) {}
}
function handleLogin(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) return {ok:false,success:false,message:'Users sheet not found',error:'Users sheet not found'};
  var rows = sheet.getDataRange().getValues();
  var username = String(body.username||'').trim().toLowerCase();
  var password = String(body.password||'').trim();
  var requestedDept = String(body.dept||'').trim().toLowerCase();
  var autoLogin = (requestedDept === 'auto' || requestedDept === 'home');
  if (!requestedDept && !autoLogin) requestedDept = 'cleaning';
  for (var i=1;i<rows.length;i++) {
    var uname = String(rows[i][0]||'').trim().toLowerCase();
    var upass = String(rows[i][1]||'').trim();
    var userDept = normalizeDeptField_(rows[i][2]);
    if (uname===username && upass===password) {
      if (!userDept) {
        return {ok:false,success:false,message:'Department not set for this user. Use one department, comma-separated departments, or "all" in the Users sheet.',error:'department_not_set'};
      }
      if (!autoLogin) {
        if (!deptListAllows_(userDept, requestedDept)) return {ok:false,success:false,message:'This login is not allowed for this section',error:'This login is not allowed for this section'};
      }
      var rp = computePerms_(rows[i][3], rows[i][4]);
      var projects = projectsForUserRow_(rows[i]);
      var trade = tradeForUserRow_(rows[i]);
      if (rp.role === 'worker' && !trade) {
        return {ok:false,success:false,message:'Worker account needs a trade in column G (plumber, painting, tiles, wood, or electric).',error:'trade_not_set'};
      }
      var tokenDept = userDept;
      var token = Utilities.getUuid();
      var tsheet = ss.getSheetByName(TOKENS_SHEET) || ss.insertSheet(TOKENS_SHEET);
      tsheet.appendRow([token, username, tokenDept, new Date().getTime(), rp.role, passwordDigest_(upass)]);
      rememberPushAuth_(token, username, tokenDept, rp.role);
      var loginResult = {ok:true,success:true,token:token,username:username,dept:tokenDept,role:rp.role,perms:rp.perms,projects:projects,trade:trade,message:'Login successful'};
      var loginFcm = String(body.fcmToken || body.pushToken || '').trim();
      if (loginFcm && rp.role === 'worker') {
        try { persistWorkerPushToken_(username, loginFcm, String(body.platform || 'web-fcm')); } catch (e) {}
      }
      return loginResult;
    }
  }
  return {ok:false,success:false,message:'Invalid username or password',error:'Invalid username, password, or department'};
}

function handleGetPerms(body) {
  if (!body.token) return {ok:false, error:'No token'};
  var ss = getSS_();
  var tsheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tsheet) return {ok:false, error:'Not authenticated'};
  var trows = tsheet.getDataRange().getValues();
  var now = new Date().getTime();
  var username = '';
  var tokenRow = null;
  var tokenSheetRow = 0;
  for (var i=0;i<trows.length;i++) {
    if (String(trows[i][0])===String(body.token)) {
      if (now - Number(trows[i][3]) > TOKEN_TTL) return {ok:false, error:'Token expired'};
      username = String(trows[i][1]||'').trim().toLowerCase();
      tokenRow = trows[i];
      tokenSheetRow = i + 1;
      break;
    }
  }
  if (!username || !tokenRow) return {ok:false, error:'Invalid token'};
  var pwCheck = ensureTokenPasswordValid_(ss, tsheet, tokenSheetRow, tokenRow, username, body.token);
  if (!pwCheck.ok) return pwCheck;
  var usheet = ss.getSheetByName(USERS_SHEET);
  if (!usheet) return {ok:false, error:'Users sheet not found'};
  var urows = usheet.getDataRange().getValues();
  for (var j=1;j<urows.length;j++) {
    if (String(urows[j][0]||'').trim().toLowerCase()===username) {
      var rp = computePerms_(urows[j][3], urows[j][4]);
      return {ok:true, role:rp.role, perms:rp.perms, projects:projectsForUserRow_(urows[j]), trade:tradeForUserRow_(urows[j])};
    }
  }
  return {ok:false, error:'User not found'};
}

function sessionCacheValid_(cached, requiredDept) {
  if (!cached || !cached.username) return null;
  if (requiredDept && !tokenDeptAllows_(cached.dept, requiredDept)) {
    return {ok:false, error:'This login is not allowed for this section'};
  }
  var current = currentPasswordDigestForUser_(cached.username);
  if (!current) {
    revokeAllTokensForUser_(getSS_(), cached.username);
    return passwordChangedResponse_();
  }
  if (!cached.pwDigest) return null;
  if (cached.pwDigest !== current) {
    revokeAllTokensForUser_(getSS_(), cached.username);
    return passwordChangedResponse_();
  }
  return cached;
}
function verifyToken(token, requiredDept) {
  if (!token) return {ok:false,error:'No token'};
  requiredDept = String(requiredDept||'').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var tkey = tokenCacheKey_(token);
  try {
    var hit = cache.get(tkey);
    if (hit) {
      var cached = sessionCacheValid_(JSON.parse(hit), requiredDept);
      if (cached && cached.ok === false) {
        try { cache.remove(tkey); } catch (e) {}
        return cached;
      }
      if (cached) return enrichAuthRole_(cached);
    }
  } catch(e){}
  var ss = getSS_();
  maybePruneExpiredTokens_(ss);
  var tsheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tsheet) return {ok:false,error:'Not authenticated'};
  var rows = tsheet.getDataRange().getValues();
  var now = new Date().getTime();
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][0])===String(token)) {
      var tokenDept = String(rows[i][2]||'').trim().toLowerCase();
      if (now - Number(rows[i][3]) > TOKEN_TTL) return {ok:false,error:'Token expired'};
      var username = String(rows[i][1]||'').trim().toLowerCase();
      var pwCheck = ensureTokenPasswordValid_(ss, tsheet, i + 1, rows[i], username, token);
      if (!pwCheck.ok) return pwCheck;
      if (!tokenDeptAllows_(tokenDept, requiredDept)) return {ok:false,error:'This login is not allowed for this section'};
      var urow = getUserRowByName_(username);
      var result = enrichAuthRole_({ok:true,username:rows[i][1],dept:tokenDept,role:String(rows[i][4]||''),trade:tradeForUserRow_(urow),pwDigest:currentPasswordDigestForUser_(username)});
      try { cache.put(tkey, JSON.stringify(result), 21600); } catch(e){}
      rememberPushAuth_(token, rows[i][1], tokenDept, String(rows[i][4]||''));
      return result;
    }
  }
  return {ok:false,error:'Invalid token'};
}

function verifyTokenSession_(token) {
  if (!token) return {ok:false,error:'No token'};
  var cache = CacheService.getScriptCache();
  var tkey = tokenCacheKey_(token);
  try {
    var hit = cache.get(tkey);
    if (hit) {
      var cached = sessionCacheValid_(JSON.parse(hit), '');
      if (cached && cached.ok === false) {
        try { cache.remove(tkey); } catch (e) {}
        return cached;
      }
      if (cached) return enrichAuthRole_(cached);
    }
  } catch(e){}
  var ss = getSS_();
  var tsheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tsheet || tsheet.getLastRow() < 2) return {ok:false,error:'Not authenticated'};
  var lastRow = tsheet.getLastRow();
  var now = new Date().getTime();
  var chunkSize = 200;
  for (var endRow = lastRow; endRow >= 2; endRow -= chunkSize) {
    var startRow = Math.max(2, endRow - chunkSize + 1);
    var rows = tsheet.getRange(startRow, 1, endRow, 6).getValues();
    for (var j = rows.length - 1; j >= 0; j--) {
      var row = rows[j];
      if (String(row[0]) !== String(token)) continue;
      if (now - Number(row[3]) > TOKEN_TTL) return {ok:false,error:'Token expired'};
      var username = String(row[1] || '').trim().toLowerCase();
      var sheetRowNum = startRow + j;
      var pwCheck = ensureTokenPasswordValid_(ss, tsheet, sheetRowNum, row, username, token);
      if (!pwCheck.ok) return pwCheck;
      var urow = getUserRowByName_(username);
      var result = enrichAuthRole_({ok:true,username:row[1],dept:String(row[2]||'').trim().toLowerCase(),role:String(row[4]||''),trade:tradeForUserRow_(urow),pwDigest:currentPasswordDigestForUser_(username)});
      try { cache.put(tkey, JSON.stringify(result), 21600); } catch(e){}
      rememberPushAuth_(token, row[1], String(row[2]||''), String(row[4]||''));
      return result;
    }
  }
  return {ok:false,error:'Invalid token'};
}

function maxTs_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function issueStatsFromSheet_(sheetName) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return {open:0, total:0, lastActivity:''};
  var rows = sheet.getDataRange().getValues();
  var open = 0, lastAt = '';
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][10] || 'open') !== 'fixed') open++;
    lastAt = maxTs_(lastAt, dtIssue_(rows[i][12]));
    lastAt = maxTs_(lastAt, dtIssue_(rows[i][14]));
  }
  return {open:open, total:rows.length - 1, lastActivity:lastAt};
}

function jobsStatsThisMonth_(sheetName) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return {jobsThisMonth:0, total:0, lastActivity:''};
  var tz = ss.getSpreadsheetTimeZone();
  var monthPrefix = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  var rows = sheet.getDataRange().getValues();
  var count = 0, lastAt = '';
  for (var i = 1; i < rows.length; i++) {
    var dv = rows[i][1];
    var ds = (dv instanceof Date) ? Utilities.formatDate(dv, tz, 'yyyy-MM-dd') : String(dv || '');
    if (ds.indexOf(monthPrefix) === 0) count++;
    lastAt = maxTs_(lastAt, dtIssue_(rows[i][10]));
  }
  return {jobsThisMonth:count, total:rows.length - 1, lastActivity:lastAt};
}

function cleaningReportsToday_() {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CLEANING_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {reportsToday:0, lastActivity:''};
  var tz = ss.getSpreadsheetTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var rows = sheet.getDataRange().getValues();
  var count = 0, lastAt = '';
  for (var i = 1; i < rows.length; i++) {
    if (fmtDate_(rows[i][1]) === today) count++;
    lastAt = maxTs_(lastAt, dtIssue_(rows[i][9]));
  }
  return {reportsToday:count, lastActivity:lastAt};
}

function summaryLevelFromOpen_(open) {
  if (open > 5) return 'alert';
  if (open > 0) return 'warn';
  return 'ok';
}

function buildCleaningReportsSummary_() {
  var reports = cleaningReportsToday_();
  var label = reports.reportsToday > 0
    ? (reports.reportsToday + ' report' + (reports.reportsToday === 1 ? '' : 's') + ' today')
    : 'No reports today';
  return {open:0, reportsToday:reports.reportsToday, label:label, lastActivity:reports.lastActivity, level:reports.reportsToday > 0 ? 'ok' : 'muted'};
}

function buildCleaningHubSummary_() {
  var civil = issueStatsFromSheet_(CIVIL_SHEET);
  var electric = issueStatsFromSheet_(ELECTRIC_SHEET);
  var fire = issueStatsFromSheet_(FIRE_SHEET);
  var reports = cleaningReportsToday_();
  var open = civil.open + electric.open + fire.open;
  var lastAt = maxTs_(maxTs_(civil.lastActivity, electric.lastActivity), maxTs_(fire.lastActivity, reports.lastActivity));
  var label = '';
  if (open > 0) label = open + ' open issue' + (open === 1 ? '' : 's');
  else if (reports.reportsToday > 0) label = reports.reportsToday + ' report' + (reports.reportsToday === 1 ? '' : 's') + ' today';
  else label = 'All clear';
  return {
    open:open,
    reportsToday:reports.reportsToday,
    label:label,
    lastActivity:lastAt,
    level:summaryLevelFromOpen_(open),
    sections:{
      'cleaning':buildCleaningReportsSummary_(),
      'civil issue':buildIssueHubSummary_(CIVIL_SHEET),
      'electric issue':buildIssueHubSummary_(ELECTRIC_SHEET),
      'fire':buildIssueHubSummary_(FIRE_SHEET)
    }
  };
}

function buildIssueHubSummary_(sheetName) {
  var stats = issueStatsFromSheet_(sheetName);
  var label = stats.open > 0 ? (stats.open + ' open') : 'All clear';
  return {open:stats.open, label:label, lastActivity:stats.lastActivity, level:summaryLevelFromOpen_(stats.open)};
}

function buildJobsHubSummary_(sheetName) {
  var stats = jobsStatsThisMonth_(sheetName);
  var label = stats.jobsThisMonth > 0 ? (stats.jobsThisMonth + ' job' + (stats.jobsThisMonth === 1 ? '' : 's') + ' this month') : 'No jobs this month';
  return {jobsThisMonth:stats.jobsThisMonth, label:label, lastActivity:stats.lastActivity, level:stats.jobsThisMonth > 0 ? 'ok' : 'muted'};
}

function summaryAllowedForToken_(tokenDept, summaryKey) {
  if (tokenDept === 'all') return true;
  if (deptListAllows_(tokenDept, summaryKey)) return true;
  if (summaryKey === 'cleaning') {
    return deptListAllows_(tokenDept, 'civil issue') ||
      deptListAllows_(tokenDept, 'electric issue') ||
      deptListAllows_(tokenDept, 'fire');
  }
  return false;
}

function handleGetSummary(body) {
  var sess = verifyTokenSession_(body.token);
  if (!sess.ok) return sess;
  var cache = CacheService.getScriptCache();
  var cacheKey = 'hub_summary_v2_' + Utilities.base64EncodeWebSafe(String(sess.dept || 'all')).slice(0, 24);
  try {
    var hit = cache.get(cacheKey);
    if (hit) return JSON.parse(hit);
  } catch(e){}
  var summary = {};
  if (summaryAllowedForToken_(sess.dept, 'cleaning')) summary.cleaning = buildCleaningHubSummary_();
  if (summaryAllowedForToken_(sess.dept, 'civil department')) summary['civil department'] = buildJobsHubSummary_(CIVIL_JOBS_SHEET);
  if (summaryAllowedForToken_(sess.dept, 'hse')) summary.hse = buildIssueHubSummary_(HSE_SHEET);
  if (summaryAllowedForToken_(sess.dept, 'electrical department')) summary['electrical department'] = buildJobsHubSummary_(ELECTRICAL_JOBS_SHEET);
  var out = {ok:true, summary:summary, generatedAt:new Date().toISOString()};
  try { cache.put(cacheKey, JSON.stringify(out), 120); } catch(e){}
  return out;
}

function handleSaveReport(body) {
  var r = body.report || {};
  if (!projectAllowedForUser_(body.username, r.project)) {
    return {ok:false, success:false, error:'not_allowed', message:'You do not have access to this project.'};
  }
  var ss = getSS_();
  var sheet = ss.getSheetByName(CLEANING_SHEET) || ss.insertSheet(CLEANING_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['id','date','project','building','employees','level','floors','photo','createdBy','createdAt']);
  var id = r.id || ('rep-' + new Date().getTime());
  var floors = Array.isArray(r.floors) ? r.floors.join(',') : (r.floors||'');
  sheet.appendRow([id,r.date||'',r.project||'',r.building||'',r.employees||'',r.level||'',floors,r.photo||'',body.username||'',new Date().toISOString()]);
  invalidateReportsCache_();
  return {ok:true, success:true, id:id};
}

function fmtDate_(v) {
  // Sheets sometimes silently converts a plain "yyyy-MM-dd" string into a real Date cell.
  // Reading a Date back with String() then produces a locale-formatted string (can even
  // come out in Arabic on this account), which breaks every date comparison downstream.
  // Always normalize to a clean yyyy-MM-dd string regardless of how the cell is stored.
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Etc/GMT', 'yyyy-MM-dd');
  }
  return String(v || '');
}
function handleGetReports(body) {
  var cache = CacheService.getScriptCache();
  var ckey = reportsCacheKey_();
  try { var hit = cache.get(ckey); if (hit) return JSON.parse(hit); } catch(e){}
  var ss = getSS_();
  var sheet = ss.getSheetByName(CLEANING_SHEET);
  if (!sheet||sheet.getLastRow()<2) return [];
  var rows = sheet.getDataRange().getValues();
  var reports = [];
  var allowed = projectsForUserRow_(getUserRowByName_(body.username || ''));
  for (var i=1;i<rows.length;i++) {
    var proj = String(rows[i][2] || '').trim().toLowerCase();
    if (allowed.length && allowed.indexOf(proj) === -1) continue;
    reports.push({id:rows[i][0],date:fmtDate_(rows[i][1]),project:rows[i][2],building:rows[i][3],employees:rows[i][4],level:rows[i][5],floors:rows[i][6],photo:rows[i][7],createdBy:rows[i][8],createdAt:rows[i][9]});
  }
  try { var js = JSON.stringify(reports); if (js.length < 95000) cache.put(ckey, js, 60); } catch(e){}
  return reports;
}

function handleDeleteReport(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CLEANING_SHEET);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      if (!projectAllowedForUser_(body.username, rows[i][2])) {
        return {ok:false, error:'not_allowed', message:'You do not have access to this project.'};
      }
      trashRows_(CLEANING_SHEET,[rows[i]],'delete',body.username); sheet.deleteRow(i+1); invalidateReportsCache_(); return {ok:true,success:true};
    }
  }
  return {ok:false,error:'Report not found'};
}

function handleSaveTasks(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASKS_SHEET) || ss.insertSheet(TASKS_SHEET);
  var key = body.key;
  var val = JSON.stringify(body.tasks);
  var rows = sheet.getDataRange().getValues();
  for (var i=0;i<rows.length;i++) {
    if (rows[i][0]===key) { sheet.getRange(i+1,2).setValue(val); return {ok:true}; }
  }
  sheet.appendRow([key,val]);
  return {ok:true};
}

// ===== Cleaning task checklist state (per-key boolean flags) =====
// Tasks sheet columns: key, done, updatedBy, updatedAt — one row per task key (e.g. "ec|weekly|Washing stairs").
// getTasks (no key in body) returns an object of every key currently marked done, e.g. {"ec|weekly|X": true}.
function handleGetTasks(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASKS_SHEET);
  if (!sheet || sheet.getLastRow()<2) return {};
  var rows = sheet.getDataRange().getValues();
  // Back-compat: if body.key is supplied, behave like the legacy single-blob lookup.
  if (body.key) {
    for (var i=1;i<rows.length;i++) {
      if (rows[i][0]===body.key) {
        try { return {ok:true,tasks:JSON.parse(rows[i][1])}; } catch(e) { return {ok:true,tasks:{}}; }
      }
    }
    return {ok:true,tasks:{}};
  }
  var out = {};
  for (var j=1;j<rows.length;j++) {
    var k = rows[j][0]; var v = rows[j][1];
    if (!k) continue;
    if (v===true || v==='true' || v===1) out[k] = true;
  }
  return out;
}

function handleSetTask(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASKS_SHEET) || ss.insertSheet(TASKS_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['key','done','updatedBy','updatedAt']);
  var key = body.key; var done = !!body.done;
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(key)) {
      sheet.getRange(i+1,2,1,3).setValues([[done, body.username||'', new Date().toISOString()]]);
      return {ok:true,success:true};
    }
  }
  sheet.appendRow([key, done, body.username||'', new Date().toISOString()]);
  return {ok:true,success:true};
}

function handleResetTasks(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASKS_SHEET);
  if (!sheet || sheet.getLastRow()<2) return {ok:true,success:true};
  var keys = body.keys || [];
  var rows = sheet.getDataRange().getValues();
  var toDelete = [];
  for (var i=1;i<rows.length;i++) { if (keys.indexOf(String(rows[i][0]))!==-1) toDelete.push(i+1); }
  toDelete.sort(function(a,b){return b-a;}).forEach(function(r){ sheet.deleteRow(r); });
  return {ok:true,success:true};
}

// ===== Task evidence photos (the "a task is done only when it has a saved photo" system) =====
// TaskPhotos columns: id, project, freq, task, date, period, image, createdBy, createdAt
// period is "YYYY-MM#week" for daily tasks (e.g. "2026-06#2"), or "YYYY-MM" for weekly/biweekly/monthly tasks.
function handleAddTaskPhoto(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASK_PHOTOS_SHEET) || ss.insertSheet(TASK_PHOTOS_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['id','project','freq','task','date','period','image','createdBy','createdAt']);
  var id = 'tp-' + Utilities.getUuid();
  sheet.appendRow([id, body.project||'', body.freq||'', body.task||'', body.date||'', body.period||'', body.image||'', body.username||'', new Date().toISOString()]);
  invalidateTaskPhotosCache_(String(body.period||'').split('#')[0]);
  return {ok:true, success:true, id:id};
}

function handleAddTaskPhotos(body) {
  var images = body.images || [];
  if (!images.length) return {ok:false, error:'No images'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASK_PHOTOS_SHEET) || ss.insertSheet(TASK_PHOTOS_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['id','project','freq','task','date','period','image','createdBy','createdAt']);
  var items = [];
  var periodPrefix = '';
  var now = new Date().toISOString();
  for (var i=0; i<images.length; i++) {
    var id = 'tp-' + Utilities.getUuid();
    var period = body.period || '';
    sheet.appendRow([id, body.project||'', body.freq||'', body.task||'', body.date||'', period, images[i]||'', body.username||'', now]);
    items.push({id:id, image:images[i]||''});
    periodPrefix = String(period).split('#')[0];
  }
  invalidateTaskPhotosCache_(periodPrefix);
  return {ok:true, success:true, items:items};
}

function handleGetTaskPhotos(body) {
  var prefix = body.periodPrefix ? String(body.periodPrefix) : '';
  var cache = CacheService.getScriptCache();
  var ckey = taskPhotosCacheKey_(prefix);
  try { var hit = cache.get(ckey); if (hit) return JSON.parse(hit); } catch(e){}
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASK_PHOTOS_SHEET);
  if (!sheet || sheet.getLastRow()<2) return [];
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var period = String(rows[i][5]||'');
    if (prefix && period.indexOf(prefix)!==0) continue;
    out.push({id:String(rows[i][0]),project:String(rows[i][1]),freq:String(rows[i][2]),task:String(rows[i][3]),date:fmtDate_(rows[i][4]),period:period,image:String(rows[i][6]||''),createdBy:String(rows[i][7]||''),createdAt:String(rows[i][8]||'')});
  }
  try { var js = JSON.stringify(out); if (js.length < 95000) cache.put(ckey, js, 60); } catch(e){}
  return out;
}

function handleDeleteTaskPhoto(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASK_PHOTOS_SHEET);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      var periodPrefix = String(rows[i][5]||'').split('#')[0];
      trashRows_(TASK_PHOTOS_SHEET,[rows[i]],'delete',body.username);
      sheet.deleteRow(i+1);
      invalidateTaskPhotosCache_(periodPrefix);
      return {ok:true,success:true};
    }
  }
  return {ok:false,error:'Photo not found'};
}

// ===== Weekly coverage tracking (lightweight done/image flag per project+task+week) =====
// WeekCoverage columns: weekStart, project, task, done, image, updatedBy, updatedAt
function handleMarkTaskWeek(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(WEEK_COVERAGE_SHEET) || ss.insertSheet(WEEK_COVERAGE_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['weekStart','project','task','done','image','updatedBy','updatedAt']);
  var weekStart = body.weekStart||'', project = body.project||'', task = body.task||'';
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(weekStart) && String(rows[i][1])===String(project) && String(rows[i][2])===String(task)) {
      sheet.getRange(i+1,4,1,4).setValues([[!!body.done, body.image||rows[i][4]||'', body.username||'', new Date().toISOString()]]);
      return {ok:true,success:true};
    }
  }
  sheet.appendRow([weekStart, project, task, !!body.done, body.image||'', body.username||'', new Date().toISOString()]);
  return {ok:true,success:true};
}

function handleGetWeekCoverage(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(WEEK_COVERAGE_SHEET);
  if (!sheet || sheet.getLastRow()<2) return {};
  var rows = sheet.getDataRange().getValues();
  var weekStart = String(body.weekStart||'');
  var out = {};
  for (var i=1;i<rows.length;i++) {
    if (fmtDate_(rows[i][0])!==weekStart) continue;
    var key = rows[i][1]+'|'+rows[i][2];
    out[key] = {done: !!rows[i][3], image: String(rows[i][4]||'')};
  }
  return out;
}

function handleGetRangeCoverage(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(WEEK_COVERAGE_SHEET);
  if (!sheet || sheet.getLastRow()<2) return [];
  var rows = sheet.getDataRange().getValues();
  var from = String(body.from||''), to = String(body.to||'');
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var ws = fmtDate_(rows[i][0]);
    if (from && ws<from) continue;
    if (to && ws>to) continue;
    out.push({weekStart:ws, project:String(rows[i][1]), task:String(rows[i][2]), done:!!rows[i][3], image:String(rows[i][4]||'')});
  }
  return out;
}

// ===== Task audit log (records every toggle, independent of evidence photos) =====
// TaskLog columns: date, project, freq, task, done, loggedBy, loggedAt
function handleLogTask(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASK_LOG_SHEET) || ss.insertSheet(TASK_LOG_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['date','project','freq','task','done','loggedBy','loggedAt']);
  sheet.appendRow([body.date||'', body.project||'', body.freq||'', body.task||'', !!body.done, body.username||'', new Date().toISOString()]);
  return {ok:true,success:true};
}

function handleGetTaskLog(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(TASK_LOG_SHEET);
  if (!sheet || sheet.getLastRow()<2) return [];
  var rows = sheet.getDataRange().getValues();
  var from = String(body.from||''), to = String(body.to||'');
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var d = fmtDate_(rows[i][0]);
    if (from && d<from) continue;
    if (to && d>to) continue;
    out.push({date:d, project:String(rows[i][1]), freq:String(rows[i][2]), task:String(rows[i][3]), done:!!rows[i][4], loggedBy:String(rows[i][5]||''), loggedAt:String(rows[i][6]||'')});
  }
  return out;
}

// Wipes all Cleaning department data (reports + task state + task photos + week coverage). Keeps TaskLog as a permanent audit trail.
function handleClearAll(body) {
  if (String((body && body.resetPassword)||'') !== RESET_PASSWORD) return {ok:false,success:false,error:'bad_password'};
  var ss = getSS_();
  [CLEANING_SHEET, TASKS_SHEET, TASK_PHOTOS_SHEET, WEEK_COVERAGE_SHEET].forEach(function(name){
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow()>1) { var _r=sheet.getDataRange().getValues(); trashRows_(name,_r.slice(1),'reset',body.username); sheet.deleteRows(2,sheet.getLastRow()-1); }
  });
  return {ok:true,success:true};
}

// Issue sheet columns: id,project,building,floor,spot,issueType,note,date,photo,fixedPhoto,status,createdBy,createdAt,fixedBy,fixedAt
function dtIssue_(d){ if(d instanceof Date){ var z=function(n){return String(n).padStart(2,'0');}; return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes()); } return String(d||''); }
function issueStatusFromCondition_(body) {
  var cond = String(body.condition||'').trim().toLowerCase();
  if (cond==='fine' || cond==='okay') return 'okay';
  if (cond==='not found' || cond==='missing') return 'missing';
  if (cond==='resolved' || cond==='fixed') return 'fixed';
  if (cond==='need maintenance' || cond==='needs fix' || cond==='needs_fix' || cond==='needsfix') return 'open';
  return String(body.status||'open');
}
function reportPeriodFromDate_(dateStr) {
  var d = String(dateStr||'').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) {
    var now = new Date();
    var z = function(n){ return String(n).padStart(2,'0'); };
    d = now.getFullYear()+'-'+z(now.getMonth()+1)+'-'+z(now.getDate());
  }
  var yr = parseInt(d.slice(0,4), 10), mo = parseInt(d.slice(5,7), 10), dy = parseInt(d.slice(8,10), 10);
  if (dy >= 26) { mo += 1; if (mo > 12) { mo = 1; yr += 1; } }
  return yr + '-' + String(mo).padStart(2,'0');
}
function hseAssetKey_(body) {
  return [body.project, body.building, body.floor, body.spot, body.issueType].map(function(s){ return String(s||'').trim().toLowerCase(); }).join('|');
}
function hseAssetKeyFromRow_(row) {
  return [row[1], row[2], row[3], row[4], row[5]].map(function(s){ return String(s||'').trim().toLowerCase(); }).join('|');
}
function ensureHseCols_(sheet, rows) {
  if (!rows || !rows.length) return;
  if (String(rows[0][HSE_ASSETKEY_COL-1]||'') !== 'assetKey') sheet.getRange(1, HSE_ASSETKEY_COL).setValue('assetKey');
  if (String(rows[0][HSE_PERIOD_COL-1]||'') !== 'reportPeriod') sheet.getRange(1, HSE_PERIOD_COL).setValue('reportPeriod');
  if (String(rows[0][HSE_JOBDEPT_COL-1]||'') !== 'jobDept') sheet.getRange(1, HSE_JOBDEPT_COL).setValue('jobDept');
}
function handleAddHseInspection(body) {
  var sheetName = HSE_SHEET;
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id','project','building','floor','spot','issueType','note','date','photo','fixedPhoto','status','createdBy','createdAt','fixedBy','fixedAt','num','assetKey','reportPeriod','jobDept']);
  }
  var assetKey = hseAssetKey_(body);
  var reportPeriod = reportPeriodFromDate_(body.date);
  var rows = sheet.getDataRange().getValues();
  ensureHseCols_(sheet, rows);
  var existingNum = 0, periodRowIdx = -1;
  for (var k = 1; k < rows.length; k++) {
    var ak = String(rows[k][HSE_ASSETKEY_COL-1]||'').toLowerCase() || hseAssetKeyFromRow_(rows[k]);
    if (ak === assetKey) {
      if (!existingNum) existingNum = Number(rows[k][ISSUE_NUM_COL-1]||0);
      var rowPeriod = String(rows[k][HSE_PERIOD_COL-1]||'') || reportPeriodFromDate_(rows[k][7]);
      if (rowPeriod === reportPeriod) periodRowIdx = k;
    }
  }
  var status = issueStatusFromCondition_(body);
  var reporter = HSE_INSPECTOR;
  if (periodRowIdx > 0) {
    var ri = periodRowIdx + 1;
    sheet.getRange(ri, 2, 1, 8).setValues([[body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'']]);
    sheet.getRange(ri, 11).setValue(status);
    sheet.getRange(ri, 12).setValue(reporter);
    sheet.getRange(ri, 13).setValue(new Date().toISOString());
    sheet.getRange(ri, HSE_ASSETKEY_COL).setValue(assetKey);
    sheet.getRange(ri, HSE_PERIOD_COL).setValue(reportPeriod);
    sheet.getRange(ri, HSE_JOBDEPT_COL).setValue(body.jobDept||'');
    if (status === 'fixed') {
      sheet.getRange(ri, 10).setValue(body.photo||'');
      sheet.getRange(ri, 14).setValue('');
      sheet.getRange(ri, 15).setValue(new Date().toISOString());
    }
    invalidateIssuesCache_(sheetName);
    return {ok:true, success:true, id:String(rows[periodRowIdx][0]), num:existingNum, updated:true};
  }
  var id = String(body.id||'') || Utilities.getUuid();
  var num;
  if (existingNum) {
    num = existingNum;
  } else {
    var maxNum = ensureIssueNums_(sheet, sheetName, rows);
    var props = PropertiesService.getScriptProperties();
    var key = issnumKey_(sheetName);
    num = Math.max(Number(props.getProperty(key)||0), maxNum) + 1;
    try { props.setProperty(key, String(num)); } catch(e){}
  }
  sheet.appendRow([id, body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'', '', status, reporter, new Date().toISOString(), '', '', num, assetKey, reportPeriod, body.jobDept||'']);
  invalidateIssuesCache_(sheetName);
  return {ok:true, success:true, id:id, num:num};
}
function handleUpdateHseInspection(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(HSE_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  ensureHseCols_(sheet, rows);
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(body.id)) {
      sheet.getRange(i+1, 2, 1, 8).setValues([[body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'']]);
      sheet.getRange(i+1, 12).setValue(HSE_INSPECTOR);
      if (body.condition) sheet.getRange(i+1, 11).setValue(issueStatusFromCondition_(body));
      var ak = hseAssetKey_(body);
      var rp = reportPeriodFromDate_(body.date);
      sheet.getRange(i+1, HSE_ASSETKEY_COL).setValue(ak);
      sheet.getRange(i+1, HSE_PERIOD_COL).setValue(rp);
      sheet.getRange(i+1, HSE_JOBDEPT_COL).setValue(body.jobDept||'');
      invalidateIssuesCache_(HSE_SHEET);
      return {ok:true, success:true, id:String(body.id)};
    }
  }
  return {ok:false, error:'Issue not found'};
}
function handleGetHseInspections(body) {
  var cache = CacheService.getScriptCache();
  var ckey = issuesCacheKey_(HSE_SHEET);
  try { var hit = cache.get(ckey); if (hit) return JSON.parse(hit); } catch(e){}
  var ss = getSS_();
  var sheet = ss.getSheetByName(HSE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  ensureHseCols_(sheet, rows);
  ensureIssueNums_(sheet, HSE_SHEET, rows);
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var dv = rows[i][7];
    var ds = (dv instanceof Date) ? Utilities.formatDate(dv, tz, 'yyyy-MM-dd') : String(dv);
    var ak = String(rows[i][HSE_ASSETKEY_COL-1]||'') || hseAssetKeyFromRow_(rows[i]);
    var rp = String(rows[i][HSE_PERIOD_COL-1]||'') || reportPeriodFromDate_(ds);
    if (!rows[i][HSE_ASSETKEY_COL-1]) sheet.getRange(i+1, HSE_ASSETKEY_COL).setValue(ak);
    if (!rows[i][HSE_PERIOD_COL-1]) sheet.getRange(i+1, HSE_PERIOD_COL).setValue(rp);
    out.push({id:String(rows[i][0]), num:Number(rows[i][ISSUE_NUM_COL-1]||0), project:String(rows[i][1]), building:String(rows[i][2]), floor:String(rows[i][3]), spot:String(rows[i][4]), issueType:String(rows[i][5]), note:String(rows[i][6]||''), date:ds, photo:String(rows[i][8]||''), fixedPhoto:String(rows[i][9]||''), status:String(rows[i][10]||'open'), createdBy:HSE_INSPECTOR, createdAt:dtIssue_(rows[i][12]), fixedBy:String(rows[i][13]||''), fixedAt:dtIssue_(rows[i][14]), assetKey:ak, reportPeriod:rp, jobDept:String(rows[i][HSE_JOBDEPT_COL-1]||'')});
  }
  try { var js = JSON.stringify(out); if (js.length < 95000) cache.put(ckey, js, 60); } catch(e){}
  return out;
}
function handleAddIssue(body, sheetName) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  var isWorkerIssue = isWorkerIssueSheet_(sheetName);
  if (sheet.getLastRow()===0) {
    if (isWorkerIssue) sheet.appendRow(['id','project','building','floor','spot','issueType','note','date','photo','fixedPhoto','status','createdBy','createdAt','fixedBy','fixedAt','num','assignedGroup','workersRequired','workerCompletions','assignedWorkers','disposition','fixDelay','assignVoiceNote']);
    else sheet.appendRow(['id','project','building','floor','spot','issueType','note','date','photo','fixedPhoto','status','createdBy','createdAt','fixedBy','fixedAt','num']);
  } else if (isWorkerIssue) {
    ensureExtendedIssueHeaders_(sheet);
  }
  var id = String(body.id||'') || Utilities.getUuid();
  // Backfill numbers for any existing rows and reconcile the counter.
  var rows = sheet.getDataRange().getValues();
  if (body.id) {
    for (var k=1;k<rows.length;k++) { if (String(rows[k][0])===id) { invalidateIssuesCache_(sheetName); return {ok:true, success:true, id:id, num:Number(rows[k][ISSUE_NUM_COL-1]||0)||null, deduped:true}; } }
  }
  var maxNum = ensureIssueNums_(sheet, sheetName, rows);
  var props = PropertiesService.getScriptProperties();
  var key = issnumKey_(sheetName);
  var num = Math.max(Number(props.getProperty(key)||0), maxNum) + 1;
  try { props.setProperty(key, String(num)); } catch(e){}
  var reporter = String(body.supervisor||'').trim() || String(body.username||'');
  var status = issueStatusFromCondition_(body);
  if (isWorkerIssue) {
    sheet.appendRow([id, body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'', '', status, reporter, new Date().toISOString(), '', '', num, '', 1, '']);
  } else {
    sheet.appendRow([id, body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'', '', status, reporter, new Date().toISOString(), '', '', num]);
  }
  invalidateIssuesCache_(sheetName);
  return {ok:true, success:true, id:id, num:num};
}

// Updates an existing issue's editable fields, keeping id, num (reference),
// status, fixed info, and createdAt unchanged.
function handleUpdateIssue(body, sheetName) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      // columns 2..9 = project, building, floor, spot, issueType, note, date, photo
      sheet.getRange(i+1, 2, 1, 8).setValues([[body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'']]);
      var reporter = String(body.supervisor||'').trim();
      if (reporter) sheet.getRange(i+1, 12).setValue(reporter); // createdBy = reported by
      if (body.condition) sheet.getRange(i+1, 11).setValue(issueStatusFromCondition_(body));
      invalidateIssuesCache_(sheetName);
      return {ok:true, success:true, id:String(body.id)};
    }
  }
  return {ok:false, error:'Issue not found'};
}

function handleGetIssues(body, sheetName, auth) {
  var ckey = issuesCacheKey_(sheetName);
  var isWorkerIssue = isWorkerIssueSheet_(sheetName);
  var isWorker = auth && String(auth.role || '').toLowerCase() === 'worker' && isWorkerIssue;
  var workerUser = '';
  var workerTrade = '';
  if (isWorker) {
    workerUser = normalizeWorkerId_(auth.username);
    if (!workerUser) return [];
    workerTrade = normalizeTrade_(auth.trade || tradeForUserRow_(getUserRowByName_(auth.username)));
    ckey = ckey + '_wu_' + workerUser;
  }
  var cached = issuesCacheGet_(ckey);
  if (cached) return cached;
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet||sheet.getLastRow()<2) return [];
  if (isWorkerIssue) ensureExtendedIssueHeaders_(sheet);
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  ensureIssueNums_(sheet, sheetName, rows);
  var routedDisposition = routedDispositionForSheet_(sheetName);
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var dv=rows[i][7]; var ds=(dv instanceof Date)?Utilities.formatDate(dv,tz,'yyyy-MM-dd'):String(dv);
    var st=String(rows[i][10]||'open');
    var fp=String(rows[i][9]||'');
    var assignedGroup = isWorkerIssue ? normalizeTrade_(rows[i][CIVIL_ASSIGNED_COL - 1] || '') : '';
    var assignedWorkers = isWorkerIssue ? parseAssignedWorkers_(rows[i][CIVIL_ASSIGNED_WORKERS_COL - 1]) : [];
    var workersRequired = isWorkerIssue ? parseWorkersRequired_(rows[i][CIVIL_WORKERS_REQUIRED_COL - 1]) : 1;
    var workerCompletions = isWorkerIssue ? parseWorkerCompletions_(rows[i][CIVIL_WORKER_COMPLETIONS_COL - 1]) : [];
    if (isWorker) {
      if (st === 'fixed') continue;
      var disposition = String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim().toLowerCase();
      if (disposition === routedDisposition) continue;
      if (assignedWorkers.length) {
        if (!workerAssignedToIssue_(assignedWorkers, workerUser)) continue;
      } else {
        if (!workerTrade || assignedGroup !== workerTrade) continue;
      }
      if (workerAlreadyCompleted_(workerCompletions, auth.username)) continue;
    }
    var fixedPhotos = st === 'fixed' ? parseFixedPhotosFromCell_(fp) : [];
    if (isWorkerIssue && st !== 'fixed' && workerCompletions.length) {
      fixedPhotos = mergeWorkerCompletionPhotos_(workerCompletions);
    }
    var item = {id:String(rows[i][0]),num:Number(rows[i][ISSUE_NUM_COL-1]||0),project:String(rows[i][1]),building:String(rows[i][2]),floor:String(rows[i][3]),spot:String(rows[i][4]),issueType:String(rows[i][5]),note:String(rows[i][6]||''),date:ds,photo:String(rows[i][8]||''),fixedPhoto:(st==='fixed'?fp:(fixedPhotos.length?formatFixedPhotosForStorage_(fixedPhotos):'')),fixedPhotos:fixedPhotos,status:st,createdBy:String(rows[i][11]||''),createdAt:dtIssue_(rows[i][12]),fixedBy:String(rows[i][13]||''),fixedAt:dtIssue_(rows[i][14]),assignedGroup:assignedGroup};
    if (isWorkerIssue) {
      item.disposition = String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim();
      item.fixDelay = String(rows[i][CIVIL_FIX_DELAY_COL - 1] || '').trim();
      item.assignVoiceNote = parseAssignVoiceNote_(rows[i][CIVIL_ASSIGN_VOICE_COL - 1]);
      item.workersRequired = workersRequired;
      item.workerCompletions = workerCompletions;
      item.workerDone = workerCompletions.length;
      item.assignedWorkers = assignedWorkers;
    }
    out.push(item);
  }
  issuesCachePut_(ckey, out);
  return out;
}

function numToLettersGs_(n) {
  var s = '';
  n = n + 1;
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function issueRefGs_(num) {
  num = Number(num || 0);
  if (!num) return '';
  var idx = num - 1;
  return numToLettersGs_(Math.floor(idx / 999)) + ((idx % 999) + 1);
}
function buildAssignNotifyBody_(issues) {
  if (!issues || !issues.length) return 'Open the app to view details.';
  if (issues.length === 1) {
    var r = issues[0];
    return '#' + issueRefGs_(r.num) + ' ' + r.issueType + ' — ' + r.building + ' · ' + r.floor;
  }
  var parts = [];
  for (var i = 0; i < issues.length && i < 3; i++) {
    parts.push('#' + issueRefGs_(issues[i].num) + ' ' + issues[i].issueType);
  }
  if (issues.length > 3) parts.push('+' + (issues.length - 3) + ' more');
  return parts.join('\n');
}
function ensureWorkerPushSheet_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['username', 'fcmToken', 'platform', 'updatedAt']);
    return;
  }
  var headers = ['username', 'fcmToken', 'platform', 'updatedAt'];
  for (var c = 0; c < headers.length; c++) {
    if (String(sheet.getRange(1, c + 1).getValue() || '') !== headers[c]) {
      sheet.getRange(1, c + 1).setValue(headers[c]);
    }
  }
}
function workerPushPropKey_(username) {
  return 'worker_push_' + String(username || '').trim().toLowerCase();
}
function isKnownWorker_(username) {
  return isKnownWorkerId_(username);
}
function isKnownCivilWorker_(username) {
  return isKnownWorker_(username);
}
/** Fast session lookup for push (cache/properties first, spreadsheet only if needed). */
function pushSessionAuth_(token) {
  if (!token) return {ok:false, error:'No token'};
  try {
    var prop = PropertiesService.getScriptProperties().getProperty(pushAuthPropKey_(token));
    if (prop) {
      var p = JSON.parse(prop);
      if (p && p.username) {
        return enrichAuthRole_({
          ok: true,
          username: p.username,
          dept: String(p.dept || '').trim().toLowerCase(),
          role: String(p.role || '').trim().toLowerCase()
        });
      }
    }
  } catch (e) {}
  try {
    var hit = CacheService.getScriptCache().get(tokenCacheKey_(token));
    if (hit) {
      var cached = sessionCacheValid_(JSON.parse(hit), '');
      if (cached && cached.ok !== false && cached.username) return enrichAuthRole_(cached);
    }
  } catch (e) {}
  return verifyTokenSession_(token);
}
function persistWorkerPushToken_(username, fcmToken, platform) {
  username = String(username || '').trim().toLowerCase();
  fcmToken = String(fcmToken || '').trim();
  platform = String(platform || 'web-fcm').trim();
  var now = new Date().toISOString();
  var rec = {username: username, fcmToken: fcmToken, platform: platform, updatedAt: now};
  PropertiesService.getScriptProperties().setProperty(workerPushPropKey_(username), JSON.stringify(rec));
  var sheetSaved = false;
  try {
    var ss = getSS_();
    var sheet = ss.getSheetByName(WORKER_PUSH_SHEET) || ss.insertSheet(WORKER_PUSH_SHEET);
    ensureWorkerPushSheet_(sheet);
    var rows = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim().toLowerCase() === username) {
        sheet.getRange(i + 1, 2, 1, 3).setValues([[fcmToken, platform, now]]);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([username, fcmToken, platform, now]);
    sheetSaved = true;
  } catch (e) {}
  return {
    ok: true,
    success: true,
    updatedAt: now,
    version: SCRIPT_VERSION,
    username: username,
    sheetSaved: sheetSaved
  };
}
function handleSaveWorkerPushToken_(body) {
  var auth = pushSessionAuth_(body && body.token);
  if (!auth.ok) return auth;
  var username = String(auth.username || '').trim().toLowerCase();
  var role = String(auth.role || '').toLowerCase();
  if (role !== 'worker' && !isKnownWorker_(username)) {
    return {ok:false, error:'not_allowed', message:'Only worker accounts can register push alerts.'};
  }
  if (!tokenDeptAllows_(String(auth.dept || ''), 'civil issue') && !tokenDeptAllows_(String(auth.dept || ''), 'electric issue')) {
    return {ok:false, error:'This login is not allowed for this section'};
  }
  var fcmToken = String((body && (body.fcmToken || body.pushToken)) || '').trim();
  if (!fcmToken) return {ok:false, error:'missing_token', message:'Missing push token.'};
  return persistWorkerPushToken_(username, fcmToken, String((body && body.platform) || 'web-fcm'));
}
function handleTestWorkerPush_(body) {
  var auth = pushSessionAuth_(body && body.token);
  if (!auth.ok) return auth;
  return handleTestWorkerPush(body, auth);
}
function handleDebugWorkerPush_(body) {
  var auth = pushSessionAuth_(body && body.token);
  if (!auth.ok) return auth;
  return handleDebugWorkerPush(body, auth);
}
function getWorkerPushTokens_(usernames) {
  var want = {};
  for (var u = 0; u < usernames.length; u++) {
    var name = String(usernames[u] || '').trim().toLowerCase();
    if (name) want[name] = true;
  }
  if (!Object.keys(want).length) return [];
  var props = PropertiesService.getScriptProperties();
  var out = [];
  Object.keys(want).forEach(function (name) {
    var raw = props.getProperty(workerPushPropKey_(name));
    if (!raw) return;
    try {
      var rec = JSON.parse(raw);
      var token = String((rec && rec.fcmToken) || '').trim();
      if (token) {
        out.push({username:name, fcmToken:token});
        delete want[name];
      }
    } catch (e) {}
  });
  if (!Object.keys(want).length) return out;
  var ss = getSS_();
  var sheet = ss.getSheetByName(WORKER_PUSH_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return out;
  ensureWorkerPushSheet_(sheet);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var user = String(rows[i][0] || '').trim().toLowerCase();
    if (!want[user]) continue;
    var token = String(rows[i][1] || '').trim();
    if (token) out.push({username:user, fcmToken:token});
  }
  return out;
}
function base64UrlEncodeGs_(bytesOrString) {
  var b = (typeof bytesOrString === 'string')
    ? Utilities.newBlob(bytesOrString).getBytes()
    : bytesOrString;
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '');
}
function getFcmAccessTokenDetailed_() {
  var props = PropertiesService.getScriptProperties();
  var saJson = props.getProperty('FCM_SERVICE_ACCOUNT_JSON');
  if (!saJson) return {ok:false, step:'property', error:'FCM_SERVICE_ACCOUNT_JSON not in Script properties'};
  var sa;
  try { sa = JSON.parse(saJson); } catch (e) {
    return {ok:false, step:'parse', error:'Invalid JSON: ' + e};
  }
  if (!sa.client_email || !sa.private_key) {
    return {ok:false, step:'fields', error:'JSON missing client_email or private_key'};
  }
  var now = Math.floor(Date.now() / 1000);
  var header = base64UrlEncodeGs_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim = base64UrlEncodeGs_(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  var unsigned = header + '.' + claim;
  var sig;
  try {
    sig = Utilities.computeRsaSha256Signature(unsigned, sa.private_key);
  } catch (e) {
    return {ok:false, step:'sign', error:'Private key invalid: ' + e};
  }
  var jwt = unsigned + '.' + base64UrlEncodeGs_(sig);
  try {
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var text = resp.getContentText();
    if (code !== 200) {
      return {ok:false, step:'oauth', error:'HTTP ' + code + ': ' + text};
    }
    var parsed = JSON.parse(text);
    if (!parsed.access_token) return {ok:false, step:'oauth', error:'No access_token in response'};
    return {ok:true, token:parsed.access_token, projectId:String(sa.project_id || '')};
  } catch (e) {
    return {ok:false, step:'fetch', error:String(e && e.message ? e.message : e)};
  }
}
function getFcmAccessToken_() {
  var r = getFcmAccessTokenDetailed_();
  return r.ok ? r.token : null;
}
function getFcmProjectId_() {
  var props = PropertiesService.getScriptProperties();
  var pid = String(props.getProperty('FCM_PROJECT_ID') || '').trim();
  if (pid) return pid;
  var saJson = props.getProperty('FCM_SERVICE_ACCOUNT_JSON');
  if (!saJson) return '';
  try {
    var sa = JSON.parse(saJson);
    return String(sa.project_id || '').trim();
  } catch (e) {
    return '';
  }
}
function fcmDataStrings_(data) {
  var out = {};
  if (!data) return out;
  Object.keys(data).forEach(function (k) { out[k] = String(data[k]); });
  return out;
}
function buildFcmDeepLink_(data) {
  var page = (data && (data.deptPage || data.jobPage)) || 'civil-issue.html';
  if (String(page).indexOf('.html') === -1) page = String(page) + '.html';
  var base = 'https://dizayeswar.github.io/Empire-General-Service/' + page;
  var id = data && (data.issueId || data.jobId);
  if (id) return base + '?job=' + encodeURIComponent(String(id));
  return base;
}
function buildFcmMessagePayload_(fcmToken, title, body, data) {
  var link = buildFcmDeepLink_(data || {});
  var fcmData = fcmDataStrings_(data || {});
  fcmData.title = String(title || 'New job assigned');
  fcmData.body = String(body || '');
  // Data-only: avoids duplicate notifications (FCM auto-display + onBackgroundMessage).
  return {
    message: {
      token: fcmToken,
      data: fcmData,
      webpush: {
        headers: { Urgency: 'high', TTL: '86400' },
        fcm_options: { link: link }
      }
    }
  };
}
function handleDebugWorkerPush(body, auth) {
  auth = enrichAuthRole_(auth || {});
  if (String(auth.role || '').toLowerCase() !== 'worker') {
    return {ok:false, error:'not_allowed', message:'Workers only.'};
  }
  var username = String((auth && auth.username) || '').trim().toLowerCase();
  var tokens = getWorkerPushTokens_([username]);
  var hasToken = tokens.length > 0;
  var fcmAuth = !!getFcmAccessToken_();
  var fcmSend = '';
  if (hasToken && fcmAuth) {
    try {
      var result = sendFcmToWorkerDetailed_(tokens[0].fcmToken, 'Diagnostic ping', 'Empire push diagnostic — lock your phone.', {type:'debug'});
      fcmSend = result.ok ? 'OK' : ('FAILED: ' + (result.error || result.code || 'unknown'));
    } catch (e) {
      fcmSend = 'FAILED: ' + String(e && e.message ? e.message : e);
      if (/external_request/i.test(fcmSend)) {
        fcmSend = 'FAILED: Apps Script needs external URL permission — run authorizePushSetup in editor';
      }
    }
  } else if (!hasToken) {
    fcmSend = 'skipped — no token';
  } else {
    fcmSend = 'skipped — FCM auth failed';
  }
  return {
    ok: true,
    success: true,
    hasToken: hasToken,
    fcmAuth: fcmAuth,
    fcmSend: fcmSend,
    username: username,
    version: SCRIPT_VERSION
  };
}
function sendFcmToWorkerDetailed_(fcmToken, title, body, data) {
  if (!fcmToken) return {ok:false, error:'missing_token'};
  var projectId = getFcmProjectId_();
  var accessToken = getFcmAccessToken_();
  if (projectId && accessToken) {
    try {
      var payload = buildFcmMessagePayload_(fcmToken, title, body, data);
      var resp = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      var code = resp.getResponseCode();
      var text = resp.getContentText();
      if (code === 200) return {ok:true, code:code};
      return {ok:false, code:code, error:text || 'FCM send failed'};
    } catch (e) {
      return {ok:false, error:String(e && e.message ? e.message : e)};
    }
  }
  if (!accessToken) return {ok:false, error:'FCM service account missing or invalid'};
  var key = PropertiesService.getScriptProperties().getProperty('FCM_SERVER_KEY');
  if (!key) return {ok:false, error:'FCM not configured'};
  try {
    var legacyPayload = {
      to: fcmToken,
      priority: 'high',
      data: fcmDataStrings_(Object.assign({}, data || {}, {
        title: String(title || 'New job assigned'),
        body: String(body || '')
      }))
    };
    var legacyResp = UrlFetchApp.fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'key=' + key },
      payload: JSON.stringify(legacyPayload),
      muteHttpExceptions: true
    });
    var lcode = legacyResp.getResponseCode();
    if (lcode === 200) return {ok:true, code:lcode};
    return {ok:false, code:lcode, error:legacyResp.getContentText()};
  } catch (e2) {
    return {ok:false, error:String(e2 && e2.message ? e2.message : e2)};
  }
}
function sendFcmToWorker_(fcmToken, title, body, data) {
  return sendFcmToWorkerDetailed_(fcmToken, title, body, data).ok;
}
function handleTestWorkerPush(body, auth) {
  auth = enrichAuthRole_(auth || {});
  if (String(auth.role || '').toLowerCase() !== 'worker') {
    return {ok:false, error:'not_allowed', message:'Only worker accounts can test push alerts.'};
  }
  var username = String((auth && auth.username) || '').trim().toLowerCase();
  var tokens = getWorkerPushTokens_([username]);
  if (!tokens.length) {
    return {ok:false, error:'no_token', message:'No push token saved. Tap Enable alerts first.'};
  }
  if (!getFcmAccessToken_()) {
    return {ok:false, error:'fcm_auth', message:'FCM service account missing or invalid in Script properties.'};
  }
  var result = sendFcmToWorkerDetailed_(tokens[0].fcmToken, 'Test notification', 'Empire EGS alerts are working.', {type:'test'});
  if (result.ok) return {ok:true, success:true, message:'Test notification sent.'};
  return {ok:false, error:'send_failed', message: result.error || 'FCM send failed.'};
}
function notifyWorkersOnAssign_(assignedWorkers, issues, deptPage) {
  if (!assignedWorkers || !assignedWorkers.length || !issues || !issues.length) return;
  var tokens = getWorkerPushTokens_(assignedWorkers);
  if (!tokens.length) return;
  var title = issues.length === 1 ? 'New job assigned' : issues.length + ' jobs assigned';
  var body = buildAssignNotifyBody_(issues);
  if (issues.length === 1) body += ' Open the job to hear the voice note if one was left.';
  var data = { type: 'assign', count: String(issues.length), deptPage: deptPage || 'civil-issue.html' };
  if (issues.length === 1 && issues[0].id) data.issueId = String(issues[0].id);
  for (var t = 0; t < tokens.length; t++) {
    sendFcmToWorker_(tokens[t].fcmToken, title, body, data);
  }
}

function handleAssignCivilIssue(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can assign issues. Your Users sheet role is "' + rp.role + '". Log out and log in again after updating the sheet.'};
  }
  if (rp.perms.assign === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot assign issues.'};
  }
  var assignedWorkers = normalizeAssignedWorkersInput_(body);
  if (assignedWorkers.length > 4) {
    return {ok:false, error:'too_many_workers', message:'Select at most 4 workers.'};
  }
  var group = normalizeTrade_(body.assignedGroup || body.group || primaryTeamForWorkers_(assignedWorkers) || '');
  if (!assignedWorkers.length) group = '';
  else if (!group && body.assignedGroup !== '' && body.group !== '') {
    return {ok:false, error:'invalid_group', message:'Invalid trade group.'};
  }
  var idList = [];
  if (body.ids && Object.prototype.toString.call(body.ids) === '[object Array]') {
    for (var k = 0; k < body.ids.length; k++) {
      var rawId = String(body.ids[k] || '').trim();
      if (rawId) idList.push(rawId);
    }
  } else if (body.id) {
    idList.push(String(body.id));
  }
  if (!idList.length) return {ok:false, error:'missing_id', message:'Select at least one issue.'};
  var workersRequired = assignWorkersRequiredCount_(assignedWorkers);
  if (body.workersRequired !== undefined && body.workersRequired !== null && body.workersRequired !== '') {
    workersRequired = parseWorkersRequired_(body.workersRequired);
  }
  var voiceNote = null;
  if (body.assignVoiceNote && body.assignVoiceNote.url) {
    voiceNote = {
      url: String(body.assignVoiceNote.url || ''),
      by: String((auth && auth.username) || body.assignVoiceNote.by || ''),
      at: String(body.assignVoiceNote.at || ''),
      durationSec: Number(body.assignVoiceNote.durationSec) || 0,
      mimeType: String(body.assignVoiceNote.mimeType || '')
    };
  }
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureCivilIssueHeaders_(sheet);
  if (sheet.getLastRow() < 2) return {ok:false, error:'Issue not found'};
  var want = {};
  for (var w = 0; w < idList.length; w++) want[idList[w]] = true;
  var rows = sheet.getDataRange().getValues();
  var updated = 0;
  var notifyIssues = [];
  for (var i = 1; i < rows.length; i++) {
    if (want[String(rows[i][0])]) {
      if (String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim().toLowerCase() === 'not_civil') continue;
      sheet.getRange(i + 1, CIVIL_ASSIGNED_COL).setValue(group);
      sheet.getRange(i + 1, CIVIL_ASSIGNED_WORKERS_COL).setValue(formatAssignedWorkers_(assignedWorkers));
      if (workersRequired !== null || assignedWorkers.length) {
        sheet.getRange(i + 1, CIVIL_WORKERS_REQUIRED_COL).setValue(workersRequired);
        sheet.getRange(i + 1, CIVIL_WORKER_COMPLETIONS_COL).setValue('');
        sheet.getRange(i + 1, 10).setValue('');
        sheet.getRange(i + 1, 14).setValue('');
        sheet.getRange(i + 1, 15).setValue('');
      }
      if (voiceNote) {
        sheet.getRange(i + 1, CIVIL_ASSIGN_VOICE_COL).setValue(formatAssignVoiceNote_(voiceNote));
      }
      notifyIssues.push({
        id: String(rows[i][0]),
        num: Number(rows[i][ISSUE_NUM_COL - 1] || 0),
        issueType: String(rows[i][5] || ''),
        building: String(rows[i][2] || ''),
        floor: String(rows[i][3] || '')
      });
      updated++;
    }
  }
  if (!updated) return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh the list and try again.'};
  invalidateIssuesCache_(CIVIL_SHEET);
  try { notifyWorkersOnAssign_(assignedWorkers, notifyIssues); } catch (e) {}
  return {ok:true, success:true, assignedGroup:group, assignedWorkers:assignedWorkers, workersRequired:workersRequired || 1, updated:updated};
}

function handleRouteCivilNotDept(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can route issues away from Civil.'};
  }
  if (rp.perms.edit === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot edit issues.'};
  }
  var id = String(body.id || '').trim();
  if (!id) return {ok:false, error:'missing_id', message:'Issue id is required.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureCivilIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  var user = String((auth && auth.username) || '').trim();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    if (String(rows[i][10] || '') === 'fixed') {
      return {ok:false, error:'already_fixed', message:'This issue is already fixed.'};
    }
    sheet.getRange(i + 1, CIVIL_DISPOSITION_COL).setValue('not_civil');
    sheet.getRange(i + 1, CIVIL_FIX_DELAY_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_ASSIGNED_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_ASSIGNED_WORKERS_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_WORKERS_REQUIRED_COL).setValue(1);
    sheet.getRange(i + 1, CIVIL_WORKER_COMPLETIONS_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_ASSIGN_VOICE_COL).setValue('');
    sheet.getRange(i + 1, 10).setValue('');
    var note = String(rows[i][6] || '');
    var stamp = 'Not civil dept — routed by ' + user + ' on ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    if (note.indexOf('Not civil dept') === -1) {
      sheet.getRange(i + 1, 7).setValue(note ? (note + ' | ' + stamp) : stamp);
    }
    invalidateIssuesCache_(CIVIL_SHEET);
    return {ok:true, success:true, disposition:'not_civil'};
  }
  return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh and try again.'};
}

function handleRestoreCivilIssue(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can restore issues to Civil.'};
  }
  if (rp.perms.edit === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot edit issues.'};
  }
  var id = String(body.id || '').trim();
  if (!id) return {ok:false, error:'missing_id', message:'Issue id is required.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureCivilIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    sheet.getRange(i + 1, CIVIL_DISPOSITION_COL).setValue('');
    invalidateIssuesCache_(CIVIL_SHEET);
    return {ok:true, success:true, disposition:''};
  }
  return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh and try again.'};
}

function handleSetCivilFixDelay(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can mark fix delays.'};
  }
  if (rp.perms.edit === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot edit issues.'};
  }
  var id = String(body.id || '').trim();
  if (!id) return {ok:false, error:'missing_id', message:'Issue id is required.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureCivilIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  var user = String((auth && auth.username) || '').trim();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    if (String(rows[i][10] || '') === 'fixed') {
      return {ok:false, error:'already_fixed', message:'This issue is already fixed.'};
    }
    if (String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim().toLowerCase() === 'not_civil') {
      return {ok:false, error:'not_civil', message:'This issue is in Not Civil Department.'};
    }
    var current = String(rows[i][CIVIL_FIX_DELAY_COL - 1] || '').trim().toLowerCase();
    var next = '';
    if (body.toggle) {
      next = current === 'month_plus' ? '' : 'month_plus';
    } else {
      next = String(body.fixDelay || '').trim().toLowerCase() === 'month_plus' ? 'month_plus' : '';
    }
    sheet.getRange(i + 1, CIVIL_FIX_DELAY_COL).setValue(next);
    if (next === 'month_plus') {
      var note = String(rows[i][6] || '');
      var stamp = 'Fix delayed 1+ month — marked by ' + user + ' on ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      if (note.indexOf('Fix delayed 1+ month') === -1) {
        sheet.getRange(i + 1, 7).setValue(note ? (note + ' | ' + stamp) : stamp);
      }
    }
    invalidateIssuesCache_(CIVIL_SHEET);
    return {ok:true, success:true, fixDelay:next};
  }
  return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh and try again.'};
}

function handleAssignElectricIssue(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can assign issues. Your Users sheet role is "' + rp.role + '". Log out and log in again after updating the sheet.'};
  }
  if (rp.perms.assign === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot assign issues.'};
  }
  var assignedWorkers = normalizeAssignedWorkersInput_(body);
  if (assignedWorkers.length > 4) {
    return {ok:false, error:'too_many_workers', message:'Select at most 4 workers.'};
  }
  var group = normalizeTrade_(body.assignedGroup || body.group || primaryTeamForWorkers_(assignedWorkers) || '');
  if (!assignedWorkers.length) group = '';
  else if (!group && body.assignedGroup !== '' && body.group !== '') {
    return {ok:false, error:'invalid_group', message:'Invalid trade group.'};
  }
  var idList = [];
  if (body.ids && Object.prototype.toString.call(body.ids) === '[object Array]') {
    for (var k = 0; k < body.ids.length; k++) {
      var rawId = String(body.ids[k] || '').trim();
      if (rawId) idList.push(rawId);
    }
  } else if (body.id) {
    idList.push(String(body.id));
  }
  if (!idList.length) return {ok:false, error:'missing_id', message:'Select at least one issue.'};
  var workersRequired = assignWorkersRequiredCount_(assignedWorkers);
  if (body.workersRequired !== undefined && body.workersRequired !== null && body.workersRequired !== '') {
    workersRequired = parseWorkersRequired_(body.workersRequired);
  }
  var voiceNote = null;
  if (body.assignVoiceNote && body.assignVoiceNote.url) {
    voiceNote = {
      url: String(body.assignVoiceNote.url || ''),
      by: String((auth && auth.username) || body.assignVoiceNote.by || ''),
      at: String(body.assignVoiceNote.at || ''),
      durationSec: Number(body.assignVoiceNote.durationSec) || 0,
      mimeType: String(body.assignVoiceNote.mimeType || '')
    };
  }
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRIC_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureExtendedIssueHeaders_(sheet);
  if (sheet.getLastRow() < 2) return {ok:false, error:'Issue not found'};
  var want = {};
  for (var w = 0; w < idList.length; w++) want[idList[w]] = true;
  var rows = sheet.getDataRange().getValues();
  var updated = 0;
  var notifyIssues = [];
  for (var i = 1; i < rows.length; i++) {
    if (want[String(rows[i][0])]) {
      if (String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim().toLowerCase() === 'not_electric') continue;
      sheet.getRange(i + 1, CIVIL_ASSIGNED_COL).setValue(group);
      sheet.getRange(i + 1, CIVIL_ASSIGNED_WORKERS_COL).setValue(formatAssignedWorkers_(assignedWorkers));
      if (workersRequired !== null || assignedWorkers.length) {
        sheet.getRange(i + 1, CIVIL_WORKERS_REQUIRED_COL).setValue(workersRequired);
        sheet.getRange(i + 1, CIVIL_WORKER_COMPLETIONS_COL).setValue('');
        sheet.getRange(i + 1, 10).setValue('');
        sheet.getRange(i + 1, 14).setValue('');
        sheet.getRange(i + 1, 15).setValue('');
      }
      if (voiceNote) {
        sheet.getRange(i + 1, CIVIL_ASSIGN_VOICE_COL).setValue(formatAssignVoiceNote_(voiceNote));
      }
      notifyIssues.push({
        id: String(rows[i][0]),
        num: Number(rows[i][ISSUE_NUM_COL - 1] || 0),
        issueType: String(rows[i][5] || ''),
        building: String(rows[i][2] || ''),
        floor: String(rows[i][3] || '')
      });
      updated++;
    }
  }
  if (!updated) return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh the list and try again.'};
  invalidateIssuesCache_(ELECTRIC_SHEET);
  try { notifyWorkersOnAssign_(assignedWorkers, notifyIssues, 'electric-issue.html'); } catch (e) {}
  return {ok:true, success:true, assignedGroup:group, assignedWorkers:assignedWorkers, workersRequired:workersRequired || 1, updated:updated};
}

function handleRouteElectricNotDept(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can route issues away from Electric.'};
  }
  if (rp.perms.edit === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot edit issues.'};
  }
  var id = String(body.id || '').trim();
  if (!id) return {ok:false, error:'missing_id', message:'Issue id is required.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRIC_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureExtendedIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  var user = String((auth && auth.username) || '').trim();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    if (String(rows[i][10] || '') === 'fixed') {
      return {ok:false, error:'already_fixed', message:'This issue is already fixed.'};
    }
    sheet.getRange(i + 1, CIVIL_DISPOSITION_COL).setValue('not_electric');
    sheet.getRange(i + 1, CIVIL_FIX_DELAY_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_ASSIGNED_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_ASSIGNED_WORKERS_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_WORKERS_REQUIRED_COL).setValue(1);
    sheet.getRange(i + 1, CIVIL_WORKER_COMPLETIONS_COL).setValue('');
    sheet.getRange(i + 1, CIVIL_ASSIGN_VOICE_COL).setValue('');
    sheet.getRange(i + 1, 10).setValue('');
    var note = String(rows[i][6] || '');
    var stamp = 'Not electric dept — routed by ' + user + ' on ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    if (note.indexOf('Not electric dept') === -1) {
      sheet.getRange(i + 1, 7).setValue(note ? (note + ' | ' + stamp) : stamp);
    }
    invalidateIssuesCache_(ELECTRIC_SHEET);
    return {ok:true, success:true, disposition:'not_electric'};
  }
  return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh and try again.'};
}

function handleRestoreElectricIssue(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can restore issues to Electric.'};
  }
  if (rp.perms.edit === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot edit issues.'};
  }
  var id = String(body.id || '').trim();
  if (!id) return {ok:false, error:'missing_id', message:'Issue id is required.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRIC_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureExtendedIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    sheet.getRange(i + 1, CIVIL_DISPOSITION_COL).setValue('');
    invalidateIssuesCache_(ELECTRIC_SHEET);
    return {ok:true, success:true, disposition:''};
  }
  return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh and try again.'};
}

function handleSetElectricFixDelay(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : auth.role, urow ? urow[4] : '');
  if (rp.role !== 'admin' && rp.role !== 'editor') {
    return {ok:false, error:'not_allowed', message:'Only editor or admin accounts can mark fix delays.'};
  }
  if (rp.perms.edit === false) {
    return {ok:false, error:'not_allowed', message:'Your account cannot edit issues.'};
  }
  var id = String(body.id || '').trim();
  if (!id) return {ok:false, error:'missing_id', message:'Issue id is required.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRIC_SHEET);
  if (!sheet) return {ok:false, error:'Sheet not found'};
  ensureExtendedIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  var user = String((auth && auth.username) || '').trim();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== id) continue;
    if (String(rows[i][10] || '') === 'fixed') {
      return {ok:false, error:'already_fixed', message:'This issue is already fixed.'};
    }
    if (String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim().toLowerCase() === 'not_electric') {
      return {ok:false, error:'not_electric', message:'This issue is in Not Electric Department.'};
    }
    var current = String(rows[i][CIVIL_FIX_DELAY_COL - 1] || '').trim().toLowerCase();
    var next = '';
    if (body.toggle) {
      next = current === 'month_plus' ? '' : 'month_plus';
    } else {
      next = String(body.fixDelay || '').trim().toLowerCase() === 'month_plus' ? 'month_plus' : '';
    }
    sheet.getRange(i + 1, CIVIL_FIX_DELAY_COL).setValue(next);
    if (next === 'month_plus') {
      var note = String(rows[i][6] || '');
      var stamp = 'Fix delayed 1+ month — marked by ' + user + ' on ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      if (note.indexOf('Fix delayed 1+ month') === -1) {
        sheet.getRange(i + 1, 7).setValue(note ? (note + ' | ' + stamp) : stamp);
      }
    }
    invalidateIssuesCache_(ELECTRIC_SHEET);
    return {ok:true, success:true, fixDelay:next};
  }
  return {ok:false, error:'Issue not found', message:'Issue not found on server. Refresh and try again.'};
}

function ensureWorkerLocationsSheet_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['username', 'trade', 'lat', 'lng', 'accuracy', 'updatedAt']);
    return;
  }
  var headers = ['username', 'trade', 'lat', 'lng', 'accuracy', 'updatedAt'];
  for (var c = 0; c < headers.length; c++) {
    if (String(sheet.getRange(1, c + 1).getValue() || '') !== headers[c]) {
      sheet.getRange(1, c + 1).setValue(headers[c]);
    }
  }
}

function parseWorkerLocationLatLng_(body) {
  var lat = Number(body.lat);
  var lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {lat: lat, lng: lng, accuracy: isFinite(Number(body.accuracy)) ? Number(body.accuracy) : ''};
}

function handleReportWorkerLocation(body, auth) {
  var coords = parseWorkerLocationLatLng_(body);
  if (!coords) return {ok:false, error:'invalid_coords', message:'Invalid GPS coordinates.'};
  var username = String((auth && auth.username) || body.username || '').trim().toLowerCase();
  if (!username) return {ok:false, error:'not_authenticated'};
  var trade = normalizeTrade_((auth && auth.trade) || body._authTrade || tradeForUserRow_(getUserRowByName_(username)));
  if (!trade) return {ok:false, error:'trade_not_set', message:'Worker trade not configured.'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(WORKER_LOCATIONS_SHEET) || ss.insertSheet(WORKER_LOCATIONS_SHEET);
  ensureWorkerLocationsSheet_(sheet);
  var now = new Date().toISOString();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === username) {
      sheet.getRange(i + 1, 1, 1, 6).setValues([[username, trade, coords.lat, coords.lng, coords.accuracy, now]]);
      return {ok:true, success:true, updatedAt:now};
    }
  }
  sheet.appendRow([username, trade, coords.lat, coords.lng, coords.accuracy, now]);
  return {ok:true, success:true, updatedAt:now};
}

function handleGetWorkerLocations(body, auth) {
  auth = enrichAuthRole_(auth || {});
  var role = roleFromAuth_(auth);
  if (role === 'worker') return {ok:false, error:'not_allowed', message:'Workers cannot view live locations.'};
  var urow = getUserRowByName_(auth && auth.username);
  var rp = computePerms_(urow ? urow[3] : role, urow ? urow[4] : '');
  if (rp.perms.liveLocation === false) return {ok:false, error:'not_allowed', message:'Live location is not available for this account.'};
  var tradeFilter = null;
  if (body && body.tradeFilter && Object.prototype.toString.call(body.tradeFilter) === '[object Array]') {
    tradeFilter = {};
    for (var tf = 0; tf < body.tradeFilter.length; tf++) {
      var tradeId = normalizeTrade_(body.tradeFilter[tf]);
      if (tradeId) tradeFilter[tradeId] = 1;
    }
    if (!Object.keys(tradeFilter).length) tradeFilter = null;
  }
  var ss = getSS_();
  var sheet = ss.getSheetByName(WORKER_LOCATIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {ok:true, success:true, workers:[]};
  ensureWorkerLocationsSheet_(sheet);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var user = String(rows[i][0] || '').trim();
    if (!user) continue;
    var trade = normalizeTrade_(rows[i][1] || '');
    if (tradeFilter && !tradeFilter[trade]) continue;
    var lat = Number(rows[i][2]);
    var lng = Number(rows[i][3]);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    out.push({
      username: user,
      trade: trade || String(rows[i][1] || '').trim(),
      lat: lat,
      lng: lng,
      accuracy: rows[i][4] === '' || rows[i][4] === null || rows[i][4] === undefined ? null : Number(rows[i][4]),
      updatedAt: String(rows[i][5] || '').trim()
    });
  }
  out.sort(function (a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  return {ok:true, success:true, workers:out};
}

function parseFixedPhotosFromCell_(raw) {
  raw = String(raw || '').trim();
  if (!raw) return [];
  if (raw.charAt(0) === '[') {
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        var out = [];
        for (var i = 0; i < arr.length; i++) {
          var u = String(arr[i] || '').trim();
          if (u) out.push(u);
        }
        return out;
      }
    } catch (e) {}
  }
  if (raw.indexOf('|') !== -1) {
    var parts = raw.split('|');
    var list = [];
    for (var j = 0; j < parts.length; j++) {
      var p = String(parts[j] || '').trim();
      if (p) list.push(p);
    }
    return list;
  }
  return [raw];
}

function formatFixedPhotosForStorage_(photos) {
  return JSON.stringify(photos || []);
}

function normalizeFixedPhotos_(body) {
  var urls = [];
  if (body.fixedPhotos && body.fixedPhotos.length) {
    for (var i = 0; i < body.fixedPhotos.length; i++) {
      var u = String(body.fixedPhotos[i] || '').trim();
      if (u) urls.push(u);
    }
  }
  if (!urls.length) {
    urls = parseFixedPhotosFromCell_(String(body.fixedPhoto || '').trim());
  }
  return urls;
}

function handleMarkFixed(body, sheetName, auth) {
  var photos = normalizeFixedPhotos_(body);
  if (!photos.length) return {ok:false, error:'photo_required', message:'A completion photo is required.'};
  var stored = formatFixedPhotosForStorage_(photos);
  var fixedBy = String((auth && auth.username) || body.username || '').trim();
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var isWorkerIssue = isWorkerIssueSheet_(sheetName);
  if (isWorkerIssue) ensureExtendedIssueHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  var role = String((auth && auth.role) || body._authRole || '').toLowerCase();
  var workerTrade = '';
  var routedDisposition = routedDispositionForSheet_(sheetName);
  if (role === 'worker' && isWorkerIssue) {
    workerTrade = normalizeTrade_((auth && auth.trade) || body._authTrade || tradeForUserRow_(getUserRowByName_(body.username)));
  }
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      if (isWorkerIssue && String(rows[i][CIVIL_DISPOSITION_COL - 1] || '').trim().toLowerCase() === routedDisposition) {
        var deptLabel = sheetName === ELECTRIC_SHEET ? 'Electric' : 'Civil';
        return {ok:false, error:routedDisposition, message:'This issue was routed out of ' + deptLabel + ' department.'};
      }
      if (role === 'worker' && isWorkerIssue) {
        var ag = normalizeTrade_(rows[i][CIVIL_ASSIGNED_COL - 1] || '');
        var assignedWorkers = parseAssignedWorkers_(rows[i][CIVIL_ASSIGNED_WORKERS_COL - 1]);
        if (assignedWorkers.length) {
          if (!workerAssignedToIssue_(assignedWorkers, fixedBy)) {
            return {ok:false, error:'not_assigned', message:'This issue is not assigned to you.'};
          }
        } else {
          if (!workerTrade) return {ok:false, error:'trade_not_set', message:'Worker trade not configured for legacy team jobs.'};
          if (ag !== workerTrade) return {ok:false, error:'not_assigned', message:'This issue is not assigned to your team.'};
        }
        if (String(rows[i][10] || '') === 'fixed') return {ok:false, error:'already_fixed', message:'This issue is already fixed.'};
        var workersRequired = parseWorkersRequired_(rows[i][CIVIL_WORKERS_REQUIRED_COL - 1]);
        var completions = parseWorkerCompletions_(rows[i][CIVIL_WORKER_COMPLETIONS_COL - 1]);
        if (workerAlreadyCompleted_(completions, fixedBy)) {
          return {ok:false, error:'already_submitted', message:'You already submitted your fix for this job.'};
        }
        var fixLoc = parseWorkerLocationLatLng_(body);
        var completion = {
          user: fixedBy,
          photos: photos,
          photoSources: normalizePhotoSources_(body, photos.length),
          at: new Date().toISOString(),
          note: String(body.fixNote || '').trim()
        };
        if (fixLoc) {
          completion.lat = fixLoc.lat;
          completion.lng = fixLoc.lng;
          completion.accuracy = fixLoc.accuracy;
        }
        completions.push(completion);
        sheet.getRange(i+1, CIVIL_WORKER_COMPLETIONS_COL).setValue(formatWorkerCompletions_(completions));
        var allPhotos = mergeWorkerCompletionPhotos_(completions);
        sheet.getRange(i+1,10).setValue(formatFixedPhotosForStorage_(allPhotos));
        if (completions.length < workersRequired) {
          sheet.getRange(i+1,14).setValue(fixedBy + ' (' + completions.length + '/' + workersRequired + ')');
          invalidateIssuesCache_(sheetName);
          return {ok:true, success:true, partial:true, workerDone:completions.length, workersRequired:workersRequired, workerCompletions:completions};
        }
        sheet.getRange(i+1,11).setValue('fixed');
        if (isWorkerIssue) sheet.getRange(i+1, CIVIL_FIX_DELAY_COL).setValue('');
        var allBy = [];
        for (var c = 0; c < completions.length; c++) {
          var nm = String((completions[c] && completions[c].user) || '').trim();
          if (nm && allBy.indexOf(nm) === -1) allBy.push(nm);
        }
        sheet.getRange(i+1,14).setValue(allBy.join(', ') || fixedBy);
        sheet.getRange(i+1,15).setValue(new Date().toISOString());
        if (body.fixNote) sheet.getRange(i+1,7).setValue(String(rows[i][6]||'') + (rows[i][6] ? ' | ' : '') + 'Fix: ' + String(body.fixNote));
        invalidateIssuesCache_(sheetName);
        return {ok:true, success:true, partial:false, workerDone:completions.length, workersRequired:workersRequired};
      }
      if (role !== 'worker' && body.fixedByName) fixedBy = String(body.fixedByName || fixedBy);
      sheet.getRange(i+1,10).setValue(stored);
      sheet.getRange(i+1,11).setValue('fixed');
      if (isWorkerIssue) sheet.getRange(i+1, CIVIL_FIX_DELAY_COL).setValue('');
      sheet.getRange(i+1,15).setValue(new Date().toISOString());
      if (body.fixNote) sheet.getRange(i+1,7).setValue(String(rows[i][6]||'') + (rows[i][6] ? ' | ' : '') + 'Fix: ' + String(body.fixNote));
      invalidateIssuesCache_(sheetName);
      return {ok:true,success:true};
    }
  }
  return {ok:false,error:'Issue not found'};
}

function handleClearIssues(body, sheetName) {
  if (String((body && body.resetPassword)||'') !== RESET_PASSWORD) return {ok:false,success:false,error:'bad_password'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (sheet && sheet.getLastRow()>1) { var _r=sheet.getDataRange().getValues(); trashRows_(sheetName,_r.slice(1),'reset',body.username); sheet.deleteRows(2,sheet.getLastRow()-1); }
  try { PropertiesService.getScriptProperties().deleteProperty(issnumKey_(sheetName)); } catch(e){}
  invalidateIssuesCache_(sheetName);
  return {ok:true,success:true};
}

function handleAddElectricalJob(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_JOBS_SHEET) || ss.insertSheet(ELECTRICAL_JOBS_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['id','date','job','location','materials','staff','type','photo','notes','createdBy','createdAt','amount']);
  var id = body.id || ('job-' + new Date().getTime());
  sheet.appendRow([id, body.date||'', body.job||'', body.location||'', body.materials||'', body.staff||'', body.type||'', body.photo||'', body.notes||'', body.username||'', new Date().toISOString(), body.amount||'']);
  return {ok:true, success:true, id:id};
}

function handleGetElectricalJobs(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_JOBS_SHEET);
  if (!sheet||sheet.getLastRow()<2) return [];
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var jobs = [];
  for (var i=1;i<rows.length;i++) {
    var dv = rows[i][1];
    var ds = (dv instanceof Date) ? Utilities.formatDate(dv, tz, 'yyyy-MM-dd') : String(dv);
    jobs.push({id:rows[i][0],date:ds,job:rows[i][2],location:rows[i][3],materials:rows[i][4],staff:rows[i][5],type:rows[i][6],photo:rows[i][7],notes:rows[i][8],createdBy:rows[i][9],createdAt:rows[i][10],amount:rows[i][11]||''});
  }
  return jobs;
}

function handleUpdateElectricalJob(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_JOBS_SHEET);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      sheet.getRange(i+1,2,1,11).setValues([[body.date||'', body.job||'', body.location||'', body.materials||'', body.staff||'', body.type||'', body.photo||'', body.notes||'', rows[i][9], rows[i][10], body.amount||'']]);
      return {ok:true,success:true};
    }
  }
  return {ok:false,error:'Job not found'};
}

function handleDeleteElectricalJob(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_JOBS_SHEET);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) { trashRows_(ELECTRICAL_JOBS_SHEET,[rows[i]],'delete',body.username); sheet.deleteRow(i+1); return {ok:true,success:true}; }
  }
  return {ok:false,error:'Job not found'};
}

function handleClearElectricalJobs(body) {
  if (String((body && body.resetPassword) || '') !== RESET_PASSWORD) return {ok:false,success:false,error:'bad_password'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_JOBS_SHEET);
  if (sheet && sheet.getLastRow()>1) { var _r=sheet.getDataRange().getValues(); trashRows_(ELECTRICAL_JOBS_SHEET,_r.slice(1),'reset',body.username); sheet.deleteRows(2,sheet.getLastRow()-1); }
  return {ok:true,success:true};
}

function handleGetElectricalSummary(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_SUMMARY_SHEET);
  if (!sheet||sheet.getLastRow()<2) return {ok:true,text:''};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.month)) return {ok:true,text:String(rows[i][1]||'')};
  }
  return {ok:true,text:''};
}

function handleSaveElectricalSummary(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRICAL_SUMMARY_SHEET) || ss.insertSheet(ELECTRICAL_SUMMARY_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['month','text','savedBy','savedAt']);
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.month)) {
      sheet.getRange(i+1,2,1,3).setValues([[body.text||'', body.username||'', new Date().toISOString()]]);
      return {ok:true,success:true};
    }
  }
  sheet.appendRow([body.month, body.text||'', body.username||'', new Date().toISOString()]);
  return {ok:true,success:true};
}

function ensureElectricWorkerReportsSheet_(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id','date','place','note','photo','voiceNote','reportedBy','workerName','createdAt']);
    return;
  }
  var headers = ['id','date','place','note','photo','voiceNote','reportedBy','workerName','createdAt'];
  for (var c = 0; c < headers.length; c++) {
    if (String(sheet.getRange(1, c + 1).getValue() || '') !== headers[c]) {
      sheet.getRange(1, c + 1).setValue(headers[c]);
    }
  }
}

function handleAddElectricWorkerReport(body, auth) {
  var place = String(body.place || body.location || '').trim();
  var note = String(body.note || body.notes || '').trim();
  var photo = String(body.photo || '').trim();
  var voiceNote = body.voiceNote || null;
  if (voiceNote && typeof voiceNote === 'object') voiceNote = formatAssignVoiceNote_(voiceNote);
  else voiceNote = String(voiceNote || '').trim();
  if (!place && !note && !photo && !voiceNote) {
    return {ok:false,success:false,error:'empty_report',message:'Add a place, note, photo, or voice recording before submitting.'};
  }
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRIC_WORKER_REPORTS_SHEET) || ss.insertSheet(ELECTRIC_WORKER_REPORTS_SHEET);
  ensureElectricWorkerReportsSheet_(sheet);
  var tz = ss.getSpreadsheetTimeZone();
  var now = new Date();
  var dateStr = String(body.date || '').trim();
  if (!dateStr) dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var username = normalizeWorkerId_(auth && auth.username);
  var workerName = String(body.workerName || body.displayName || username || '').trim();
  var id = body.id || ('ewr-' + now.getTime());
  sheet.appendRow([
    id,
    dateStr,
    place,
    note,
    photo,
    voiceNote,
    username,
    workerName,
    now.toISOString()
  ]);
  return {ok:true,success:true,id:id};
}

function handleGetElectricWorkerReports(body, auth) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(ELECTRIC_WORKER_REPORTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  ensureElectricWorkerReportsSheet_(sheet);
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var workerOnly = auth && String(auth.role || '').toLowerCase() === 'worker';
  var workerUser = workerOnly ? normalizeWorkerId_(auth.username) : '';
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var reportedBy = normalizeWorkerId_(rows[i][6]);
    if (workerOnly && reportedBy !== workerUser) continue;
    var dv = rows[i][1];
    var ds = (dv instanceof Date) ? Utilities.formatDate(dv, tz, 'yyyy-MM-dd') : String(dv || '');
    out.push({
      id: String(rows[i][0] || ''),
      date: ds,
      place: String(rows[i][2] || ''),
      note: String(rows[i][3] || ''),
      photo: String(rows[i][4] || ''),
      voiceNote: parseAssignVoiceNote_(rows[i][5]),
      reportedBy: String(rows[i][6] || ''),
      workerName: String(rows[i][7] || ''),
      createdAt: dtIssue_(rows[i][8])
    });
  }
  out.sort(function (a, b) {
    return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''));
  });
  return out;
}

/* ===== Civil Department jobs (mirrors Electrical, separate storage) ===== */
function handleAddCivilJob(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_JOBS_SHEET) || ss.insertSheet(CIVIL_JOBS_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['id','date','job','location','materials','staff','type','photo','notes','createdBy','createdAt','amount']);
  var id = body.id || ('cjob-' + new Date().getTime());
  sheet.appendRow([id, body.date||'', body.job||'', body.location||'', body.materials||'', body.staff||'', body.type||'', body.photo||'', body.notes||'', body.username||'', new Date().toISOString(), body.amount||'']);
  return {ok:true, success:true, id:id};
}

function handleGetCivilJobs(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_JOBS_SHEET);
  if (!sheet||sheet.getLastRow()<2) return [];
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var jobs = [];
  for (var i=1;i<rows.length;i++) {
    var dv = rows[i][1];
    var ds = (dv instanceof Date) ? Utilities.formatDate(dv, tz, 'yyyy-MM-dd') : String(dv);
    jobs.push({id:rows[i][0],date:ds,job:rows[i][2],location:rows[i][3],materials:rows[i][4],staff:rows[i][5],type:rows[i][6],photo:rows[i][7],notes:rows[i][8],createdBy:rows[i][9],createdAt:rows[i][10],amount:rows[i][11]||''});
  }
  return jobs;
}

function handleUpdateCivilJob(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_JOBS_SHEET);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      sheet.getRange(i+1,2,1,11).setValues([[body.date||'', body.job||'', body.location||'', body.materials||'', body.staff||'', body.type||'', body.photo||'', body.notes||'', rows[i][9], rows[i][10], body.amount||'']]);
      return {ok:true,success:true};
    }
  }
  return {ok:false,error:'Job not found'};
}

function handleDeleteCivilJob(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_JOBS_SHEET);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) { trashRows_(CIVIL_JOBS_SHEET,[rows[i]],'delete',body.username); sheet.deleteRow(i+1); return {ok:true,success:true}; }
  }
  return {ok:false,error:'Job not found'};
}

function handleClearCivilJobs(body) {
  if (String((body && body.resetPassword) || '') !== RESET_PASSWORD) return {ok:false,success:false,error:'bad_password'};
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_JOBS_SHEET);
  if (sheet && sheet.getLastRow()>1) { var _r=sheet.getDataRange().getValues(); trashRows_(CIVIL_JOBS_SHEET,_r.slice(1),'reset',body.username); sheet.deleteRows(2,sheet.getLastRow()-1); }
  return {ok:true,success:true};
}

function handleGetCivilSummary(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_SUMMARY_SHEET);
  if (!sheet||sheet.getLastRow()<2) return {ok:true,text:''};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.month)) return {ok:true,text:String(rows[i][1]||'')};
  }
  return {ok:true,text:''};
}

function handleSaveCivilSummary(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CIVIL_SUMMARY_SHEET) || ss.insertSheet(CIVIL_SUMMARY_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['month','text','savedBy','savedAt']);
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.month)) {
      sheet.getRange(i+1,2,1,3).setValues([[body.text||'', body.username||'', new Date().toISOString()]]);
      return {ok:true,success:true};
    }
  }
  sheet.appendRow([body.month, body.text||'', body.username||'', new Date().toISOString()]);
  return {ok:true,success:true};
}

/* ===== Recycle Bin (trash + restore, all sections) ===== */
function trashRows_(sourceSheet, rowList, reason, username) {
  if (!rowList || !rowList.length) return '';
  var ss = getSS_();
  var t = ss.getSheetByName(TRASH_SHEET) || ss.insertSheet(TRASH_SHEET);
  if (t.getLastRow()===0) t.appendRow(['trashId','sourceSheet','rowJson','deletedBy','deletedAt','reason','batchId']);
  var batchId = 'b-' + new Date().getTime();
  var now = new Date().toISOString();
  var out = [];
  for (var i=0;i<rowList.length;i++) {
    out.push(['t-' + Utilities.getUuid(), sourceSheet, JSON.stringify(rowList[i]), username||'', now, reason||'delete', batchId]);
  }
  t.getRange(t.getLastRow()+1, 1, out.length, 7).setValues(out);
  return batchId;
}

function handleGetTrash(body) {
  var ss = getSS_();
  var t = ss.getSheetByName(TRASH_SHEET);
  if (!t || t.getLastRow()<2) return [];
  var filter = body.sheets || null;
  var rows = t.getDataRange().getValues();
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var src = String(rows[i][1]);
    if (filter && filter.indexOf(src)===-1) continue;
    var preview = '', meta = {};
    try {
      var arr = JSON.parse(rows[i][2]);
      meta = trashIssueMetaFromRow_(src, arr);
      var parts = [];
      if (meta.num) parts.push('#' + meta.num);
      if (meta.issueType) parts.push(meta.issueType);
      if (meta.building || meta.floor) parts.push((meta.building||'') + '-' + (meta.floor||''));
      if (parts.length) preview = parts.join('  ·  ');
      else {
        for (var j=1;j<arr.length;j++){ var v=arr[j]; if(v!==''&&v!=null){ var sv=String(v); if(sv.indexOf('http')===0) sv='[photo]'; parts.push(sv); } }
        preview = parts.slice(0,5).join('  ·  ');
      }
    } catch(e) {}
    var item = {trashId:String(rows[i][0]), sourceSheet:src, preview:preview, deletedBy:String(rows[i][3]||''), deletedAt:String(rows[i][4]||''), reason:String(rows[i][5]||''), batchId:String(rows[i][6]||'')};
    if (meta.num) item.num = meta.num;
    if (meta.issueType) item.issueType = meta.issueType;
    if (meta.building) item.building = meta.building;
    if (meta.floor) item.floor = meta.floor;
    if (meta.spot) item.spot = meta.spot;
    if (meta.project) item.project = meta.project;
    if (meta.photo) item.photo = meta.photo;
    if (meta.fixedPhoto) item.fixedPhoto = meta.fixedPhoto;
    if (meta.status) item.status = meta.status;
    out.push(item);
  }
  out.reverse();
  return out;
}

function trashIssueMetaFromRow_(sourceSheet, arr) {
  if (!arr || !arr.length) return {};
  if (sourceSheet !== CIVIL_SHEET && sourceSheet !== ELECTRIC_SHEET && sourceSheet !== FIRE_SHEET) return {};
  var photo = String(arr[8] || '');
  var fixedRaw = String(arr[9] || '');
  var fixedPhoto = fixedRaw.indexOf('http') === 0 ? fixedRaw : '';
  return {
    id: String(arr[0] || ''),
    project: String(arr[1] || ''),
    building: String(arr[2] || ''),
    floor: String(arr[3] || ''),
    spot: String(arr[4] || ''),
    issueType: String(arr[5] || ''),
    photo: photo.indexOf('http') === 0 ? photo : '',
    fixedPhoto: fixedPhoto,
    status: String(arr[10] || ''),
    num: Number(arr[ISSUE_NUM_COL - 1] || 0) || 0
  };
}

function handleRestoreTrash(body) {
  var ss = getSS_();
  var t = ss.getSheetByName(TRASH_SHEET);
  if (!t || t.getLastRow()<2) return {ok:true,success:true,restored:0};
  var ids = body.trashIds || (body.trashId ? [body.trashId] : null);
  var batchId = body.batchId || null;
  var sheets = body.sheets || null;
  var rows = t.getDataRange().getValues();
  var toDelete = [], restored = 0, restoredSheets = {};
  for (var i=1;i<rows.length;i++) {
    var src = String(rows[i][1]); var match=false;
    if (ids) match = ids.indexOf(String(rows[i][0]))!==-1;
    else if (batchId) match = String(rows[i][6])===batchId;
    else if (sheets) match = sheets.indexOf(src)!==-1;
    if (!match) continue;
    try {
      var arr = JSON.parse(rows[i][2]);
      var dst = ss.getSheetByName(src) || ss.insertSheet(src);
      if (isWorkerIssueSheet_(src)) ensureExtendedIssueHeaders_(dst);
      dst.appendRow(arr);
      restored++;
      restoredSheets[src] = true;
      toDelete.push(i+1);
    } catch(e) {}
  }
  toDelete.sort(function(a,b){return b-a;}).forEach(function(r){ t.deleteRow(r); });
  Object.keys(restoredSheets).forEach(function(s){ invalidateIssuesCache_(s); });
  return {ok:true,success:true,restored:restored};
}

function handlePurgeTrash(body) {
  var ss = getSS_();
  var t = ss.getSheetByName(TRASH_SHEET);
  if (!t || t.getLastRow()<2) return {ok:true,success:true,purged:0};
  var ids = body.trashIds || (body.trashId ? [body.trashId] : null);
  var batchId = body.batchId || null;
  var sheets = body.sheets || null;
  var rows = t.getDataRange().getValues();
  var toDelete = [], purged = 0;
  for (var i=1;i<rows.length;i++) {
    var src = String(rows[i][1]); var match=false;
    if (ids) match = ids.indexOf(String(rows[i][0]))!==-1;
    else if (batchId) match = String(rows[i][6])===batchId;
    else if (sheets) match = sheets.indexOf(src)!==-1;
    if (!match) continue;
    toDelete.push(i+1); purged++;
  }
  toDelete.sort(function(a,b){return b-a;}).forEach(function(r){ t.deleteRow(r); });
  return {ok:true,success:true,purged:purged};
}

function handleGetUiSettings(body) {
  var v = PropertiesService.getScriptProperties().getProperty('uiSettings_cleaning');
  var settings = null;
  try { settings = v ? JSON.parse(v) : null; } catch(e) {}
  return {ok:true, success:true, settings:settings};
}

function handleSaveUiSettings(body) {
  PropertiesService.getScriptProperties().setProperty('uiSettings_cleaning', JSON.stringify(body.settings||{}));
  return {ok:true, success:true};
}

function handleDeleteIssue(body, sheetName) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var ids = body.ids && body.ids.length ? body.ids : (body.id ? [body.id] : []);
  if (!ids.length) return {ok:false,error:'No id'};
  var idSet = {};
  for (var k = 0; k < ids.length; k++) idSet[String(ids[k])] = true;
  var rows = sheet.getDataRange().getValues();
  var toTrash = [], toDeleteRows = [];
  for (var i=1;i<rows.length;i++) {
    if (idSet[String(rows[i][0])]) {
      toTrash.push(rows[i]);
      toDeleteRows.push(i+1);
    }
  }
  if (!toTrash.length) return {ok:false,error:'Issue not found'};
  trashRows_(sheetName, toTrash, 'delete', body.username);
  toDeleteRows.sort(function(a,b){return b-a;}).forEach(function(r){ sheet.deleteRow(r); });
  invalidateIssuesCache_(sheetName);
  return {ok:true,success:true,deleted:toTrash.length};
}

/** Run once in Apps Script editor (Run ▶ authorizePushSetup) to grant FCM send permission. */
function authorizePushSetup() {
  var sa = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT_JSON');
  if (!sa) {
    Logger.log('ERROR: FCM_SERVICE_ACCOUNT_JSON missing.');
    Logger.log('Fix: Set FCM_SERVICE_ACCOUNT_JSON in Script properties (Project settings → Script properties).');
    return;
  }
  Logger.log('Service account JSON length: ' + sa.length);
  if (sa.indexOf('client_email') === -1 || sa.indexOf('private_key') === -1) {
    Logger.log('ERROR: Property does not look like service account JSON.');
    Logger.log('Fix: Re-save FCM_SERVICE_ACCOUNT_JSON in Script properties.');
    return;
  }
  var auth = getFcmAccessTokenDetailed_();
  if (!auth.ok) {
    Logger.log('ERROR at step "' + auth.step + '": ' + auth.error);
    return;
  }
  Logger.log('SUCCESS: FCM auth OK (token length ' + auth.token.length + ').');
  var fcmToken = '';
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (fcmToken || k.indexOf('worker_push_') !== 0) return;
    try {
      var rec = JSON.parse(all[k]);
      if (rec && rec.fcmToken) fcmToken = String(rec.fcmToken).trim();
    } catch (e) {}
  });
  if (!fcmToken) {
    var sheet = getSS_().getSheetByName(WORKER_PUSH_SHEET);
    if (sheet && sheet.getLastRow() >= 2) {
      for (var r = 2; r <= sheet.getLastRow(); r++) {
        fcmToken = String(sheet.getRange(r, 2).getValue() || '').trim();
        if (fcmToken) break;
      }
    }
  }
  if (!fcmToken) {
    Logger.log('No worker push token yet — worker taps Enable alerts on phone first.');
    return;
  }
  var result = sendFcmToWorkerDetailed_(fcmToken, 'Empire test', 'Lock-screen push test from server.', {type: 'auth_test'});
  Logger.log('Push send: ' + JSON.stringify(result));
}

/** Run in editor to confirm push-token storage works (no phone needed). */
function checkWorkerPushStorage() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var found = [];
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('worker_push_') === 0) found.push(k);
  });
  Logger.log('SCRIPT_VERSION=' + SCRIPT_VERSION);
  Logger.log('worker_push keys: ' + (found.length ? found.join(', ') : '(none yet)'));
  Logger.log('Open this URL in a browser to verify the LIVE deploy version:');
  Logger.log('(Deploy → Manage deployments → copy Web app URL)');
}

// ===== ImgBB → Supabase photo migration (run from Apps Script editor) =====
// Script Properties (Project settings → Script properties):
//   SUPABASE_URL          e.g. https://abcdefgh.supabase.co
//   SUPABASE_SERVICE_KEY  service_role key (never put in config.js / frontend)
//   SUPABASE_BUCKET       optional, default empire-photos
var MIGRATION_LOG_SHEET = 'PhotoMigrationLog';

function getSupabaseMigrationProps_() {
  var p = PropertiesService.getScriptProperties();
  return {
    url: String(p.getProperty('SUPABASE_URL') || '').replace(/\/$/, ''),
    serviceKey: String(p.getProperty('SUPABASE_SERVICE_KEY') || ''),
    bucket: String(p.getProperty('SUPABASE_BUCKET') || 'empire-photos')
  };
}

function isImgbbUrl_(u) {
  u = String(u || '').trim().toLowerCase();
  if (u.indexOf('http') !== 0) return false;
  if (u.indexOf('|') !== -1) return false;
  return u.indexOf('i.ibb.co') !== -1 || u.indexOf('ibb.co/') !== -1 || u.indexOf('imgbb.com') !== -1;
}

function migratePipeSeparatedPhotos_(s, folder, cache) {
  if (String(s || '').indexOf('|') === -1) return null;
  var parts = String(s).split('|');
  var out = [];
  var changed = false;
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (isImgbbUrl_(part)) {
      var nu = migrateOneImgbbUrl_(part, folder, cache);
      out.push(nu);
      if (nu !== part) changed = true;
    } else {
      out.push(part);
    }
  }
  return changed ? out.join('|') : null;
}

function supabasePublicUrl_(path) {
  var cfg = getSupabaseMigrationProps_();
  return cfg.url + '/storage/v1/object/public/' + cfg.bucket + '/' + String(path || '').replace(/^\/+/, '');
}

function migrationLogSheet_() {
  var ss = getSS_();
  var sheet = ss.getSheetByName(MIGRATION_LOG_SHEET) || ss.insertSheet(MIGRATION_LOG_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(['oldUrl', 'newUrl', 'source', 'row', 'col', 'migratedAt']);
  return sheet;
}

function migrationMapFromLog_() {
  var sheet = migrationLogSheet_();
  var map = {};
  if (sheet.getLastRow() < 2) return map;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var oldU = String(rows[i][0] || '');
    var newU = String(rows[i][1] || '');
    if (oldU && newU.indexOf('http') === 0) map[oldU] = newU;
  }
  return map;
}

function logMigration_(oldUrl, newUrl, source, row, col) {
  migrationLogSheet_().appendRow([oldUrl, newUrl, source, row, col, new Date().toISOString()]);
}

function uploadBytesToSupabase_(bytes, path, contentType) {
  var cfg = getSupabaseMigrationProps_();
  if (!cfg.url || !cfg.serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Script Properties');
  var url = cfg.url + '/storage/v1/object/' + cfg.bucket + '/' + path;
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: contentType || 'image/jpeg',
    payload: bytes,
    headers: {
      Authorization: 'Bearer ' + cfg.serviceKey,
      apikey: cfg.serviceKey,
      'x-upsert': 'true'
    }
  });
  if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) return supabasePublicUrl_(path);
  throw new Error('Supabase upload failed (' + resp.getResponseCode() + '): ' + resp.getContentText().slice(0, 240));
}

function migrateOneImgbbUrl_(oldUrl, folder, cache) {
  oldUrl = String(oldUrl || '').trim();
  if (!oldUrl || !isImgbbUrl_(oldUrl)) return oldUrl;
  if (cache[oldUrl]) return cache[oldUrl];
  var resp = UrlFetchApp.fetch(oldUrl, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() !== 200) throw new Error('Download failed (' + resp.getResponseCode() + ') for ' + oldUrl);
  var blob = resp.getBlob();
  var ct = blob.getContentType() || 'image/jpeg';
  var ext = 'jpg';
  if (String(ct).indexOf('png') !== -1) ext = 'png';
  else if (String(ct).indexOf('webp') !== -1) ext = 'webp';
  else if (String(ct).indexOf('gif') !== -1) ext = 'gif';
  var safeFolder = String(folder || 'misc').replace(/[^a-zA-Z0-9/_-]+/g, '-');
  var path = 'migrated/' + safeFolder + '/' + Utilities.getUuid() + '.' + ext;
  var newUrl = uploadBytesToSupabase_(blob.getBytes(), path, ct);
  cache[oldUrl] = newUrl;
  return newUrl;
}

function migrateImgbbValue_(value, folder, cache) {
  if (value === null || value === undefined || value === '') return value;
  if (Object.prototype.toString.call(value) === '[object Array]') {
    var changedArr = false;
    var arr = [];
    for (var ai = 0; ai < value.length; ai++) {
      var nextItem = migrateImgbbValue_(value[ai], folder, cache);
      if (nextItem !== value[ai]) changedArr = true;
      arr.push(nextItem);
    }
    return changedArr ? arr : value;
  }
  if (value && typeof value === 'object') {
    var changedObj = false;
    var outObj = {};
    Object.keys(value).forEach(function (k) {
      var nextKey = migrateImgbbValue_(value[k], folder, cache);
      if (nextKey !== value[k]) changedObj = true;
      outObj[k] = nextKey;
    });
    return changedObj ? outObj : value;
  }
  var s = String(value).trim();
  var piped = migratePipeSeparatedPhotos_(s, folder, cache);
  if (piped !== null) return piped;
  if (isImgbbUrl_(s)) return migrateOneImgbbUrl_(s, folder, cache);
  if (s.charAt(0) === '[' || s.charAt(0) === '{') {
    try {
      var parsed = JSON.parse(s);
      var nextParsed = migrateImgbbValue_(parsed, folder, cache);
      if (nextParsed !== parsed) {
        return typeof value === 'string' ? JSON.stringify(nextParsed) : nextParsed;
      }
    } catch (e) {}
  }
  return value;
}

function valueContainsImgbbUrl_(value) {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') {
    var s = value.trim();
    if (s.indexOf('|') !== -1) {
      var parts = s.split('|');
      for (var pi = 0; pi < parts.length; pi++) {
        if (isImgbbUrl_(parts[pi].trim())) return true;
      }
    }
    if (isImgbbUrl_(s)) return true;
    if (s.charAt(0) === '[' || s.charAt(0) === '{') {
      try { return valueContainsImgbbUrl_(JSON.parse(s)); } catch (e) {}
    }
    return false;
  }
  if (Object.prototype.toString.call(value) === '[object Array]') {
    for (var i = 0; i < value.length; i++) {
      if (valueContainsImgbbUrl_(value[i])) return true;
    }
    return false;
  }
  if (typeof value === 'object') {
    var keys = Object.keys(value);
    for (var j = 0; j < keys.length; j++) {
      if (valueContainsImgbbUrl_(value[keys[j]])) return true;
    }
  }
  return false;
}

function fixImgbbDeep_(value, folder, cache) {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value === 'string') {
    var s = value.trim();
    var piped = migratePipeSeparatedPhotos_(s, folder, cache);
    if (piped !== null) return piped;
    if (isImgbbUrl_(s)) return migrateOneImgbbUrl_(s, folder, cache);
    if (s.charAt(0) === '[' || s.charAt(0) === '{') {
      try { return JSON.stringify(fixImgbbDeep_(JSON.parse(s), folder, cache)); } catch (e) {}
    }
    return value;
  }
  if (Object.prototype.toString.call(value) === '[object Array]') {
    var arr = [];
    for (var i = 0; i < value.length; i++) arr.push(fixImgbbDeep_(value[i], folder, cache));
    return arr;
  }
  if (typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (k) { out[k] = fixImgbbDeep_(value[k], folder, cache); });
    return out;
  }
  return value;
}

function collectImgbbMigrationTasks_() {
  var ss = getSS_();
  var tasks = [];
  function addSimple(sheetName, row, col, folder) {
    tasks.push({ kind: 'cell', sheetName: sheetName, row: row, col: col, folder: folder });
  }
  function scanSheet(sheetName, cols, folder) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var rows = sheet.getDataRange().getValues();
    for (var r = 1; r < rows.length; r++) {
      for (var c = 0; c < cols.length; c++) {
        var col = cols[c];
        var val = rows[r][col - 1];
        if (!val) continue;
        if (valueContainsImgbbUrl_(val)) {
          addSimple(sheetName, r + 1, col, folder);
        }
      }
    }
  }
  scanSheet(CLEANING_SHEET, [8], 'cleaning/reports');
  scanSheet(TASK_PHOTOS_SHEET, [7], 'cleaning/tasks');
  scanSheet(WEEK_COVERAGE_SHEET, [5], 'cleaning/tasks');
  scanSheet(CIVIL_JOBS_SHEET, [8], 'jobs/civil');
  scanSheet(ELECTRICAL_JOBS_SHEET, [8], 'jobs/electrical');
  scanSheet(HSE_SHEET, [9], 'hse/inspections');
  [CIVIL_SHEET, ELECTRIC_SHEET, FIRE_SHEET].forEach(function (name) {
    var folder = 'issues/' + name.toLowerCase().replace('issues', '');
    scanSheet(name, [9, 10, 19], folder);
  });
  var trash = ss.getSheetByName(TRASH_SHEET);
  if (trash && trash.getLastRow() >= 2) {
    var trows = trash.getDataRange().getValues();
    for (var ti = 1; ti < trows.length; ti++) {
      if (valueContainsImgbbUrl_(trows[ti][2])) tasks.push({ kind: 'trash', row: ti + 1, folder: 'trash' });
    }
  }
  return tasks;
}

function countImgbbPhotosRemaining() {
  var out = { remaining: collectImgbbMigrationTasks_().length };
  Logger.log(JSON.stringify(out));
  return out;
}

function migrateImgbbBatch(maxItems) {
  maxItems = maxItems || 20;
  var cache = migrationMapFromLog_();
  var tasks = collectImgbbMigrationTasks_();
  var ss = getSS_();
  var migrated = 0;
  var errors = [];
  var attempts = 0;
  for (var i = 0; i < tasks.length && attempts < maxItems; i++) {
    var task = tasks[i];
    attempts++;
    try {
      if (task.kind === 'trash') {
        var tsheet = ss.getSheetByName(TRASH_SHEET);
        var trow = tsheet.getRange(task.row, 3).getValue();
        var parsedTrash = typeof trow === 'string' ? JSON.parse(trow) : trow;
        var nextJson = fixImgbbDeep_(parsedTrash, task.folder, cache);
        var oldStr = typeof trow === 'string' ? trow : JSON.stringify(trow);
        var newStr = JSON.stringify(nextJson);
        if (newStr !== oldStr) {
          tsheet.getRange(task.row, 3).setValue(newStr);
          migrated++;
          logMigration_('trash-row-' + task.row, 'updated', TRASH_SHEET, task.row, 3);
        }
        continue;
      }
      var sheet = ss.getSheetByName(task.sheetName);
      var cell = sheet.getRange(task.row, task.col);
      var oldVal = cell.getValue();
      var newVal = migrateImgbbValue_(oldVal, task.folder, cache);
      if (String(newVal) !== String(oldVal)) {
        cell.setValue(newVal);
        migrated++;
        if (isImgbbUrl_(oldVal)) logMigration_(oldVal, newVal, task.sheetName, task.row, task.col);
      }
    } catch (e) {
      errors.push({ task: task, error: String(e.message || e) });
    }
  }
  invalidateReportsCache_();
  invalidateTaskPhotosCache_('');
  [CIVIL_SHEET, ELECTRIC_SHEET, FIRE_SHEET, HSE_SHEET].forEach(function (n) { invalidateIssuesCache_(n); });
  var out = {
    ok: true,
    migrated: migrated,
    remaining: collectImgbbMigrationTasks_().length,
    errors: errors
  };
  Logger.log('MIGRATED: ' + out.migrated + '  REMAINING: ' + out.remaining + '  ERRORS: ' + out.errors.length);
  for (var ei = 0; ei < out.errors.length && ei < 5; ei++) {
    Logger.log('ERROR ' + (ei + 1) + ': ' + out.errors[ei].error);
    if (out.errors[ei].task) Logger.log('  at ' + JSON.stringify(out.errors[ei].task));
  }
  return out;
}

/** Run once from the editor to see why migrations fail. */
function migrateImgbbDiagnoseOne() {
  var cfg = getSupabaseMigrationProps_();
  Logger.log('SUPABASE_URL: ' + (cfg.url || '(missing)'));
  Logger.log('SUPABASE_SERVICE_KEY set: ' + (cfg.serviceKey ? 'yes' : 'NO — fix Script properties'));
  Logger.log('SUPABASE_BUCKET: ' + cfg.bucket);
  var tasks = collectImgbbMigrationTasks_();
  Logger.log('Tasks waiting: ' + tasks.length);
  if (!tasks.length) return;
  var task = tasks[0];
  Logger.log('Testing task: ' + JSON.stringify(task));
  var ss = getSS_();
  var cache = migrationMapFromLog_();
  try {
    if (task.kind === 'trash') {
      var trow = ss.getSheetByName(TRASH_SHEET).getRange(task.row, 3).getValue();
      Logger.log('Trash JSON preview: ' + String(trow).slice(0, 300));
      var parsedTrash = typeof trow === 'string' ? JSON.parse(trow) : trow;
      var nextJson = fixImgbbDeep_(parsedTrash, task.folder, cache);
      var oldStr = typeof trow === 'string' ? trow : JSON.stringify(trow);
      var newStr = JSON.stringify(nextJson);
      Logger.log('OK — changed: ' + (newStr !== oldStr));
      return;
    }
    var oldVal = ss.getSheetByName(task.sheetName).getRange(task.row, task.col).getValue();
    Logger.log('Cell preview: ' + String(oldVal).slice(0, 300));
    var newVal = migrateImgbbValue_(oldVal, task.folder, cache);
    Logger.log('OK — changed: ' + (String(newVal) !== String(oldVal)));
    if (String(newVal) !== String(oldVal)) Logger.log('New URL preview: ' + String(newVal).slice(0, 200));
  } catch (e) {
    Logger.log('FAILED: ' + String(e.message || e));
  }
}
