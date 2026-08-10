/**
 * Import migration-data/export.json into Supabase Postgres.
 *
 * Env (required):
 *   SUPABASE_URL              e.g. https://nobcitpaudeopzfymgzi.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY Project Settings → API → service_role
 *
 * Usage:
 *   cd scripts && npm install
 *   set SUPABASE_URL=...
 *   set SUPABASE_SERVICE_ROLE_KEY=...
 *   node import-to-supabase.mjs [path/to/export.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const exportPath = path.resolve(process.argv[2] || path.join(root, 'migration-data', 'export.json'));

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!fs.existsSync(exportPath)) {
  console.error('Export file not found:', exportPath);
  console.error('Run scripts/export-all-sheets.gs in Apps Script, download export.json → migration-data/export.json');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BCRYPT_ROUNDS = 10;
const BATCH = 200;

function s(v) {
  if (v == null) return '';
  return String(v);
}
function n(v) {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function b(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}
function parseJson(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}
function fmtDate(v) {
  const t = s(v).trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

/** Keep last row per primary key so upsert batches never hit the same id twice. */
function dedupeByKey(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (k == null || k === '') continue;
    map.set(String(k), row);
  }
  return [...map.values()];
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return { inserted: 0 };
  // onConflict may be "id" or "week_start,project,task"
  const cols = String(onConflict || '').split(',').map((c) => c.trim()).filter(Boolean);
  const unique = cols.length
    ? dedupeByKey(rows, (r) => cols.map((c) => r[c]).join('\0'))
    : rows;
  let inserted = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += chunk.length;
  }
  return { inserted };
}

async function countTable(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count || 0;
}

function sheetRows(data, name) {
  return (data.sheets[name] && data.sheets[name].rows) || [];
}

async function importUsers(rows) {
  const out = [];
  for (const r of rows) {
    const username = s(r.username).trim().toLowerCase();
    if (!username) continue;
    const plain = s(r.password).trim();
    const password_hash = plain ? await bcrypt.hash(plain, BCRYPT_ROUNDS) : '';
    // Sheet headers vary: department/dept, Projects/projects, Trade/trade
    out.push({
      username,
      password_hash,
      dept: s(r.dept || r.department || r.Department),
      role: s(r.role || r.Role),
      hide: s(r.hide || r.Hide),
      projects: s(r.projects || r.Projects || r.project),
      trade: s(r.trade || r.Trade),
      hide_electrical: s(r.hideElectrical || r.hide_electrical || r.HideElectrical)
    });
  }
  // Users sheet has a duplicate username "ibrahim" — keep last row only
  const unique = dedupeByKey(out, (r) => r.username);
  if (unique.length !== out.length) {
    console.warn(`users: removed ${out.length - unique.length} duplicate username(s)`);
  }
  return upsert('users', unique, 'username');
}

async function importSessions(rows) {
  const out = rows
    .map((r) => ({
      token: s(r.token),
      username: s(r.username).trim().toLowerCase(),
      dept: s(r.dept),
      created_at: Number(r.createdAt || r.created_at) || Date.now(),
      role: s(r.role),
      pw_digest: s(r.pwDigest || r.pw_digest)
    }))
    .filter((r) => r.token && r.username);
  // Sessions may reference users; skip orphans by only inserting known users later if needed
  return upsert('sessions', out, 'token');
}

function mapIssue(r) {
  return {
    id: s(r.id),
    project: s(r.project),
    building: s(r.building),
    floor: s(r.floor),
    spot: s(r.spot),
    issue_type: s(r.issueType || r.issue_type),
    note: s(r.note),
    date: fmtDate(r.date),
    photo: s(r.photo),
    fixed_photo: s(r.fixedPhoto || r.fixed_photo),
    status: s(r.status || 'open') || 'open',
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
    fixed_by: s(r.fixedBy || r.fixed_by),
    fixed_at: s(r.fixedAt || r.fixed_at),
    num: n(r.num),
    assigned_group: s(r.assignedGroup || r.assigned_group),
    workers_required: n(r.workersRequired || r.workers_required) || 1,
    worker_completions: parseJson(r.workerCompletions || r.worker_completions, []),
    assigned_workers: parseJson(r.assignedWorkers || r.assigned_workers, []),
    disposition: s(r.disposition),
    fix_delay: s(r.fixDelay || r.fix_delay),
    assign_voice_note: parseJson(r.assignVoiceNote || r.assign_voice_note, null),
    monthly_transfer_status: s(r.monthlyTransferStatus || r.monthly_transfer_status),
    transferred_job_id: s(r.transferredJobId || r.transferred_job_id),
    edited_job_note: s(r.editedJobNote || r.edited_job_note),
    transferred_at: s(r.transferredAt || r.transferred_at),
    transferred_by: s(r.transferredBy || r.transferred_by)
  };
}

