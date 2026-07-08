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
var CIVIL_JOBS_SHEET = 'CivilJobs';
var CIVIL_SUMMARY_SHEET = 'CivilSummary';
var TRASH_SHEET = 'Trash';
var RESET_PASSWORD = 'empire2026';
var TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;

var SCRIPT_VERSION = '2026-07-07-hse-conditions';
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
    if (action === 'login' || action === 'verifyLogin') return respond(handleLogin(body));
    if (action === 'getPerms') return respond(handleGetPerms(body));
    var deptByAction = {
      'saveReport':'cleaning','getReports':'cleaning','deleteReport':'cleaning','saveTasks':'cleaning','getTasks':'cleaning','clearAll':'cleaning',
      'setTask':'cleaning','resetTasks':'cleaning',
      'getWeekCoverage':'cleaning','markTaskWeek':'cleaning','getRangeCoverage':'cleaning',
      'getTaskPhotos':'cleaning','addTaskPhoto':'cleaning','deleteTaskPhoto':'cleaning',
      'logTask':'cleaning','getTaskLog':'cleaning',
      'addCivilIssue':'civil issue','updateCivilIssue':'civil issue','getCivilIssues':'civil issue','markCivilFixed':'civil issue','clearCivilIssues':'civil issue','deleteCivilIssue':'civil issue',
      'addElectricIssue':'electric issue','updateElectricIssue':'electric issue','getElectricIssues':'electric issue','markElectricFixed':'electric issue','clearElectricIssues':'electric issue','deleteElectricIssue':'electric issue',
      'addFireIssue':'fire','updateFireIssue':'fire','getFireIssues':'fire','markFireFixed':'fire','clearFireIssues':'fire','deleteFireIssue':'fire',
      'addHseInspection':'hse','updateHseInspection':'hse','getHseInspections':'hse','markHseResolved':'hse','clearHseInspections':'hse','deleteHseInspection':'hse',
      'addElectricalJob':'electrical department','getElectricalJobs':'electrical department','updateElectricalJob':'electrical department',
      'deleteElectricalJob':'electrical department','clearElectricalJobs':'electrical department',
      'getElectricalSummary':'electrical department','saveElectricalSummary':'electrical department',
      'addCivilJob':'civil department','getCivilJobs':'civil department','updateCivilJob':'civil department',
      'deleteCivilJob':'civil department','clearCivilJobs':'civil department',
      'getCivilSummary':'civil department','saveCivilSummary':'civil department'
    };
    var trashActions = {getTrash:1, restoreTrash:1, purgeTrash:1, getUiSettings:1, saveUiSettings:1};
    var requiredDept = trashActions[action] ? body.dept : deptByAction[action];
    if (!requiredDept) return respond({ok:false,error:'Unknown action'});
    var auth = verifyToken(body.token, requiredDept);
    if (!auth.ok) return respond(auth);
    body.username = auth.username;
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
    if (action==='deleteTaskPhoto') return respond(handleDeleteTaskPhoto(body));
    if (action==='logTask') return respond(handleLogTask(body));
    if (action==='getTaskLog') return respond(handleGetTaskLog(body));
    if (action==='getUiSettings') return respond(handleGetUiSettings(body));
    if (action==='saveUiSettings') return respond(handleSaveUiSettings(body));
    if (action==='addCivilIssue') return respond(handleAddIssue(body, CIVIL_SHEET));
    if (action==='updateCivilIssue') return respond(handleUpdateIssue(body, CIVIL_SHEET));
    if (action==='getCivilIssues') return respond(handleGetIssues(body, CIVIL_SHEET));
    if (action==='markCivilFixed') return respond(handleMarkFixed(body, CIVIL_SHEET));
    if (action==='clearCivilIssues') return respond(handleClearIssues(body, CIVIL_SHEET));
    if (action==='deleteCivilIssue') return respond(handleDeleteIssue(body, CIVIL_SHEET));
    if (action==='addElectricIssue') return respond(handleAddIssue(body, ELECTRIC_SHEET));
    if (action==='updateElectricIssue') return respond(handleUpdateIssue(body, ELECTRIC_SHEET));
    if (action==='getElectricIssues') return respond(handleGetIssues(body, ELECTRIC_SHEET));
    if (action==='markElectricFixed') return respond(handleMarkFixed(body, ELECTRIC_SHEET));
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

