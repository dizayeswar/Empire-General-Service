/**
 * Empire EGS — export all sheet tabs to Drive as export.json
 *
 * SETUP (important):
 * 1. Open your Empire Google Sheet (the real one with Users, CivilIssues, etc.)
 * 2. Extensions → Apps Script
 * 3. You should see Code.gs / empire-all-in-one.gs — NOT an empty "Untitled project"
 * 4. Click + next to Files → Script → name it export-all-sheets
 * 5. Delete any old broken paste, then paste THIS whole file → Save
 * 6. In the toolbar dropdown pick: exportAllSheetsToDrive
 * 7. Click Run → Allow permissions
 * 8. Open View → Logs (or Executions) for the Drive folder link
 * 9. Download export.json → put in migration-data/export.json on your PC
 */

// Same spreadsheet as empire-all-in-one.gs
var EXPORT_SHEET_ID = '1D9EgQfQmnJblq-_CZytGBnBccOBy_RK2ZHRpX7IwUv4';

var EXPORT_SHEETS = [
  'Users', 'Tokens', 'Reports', 'Tasks', 'TaskPhotos', 'WeekCoverage', 'TaskLog',
  'CivilIssues', 'ElectricIssues', 'FireIssues', 'HseInspections',
  'ElectricalJobs', 'ElectricalSummary', 'ElectricWorkerReports',
  'AsaasItems', 'ApplicationChecks', 'ApplicationCheckHistory',
  'CivilJobs', 'CivilSummary', 'Trash', 'WorkerLocations', 'WorkerPushTokens',
  'PhotoMigrationLog'
];

function exportAllSheetsToDrive() {
  var sheetId = EXPORT_SHEET_ID;
  if (typeof SHEET_ID !== 'undefined' && SHEET_ID) sheetId = SHEET_ID;

  var ss = SpreadsheetApp.openById(sheetId);
  var sheets = {};
  var counts = {};
  var i, name, sh, values, headers, rows, r, c, obj, key, v, empty;

  for (i = 0; i < EXPORT_SHEETS.length; i++) {
    name = EXPORT_SHEETS[i];
    sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 1) {
      sheets[name] = { headers: [], rows: [] };
      counts[name] = 0;
      continue;
    }
    values = sh.getDataRange().getValues();
    headers = values[0].map(function (h) { return String(h == null ? '' : h); });
    rows = [];
    for (r = 1; r < values.length; r++) {
      obj = {};
      empty = true;
      for (c = 0; c < headers.length; c++) {
        key = headers[c] || ('col' + c);
        v = values[r][c];
        if (v instanceof Date) {
          v = Utilities.formatDate(v, ss.getSpreadsheetTimeZone() || 'Etc/GMT', 'yyyy-MM-dd HH:mm:ss');
        }
        if (v !== '' && v != null) empty = false;
        obj[key] = v;
      }
      if (!empty) rows.push(obj);
    }
    sheets[name] = { headers: headers, rows: rows };
    counts[name] = rows.length;
  }

  var props = PropertiesService.getScriptProperties().getProperties();
  var counters = {};
  Object.keys(props).forEach(function (k) {
    if (/^(issnum_|jobnum_|frnum_|asanum_)/.test(k)) counters[k] = Number(props[k] || 0);
  });

  var uiSettings = null;
  try {
    uiSettings = props.uiSettings_cleaning ? JSON.parse(props.uiSettings_cleaning) : null;
  } catch (e) {
    uiSettings = null;
  }

  var payload = {
    exportedAt: new Date().toISOString(),
    sheetId: sheetId,
    counts: counts,
    counters: counters,
    uiSettings: uiSettings,
    sheets: sheets
  };

  var folder = DriveApp.createFolder(
    'EGS-migration-export-' + Utilities.formatDate(new Date(), 'Etc/GMT', 'yyyyMMdd-HHmmss')
  );
  var file = folder.createFile('export.json', JSON.stringify(payload), MimeType.PLAIN_TEXT);

  Logger.log('DONE');
  Logger.log('Folder: ' + folder.getUrl());
  Logger.log('File: ' + file.getUrl());
  Logger.log('Counts: ' + JSON.stringify(counts));

  // Also show a popup so you don't need Logs
  try {
    SpreadsheetApp.getUi().alert(
      'Export finished.\n\nOpen this Drive folder and download export.json:\n' + folder.getUrl()
    );
  } catch (e2) {
    // Running from unbound script — popup may not work; use Logs
  }

  return { folderUrl: folder.getUrl(), fileUrl: file.getUrl(), counts: counts };
}