async function main() {
  const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const report = { sourceCounts: data.counts || {}, imported: {}, dbCounts: {} };

  console.log('Importing from', exportPath);
  console.log('Exported at', data.exportedAt);

  // Clear mutable tables for clean re-import (keeps schema). Order matters for FKs.
  const clearOrder = [
    'sessions',
    'application_check_history',
    'application_checks',
    'trash',
    'task_log',
    'task_photos',
    'week_coverage',
    'tasks',
    'cleaning_reports',
    'civil_issues',
    'electric_issues',
    'fire_issues',
    'hse_inspections',
    'civil_jobs',
    'electrical_jobs',
    'civil_summaries',
    'electrical_summaries',
    'electric_worker_reports',
    'asaas_items',
    'worker_locations',
    'worker_push_tokens',
    'photo_migration_log',
    'ui_settings',
    'users'
  ];
  for (const t of clearOrder) {
    const { error } = await sb.from(t).delete().neq(
      t === 'users' ? 'username' : t === 'sessions' ? 'token' : t === 'tasks' ? 'key' : t === 'week_coverage' ? 'week_start' : t === 'civil_summaries' || t === 'electrical_summaries' || t === 'ui_settings' || t === 'id_counters' ? 'key' : t === 'id_counters' ? 'key' : 'id',
      '__never__'
    );
    // Simpler: use rpc-less delete all via filter that matches everything
    if (error) {
      // fallback per-table
    }
  }
  // Explicit deletes with always-true filters
  async function wipe(table, col) {
    const { error } = await sb.from(table).delete().gte(col, '');
    if (error) {
      const { error: e2 } = await sb.from(table).delete().not(col, 'is', null);
      if (e2) console.warn('wipe warn', table, e2.message);
    }
  }
  await wipe('sessions', 'token');
  await wipe('application_check_history', 'id');
  await wipe('application_checks', 'id');
  await wipe('trash', 'trash_id');
  await wipe('task_log', 'date');
  await wipe('task_photos', 'id');
  await wipe('week_coverage', 'week_start');
  await wipe('tasks', 'key');
  await wipe('cleaning_reports', 'id');
  await wipe('civil_issues', 'id');
  await wipe('electric_issues', 'id');
  await wipe('fire_issues', 'id');
  await wipe('hse_inspections', 'id');
  await wipe('civil_jobs', 'id');
  await wipe('electrical_jobs', 'id');
  await wipe('civil_summaries', 'month');
  await wipe('electrical_summaries', 'month');
  await wipe('electric_worker_reports', 'id');
  await wipe('asaas_items', 'id');
  await wipe('worker_locations', 'username');
  await wipe('worker_push_tokens', 'username');
  await wipe('photo_migration_log', 'old_url');
  await wipe('ui_settings', 'key');
  await wipe('users', 'username');

  report.imported.users = (await importUsers(sheetRows(data, 'Users'))).inserted;
  // Skip Tokens — sessions regenerated on next login (safer than stale tokens)
  report.imported.sessions = 0;

  const reports = sheetRows(data, 'Reports').map((r) => ({
    id: s(r.id),
    date: fmtDate(r.date),
    project: s(r.project),
    building: s(r.building),
    employees: s(r.employees),
    level: s(r.level),
    floors: s(r.floors),
    photo: s(r.photo),
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at)
  })).filter((r) => r.id);
  report.imported.cleaning_reports = (await upsert('cleaning_reports', reports, 'id')).inserted;

  const tasks = sheetRows(data, 'Tasks').map((r) => {
    const key = s(r.key);
    if (!key) return null;
    const rawDone = r.done != null ? r.done : r[''];
    const second = r.done !== undefined ? r.done : Object.values(r)[1];
    let done = null;
    let done_blob = null;
    if (typeof second === 'string' && second.trim().charAt(0) === '{') {
      done_blob = second;
    } else if (second === true || second === false || second === 'true' || second === 'false' || second === 1 || second === 0) {
      done = b(second);
    } else if (typeof second === 'string' && second) {
      done_blob = second;
    }
    return {
      key,
      done,
      done_blob,
      updated_by: s(r.updatedBy || r.updated_by),
      updated_at: s(r.updatedAt || r.updated_at)
    };
  }).filter(Boolean);
  report.imported.tasks = (await upsert('tasks', tasks, 'key')).inserted;

  const tphotos = sheetRows(data, 'TaskPhotos').map((r) => ({
    id: s(r.id),
    project: s(r.project),
    freq: s(r.freq),
    task: s(r.task),
    date: fmtDate(r.date),
    period: s(r.period),
    image: s(r.image),
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
    lat: n(r.lat),
    lng: n(r.lng),
    accuracy: n(r.accuracy),
    source: s(r.source || 'camera') || 'camera'
  })).filter((r) => r.id);
  report.imported.task_photos = (await upsert('task_photos', tphotos, 'id')).inserted;

  const week = sheetRows(data, 'WeekCoverage').map((r) => ({
    week_start: fmtDate(r.weekStart || r.week_start),
    project: s(r.project),
    task: s(r.task),
    done: b(r.done),
    image: s(r.image),
    updated_by: s(r.updatedBy || r.updated_by),
    updated_at: s(r.updatedAt || r.updated_at)
  })).filter((r) => r.week_start && r.project && r.task);
  report.imported.week_coverage = (await upsert('week_coverage', week, 'week_start,project,task')).inserted;

  // task_log has serial id — insert without conflict
  const tlog = sheetRows(data, 'TaskLog').map((r) => ({
    date: fmtDate(r.date),
    project: s(r.project),
    freq: s(r.freq),
    task: s(r.task),
    done: b(r.done),
    logged_by: s(r.loggedBy || r.logged_by),
    logged_at: s(r.loggedAt || r.logged_at)
  }));
  if (tlog.length) {
    for (let i = 0; i < tlog.length; i += BATCH) {
      const { error } = await sb.from('task_log').insert(tlog.slice(i, i + BATCH));
      if (error) throw new Error('task_log: ' + error.message);
    }
  }
  report.imported.task_log = tlog.length;

  report.imported.civil_issues = (await upsert('civil_issues', sheetRows(data, 'CivilIssues').map(mapIssue).filter((r) => r.id), 'id')).inserted;
  report.imported.electric_issues = (await upsert('electric_issues', sheetRows(data, 'ElectricIssues').map(mapIssue).filter((r) => r.id), 'id')).inserted;

  const fire = sheetRows(data, 'FireIssues').map((r) => ({
    id: s(r.id),
    project: s(r.project),
    building: s(r.building),
    floor: s(r.floor),
    spot: s(r.spot),
    issue_type: s(r.issueType || r.issue_type),
    note: s(r.note),
    date: fmtDate(r.date),
    photo: s(r.photo),
    fixed_photo: s(r.fixedPhoto || r.fixed_photo),
    status: s(r.status || 'open') || 'open',
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
    fixed_by: s(r.fixedBy || r.fixed_by),
    fixed_at: s(r.fixedAt || r.fixed_at),
    num: n(r.num)
  })).filter((r) => r.id);
  report.imported.fire_issues = (await upsert('fire_issues', fire, 'id')).inserted;

  const hse = sheetRows(data, 'HseInspections').map((r) => ({
    id: s(r.id),
    project: s(r.project),
    building: s(r.building),
    floor: s(r.floor),
    spot: s(r.spot),
    issue_type: s(r.issueType || r.issue_type),
    note: s(r.note),
    date: fmtDate(r.date),
    photo: s(r.photo),
    fixed_photo: s(r.fixedPhoto || r.fixed_photo),
    status: s(r.status || 'open') || 'open',
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
    fixed_by: s(r.fixedBy || r.fixed_by),
    fixed_at: s(r.fixedAt || r.fixed_at),
    num: n(r.num),
    asset_key: s(r.assetKey || r.asset_key),
    report_period: s(r.reportPeriod || r.report_period),
    job_dept: s(r.jobDept || r.job_dept)
  })).filter((r) => r.id);
  report.imported.hse_inspections = (await upsert('hse_inspections', hse, 'id')).inserted;

  const civilJobs = sheetRows(data, 'CivilJobs').map((r) => ({
    id: s(r.id),
    date: fmtDate(r.date),
    job: s(r.job),
    location: s(r.location),
    materials: s(r.materials),
    staff: s(r.staff),
    type: s(r.type),
    photo: s(r.photo),
    notes: s(r.notes),
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
    amount: s(r.amount)
  })).filter((r) => r.id);
  report.imported.civil_jobs = (await upsert('civil_jobs', civilJobs, 'id')).inserted;

  const elecJobs = sheetRows(data, 'ElectricalJobs').map((r) => ({
    id: s(r.id),
    date: fmtDate(r.date),
    job: s(r.job),
    location: s(r.location),
    materials: s(r.materials),
    staff: s(r.staff),
    type: s(r.type),
    photo: s(r.photo),
    notes: s(r.notes),
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
    amount: s(r.amount),
    num: n(r.num)
  })).filter((r) => r.id);
  report.imported.electrical_jobs = (await upsert('electrical_jobs', elecJobs, 'id')).inserted;

  const csum = sheetRows(data, 'CivilSummary').map((r) => ({
    month: s(r.month),
    text: s(r.text),
    saved_by: s(r.savedBy || r.saved_by),
    saved_at: s(r.savedAt || r.saved_at)
  })).filter((r) => r.month);
  report.imported.civil_summaries = (await upsert('civil_summaries', csum, 'month')).inserted;

  const esum = sheetRows(data, 'ElectricalSummary').map((r) => ({
    month: s(r.month),
    text: s(r.text),
    saved_by: s(r.savedBy || r.saved_by),
    saved_at: s(r.savedAt || r.saved_at)
  })).filter((r) => r.month);
  report.imported.electrical_summaries = (await upsert('electrical_summaries', esum, 'month')).inserted;

  const fr = sheetRows(data, 'ElectricWorkerReports').map((r) => ({
    id: s(r.id),
    date: fmtDate(r.date),
    place: s(r.place),
    note: s(r.note),
    photo: s(r.photo),
    voice_note: typeof r.voiceNote === 'object' ? JSON.stringify(r.voiceNote) : s(r.voiceNote || r.voice_note),
    reported_by: s(r.reportedBy || r.reported_by),
    worker_name: s(r.workerName || r.worker_name),
    created_at: s(r.createdAt || r.created_at),
    amount: n(r.amount) || 0,
    report_type: s(r.reportType || r.report_type || 'maintenance') || 'maintenance',
    status: s(r.status),
    transferred_job_id: s(r.transferredJobId || r.transferred_job_id),
    edited_note: s(r.editedNote || r.edited_note),
    transferred_at: s(r.transferredAt || r.transferred_at),
    transferred_by: s(r.transferredBy || r.transferred_by),
    materials: s(r.materials),
    invoice_photo: s(r.invoicePhoto || r.invoice_photo),
    num: n(r.num)
  })).filter((r) => r.id);
  report.imported.electric_worker_reports = (await upsert('electric_worker_reports', fr, 'id')).inserted;

  const asaas = sheetRows(data, 'AsaasItems').map((r) => ({
    id: s(r.id),
    num: n(r.num),
    date: fmtDate(r.date),
    building: s(r.building),
    floor: s(r.floor),
    spot: s(r.spot),
    item_description: s(r.itemDescription || r.item_description),
    photo: s(r.photo),
    apartment: s(r.apartment),
    status: s(r.status || 'in_warehouse') || 'in_warehouse',
    warehouse_note: s(r.warehouseNote || r.warehouse_note),
    removed_by: s(r.removedBy || r.removed_by),
    removed_by_name: s(r.removedByName || r.removed_by_name),
    created_at: s(r.createdAt || r.created_at),
    returned_at: s(r.returnedAt || r.returned_at),
    returned_to: s(r.returnedTo || r.returned_to),
    return_apartment: s(r.returnApartment || r.return_apartment),
    return_photo: s(r.returnPhoto || r.return_photo),
    return_note: s(r.returnNote || r.return_note),
    updated_at: s(r.updatedAt || r.updated_at),
    photo2: s(r.photo2)
  })).filter((r) => r.id);
  report.imported.asaas_items = (await upsert('asaas_items', asaas, 'id')).inserted;

  const checks = sheetRows(data, 'ApplicationChecks').map((r) => ({
    id: s(r.id),
    project: s(r.project),
    property_id: s(r.propertyId || r.property_id),
    phone: s(r.phone),
    status: s(r.status),
    note: s(r.note),
    updated_at: s(r.updatedAt || r.updated_at),
    updated_by: s(r.updatedBy || r.updated_by)
  })).filter((r) => r.id);
  report.imported.application_checks = (await upsert('application_checks', checks, 'id')).inserted;

  const hist = sheetRows(data, 'ApplicationCheckHistory').map((r) => ({
    id: s(r.id),
    check_id: s(r.checkId || r.check_id),
    field: s(r.field),
    old_value: s(r.oldValue || r.old_value),
    new_value: s(r.newValue || r.new_value),
    changed_at: s(r.changedAt || r.changed_at),
    changed_by: s(r.changedBy || r.changed_by)
  })).filter((r) => r.id && r.check_id);
  report.imported.application_check_history = (await upsert('application_check_history', hist, 'id')).inserted;

  const trash = sheetRows(data, 'Trash').map((r) => ({
    trash_id: s(r.trashId || r.trash_id),
    source_sheet: s(r.sourceSheet || r.source_sheet),
    row_json: parseJson(r.rowJson || r.row_json, r.rowJson || []),
    deleted_by: s(r.deletedBy || r.deleted_by),
    deleted_at: s(r.deletedAt || r.deleted_at),
    reason: s(r.reason),
    batch_id: s(r.batchId || r.batch_id)
  })).filter((r) => r.trash_id);
  report.imported.trash = (await upsert('trash', trash, 'trash_id')).inserted;

  const locs = sheetRows(data, 'WorkerLocations').map((r) => ({
    username: s(r.username).trim().toLowerCase(),
    trade: s(r.trade),
    lat: n(r.lat),
    lng: n(r.lng),
    accuracy: n(r.accuracy),
    updated_at: s(r.updatedAt || r.updated_at)
  })).filter((r) => r.username && r.lat != null && r.lng != null);
  report.imported.worker_locations = (await upsert('worker_locations', locs, 'username')).inserted;

  const push = sheetRows(data, 'WorkerPushTokens').map((r) => ({
    username: s(r.username).trim().toLowerCase(),
    fcm_token: s(r.fcmToken || r.fcm_token),
    platform: s(r.platform),
    updated_at: s(r.updatedAt || r.updated_at)
  })).filter((r) => r.username);
  report.imported.worker_push_tokens = (await upsert('worker_push_tokens', push, 'username')).inserted;

  if (data.uiSettings) {
    await upsert('ui_settings', [{ key: 'uiSettings_cleaning', settings: data.uiSettings }], 'key');
    report.imported.ui_settings = 1;
  }

  // Seed counters from export + max nums in data
  const counters = { ...(data.counters || {}) };
  const maxOf = (rows, field) => rows.reduce((m, r) => Math.max(m, Number(r[field] || r.num) || 0), 0);
  const setMax = (key, val) => {
    counters[key] = Math.max(Number(counters[key] || 0), val);
  };
  setMax('issnum_CivilIssues', maxOf(sheetRows(data, 'CivilIssues'), 'num'));
  setMax('issnum_ElectricIssues', maxOf(sheetRows(data, 'ElectricIssues'), 'num'));
  setMax('issnum_FireIssues', maxOf(sheetRows(data, 'FireIssues'), 'num'));
  setMax('issnum_HseInspections', maxOf(sheetRows(data, 'HseInspections'), 'num'));
  setMax('jobnum_ElectricalJobs', maxOf(sheetRows(data, 'ElectricalJobs'), 'num'));
  setMax('frnum_ElectricWorkerReports', maxOf(sheetRows(data, 'ElectricWorkerReports'), 'num'));
  setMax('asanum_AsaasItems', maxOf(sheetRows(data, 'AsaasItems'), 'num'));

  const counterRows = Object.keys(counters).map((k) => ({ key: k, value: Number(counters[k]) || 0 }));
  if (counterRows.length) {
    await upsert('id_counters', counterRows, 'key');
  }
  report.imported.id_counters = counterRows.length;

  // Verify counts
  const tables = [
    'users', 'cleaning_reports', 'tasks', 'task_photos', 'week_coverage', 'task_log',
    'civil_issues', 'electric_issues', 'fire_issues', 'hse_inspections',
    'civil_jobs', 'electrical_jobs', 'civil_summaries', 'electrical_summaries',
    'electric_worker_reports', 'asaas_items', 'application_checks',
    'application_check_history', 'trash', 'worker_locations', 'worker_push_tokens'
  ];
  for (const t of tables) {
    report.dbCounts[t] = await countTable(t);
  }

  const outPath = path.join(root, 'migration-data', 'import-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\n=== Import report ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('\nWrote', outPath);
  console.log('Passwords were hashed with bcrypt; plaintext was not stored.');
  console.log('Sessions were NOT imported — users must log in again after cutover.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