// Roles: admin = everything incl reset; editor = add/edit/delete + analytics + report (no reset); viewer = read-only.
// Optional "Hide" column (col E) removes extra abilities: list any of add, edit, delete, analytics, report.
function computePerms_(role, hide) {
  role = String(role||'').trim().toLowerCase();
  if (role!=='admin' && role!=='viewer' && role!=='editor') role = 'editor';
  var p;
  if (role==='admin') p = {view:true,add:true,edit:true,del:true,analytics:true,report:true,reset:true};
  else if (role==='viewer') p = {view:true,add:false,edit:false,del:false,analytics:true,report:true,reset:false};
  else p = {view:true,add:true,edit:true,del:true,analytics:true,report:true,reset:false};
  var hl = String(hide||'').toLowerCase();
  if (hl.indexOf('add')!==-1) p.add=false;
  if (hl.indexOf('edit')!==-1) p.edit=false;
  if (hl.indexOf('delete')!==-1 || hl.indexOf('del')!==-1) p.del=false;
  if (hl.indexOf('analytic')!==-1) p.analytics=false;
  if (hl.indexOf('report')!==-1) p.report=false;
  return {role:role, perms:p};
}
function pruneExpiredTokens_(ss) {
  // Keeps the Tokens sheet small so verifyToken()'s scan stays fast on every API call.
  try {
    var tsheet = ss.getSheetByName(TOKENS_SHEET);
    if (!tsheet || tsheet.getLastRow()<2) return;
    var rows = tsheet.getDataRange().getValues();
    var now = new Date().getTime();
    var keep = [];
    for (var i=1;i<rows.length;i++) {
      if (now - Number(rows[i][3]) <= TOKEN_TTL) keep.push(rows[i]);
    }
    if (keep.length === rows.length-1) return; // nothing expired, skip rewrite
    tsheet.getRange(2,1,Math.max(tsheet.getLastRow()-1,1),5).clearContent();
    if (keep.length>0) tsheet.getRange(2,1,keep.length,5).setValues(keep);
  } catch(e) { /* never let cleanup break login */ }
}
function handleLogin(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) return {ok:false,success:false,message:'Users sheet not found',error:'Users sheet not found'};
  var rows = sheet.getDataRange().getValues();
  var username = String(body.username||'').trim().toLowerCase();
  var password = String(body.password||'').trim();
  var dept = String(body.dept||'').trim().toLowerCase();
  if (!dept) dept = 'cleaning';
  for (var i=1;i<rows.length;i++) {
    var uname = String(rows[i][0]||'').trim().toLowerCase();
    var upass = String(rows[i][1]||'').trim();
    var userDept = String(rows[i][2]||'').trim().toLowerCase();
    if (uname===username && upass===password) {
      var allowed = (userDept===''||userDept==='all'||userDept===dept);
      if (!allowed) return {ok:false,success:false,message:'This login is not allowed for this section',error:'This login is not allowed for this section'};
      var rp = computePerms_(rows[i][3], rows[i][4]);
      var token = Utilities.getUuid();
      var tsheet = ss.getSheetByName(TOKENS_SHEET) || ss.insertSheet(TOKENS_SHEET);
      pruneExpiredTokens_(ss);
      tsheet.appendRow([token, username, dept, new Date().getTime(), rp.role]);
      return {ok:true,success:true,token:token,username:username,dept:dept,role:rp.role,perms:rp.perms,message:'Login successful'};
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
  for (var i=0;i<trows.length;i++) {
    if (String(trows[i][0])===String(body.token)) {
      if (now - Number(trows[i][3]) > TOKEN_TTL) return {ok:false, error:'Token expired'};
      username = String(trows[i][1]||'').trim().toLowerCase();
      break;
    }
  }
  if (!username) return {ok:false, error:'Invalid token'};
  var usheet = ss.getSheetByName(USERS_SHEET);
  if (!usheet) return {ok:false, error:'Users sheet not found'};
  var urows = usheet.getDataRange().getValues();
  for (var j=1;j<urows.length;j++) {
    if (String(urows[j][0]||'').trim().toLowerCase()===username) {
      var rp = computePerms_(urows[j][3], urows[j][4]);
      return {ok:true, role:rp.role, perms:rp.perms};
    }
  }
  return {ok:false, error:'User not found'};
}

function verifyToken(token, requiredDept) {
  if (!token) return {ok:false,error:'No token'};
  requiredDept = String(requiredDept||'').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var tkey = 'tok_' + Utilities.base64EncodeWebSafe(String(token)).slice(0, 40);
  try {
    var hit = cache.get(tkey);
    if (hit) {
      var cached = JSON.parse(hit);
      if (cached.dept === requiredDept) return cached;
      return {ok:false,error:'This login is not allowed for this section'};
    }
  } catch(e){}
  var ss = getSS_();
  var tsheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tsheet) return {ok:false,error:'Not authenticated'};
  var rows = tsheet.getDataRange().getValues();
  var now = new Date().getTime();
  for (var i=0;i<rows.length;i++) {
    if (String(rows[i][0])===String(token)) {
      var tokenDept = String(rows[i][2]||'').trim().toLowerCase();
      if (now - Number(rows[i][3]) > TOKEN_TTL) return {ok:false,error:'Token expired'};
      if (tokenDept !== requiredDept) return {ok:false,error:'This login is not allowed for this section'};
      var result = {ok:true,username:rows[i][1],dept:tokenDept,role:String(rows[i][4]||'')};
      try { cache.put(tkey, JSON.stringify(result), 300); } catch(e){}
      return result;
    }
  }
  return {ok:false,error:'Invalid token'};
}

function handleSaveReport(body) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(CLEANING_SHEET) || ss.insertSheet(CLEANING_SHEET);
  if (sheet.getLastRow()===0) sheet.appendRow(['id','date','project','building','employees','level','floors','photo','createdBy','createdAt']);
  var r = body.report || {};
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
  for (var i=1;i<rows.length;i++) {
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
    if (String(rows[i][0])===String(body.id)) { trashRows_(CLEANING_SHEET,[rows[i]],'delete',body.username); sheet.deleteRow(i+1); invalidateReportsCache_(); return {ok:true,success:true}; }
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
  if (sheet.getLastRow()===0) sheet.appendRow(['id','project','building','floor','spot','issueType','note','date','photo','fixedPhoto','status','createdBy','createdAt','fixedBy','fixedAt','num']);
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
  sheet.appendRow([id, body.project||'', body.building||'', body.floor||'', body.spot||'', body.issueType||'', body.note||'', body.date||'', body.photo||'', '', status, reporter, new Date().toISOString(), '', '', num]);
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

function handleGetIssues(body, sheetName) {
  var ckey = issuesCacheKey_(sheetName);
  var cached = issuesCacheGet_(ckey);
  if (cached) return cached;
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet||sheet.getLastRow()<2) return [];
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  ensureIssueNums_(sheet, sheetName, rows);
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var dv=rows[i][7]; var ds=(dv instanceof Date)?Utilities.formatDate(dv,tz,'yyyy-MM-dd'):String(dv);
    var st=String(rows[i][10]||'open');
    var fp=String(rows[i][9]||'');
    out.push({id:String(rows[i][0]),num:Number(rows[i][ISSUE_NUM_COL-1]||0),project:String(rows[i][1]),building:String(rows[i][2]),floor:String(rows[i][3]),spot:String(rows[i][4]),issueType:String(rows[i][5]),note:String(rows[i][6]||''),date:ds,photo:String(rows[i][8]||''),fixedPhoto:(st==='fixed'?fp:''),status:st,createdBy:String(rows[i][11]||''),createdAt:dtIssue_(rows[i][12]),fixedBy:String(rows[i][13]||''),fixedAt:dtIssue_(rows[i][14])});
  }
  issuesCachePut_(ckey, out);
  return out;
}

function handleMarkFixed(body, sheetName) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return {ok:false,error:'Sheet not found'};
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) {
      sheet.getRange(i+1,10).setValue(body.fixedPhoto||'');
      sheet.getRange(i+1,11).setValue('fixed');
      sheet.getRange(i+1,14).setValue(body.fixedByName||body.username||'');
      sheet.getRange(i+1,15).setValue(new Date().toISOString());
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
    var preview = '';
    try {
      var arr = JSON.parse(rows[i][2]); var parts=[];
      for (var j=1;j<arr.length;j++){ var v=arr[j]; if(v!==''&&v!=null){ var sv=String(v); if(sv.indexOf('http')===0) sv='[photo]'; parts.push(sv); } }
      preview = parts.slice(0,5).join('  ·  ');
    } catch(e) {}
    out.push({trashId:String(rows[i][0]), sourceSheet:src, preview:preview, deletedBy:String(rows[i][3]||''), deletedAt:String(rows[i][4]||''), reason:String(rows[i][5]||''), batchId:String(rows[i][6]||'')});
  }
  out.reverse();
  return out;
}

function handleRestoreTrash(body) {
  var ss = getSS_();
  var t = ss.getSheetByName(TRASH_SHEET);
  if (!t || t.getLastRow()<2) return {ok:true,success:true,restored:0};
  var ids = body.trashIds || (body.trashId ? [body.trashId] : null);
  var batchId = body.batchId || null;
  var sheets = body.sheets || null;
  var rows = t.getDataRange().getValues();
  var toDelete = [], restored = 0;
  for (var i=1;i<rows.length;i++) {
    var src = String(rows[i][1]); var match=false;
    if (ids) match = ids.indexOf(String(rows[i][0]))!==-1;
    else if (batchId) match = String(rows[i][6])===batchId;
    else if (sheets) match = sheets.indexOf(src)!==-1;
    if (!match) continue;
    try { var arr = JSON.parse(rows[i][2]); var dst = ss.getSheetByName(src) || ss.insertSheet(src); dst.appendRow(arr); restored++; toDelete.push(i+1); } catch(e) {}
  }
  toDelete.sort(function(a,b){return b-a;}).forEach(function(r){ t.deleteRow(r); });
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
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0])===String(body.id)) { trashRows_(sheetName,[rows[i]],'delete',body.username); sheet.deleteRow(i+1); invalidateIssuesCache_(sheetName); return {ok:true,success:true}; }
  }
  return {ok:false,error:'Issue not found'};
}
