/**
 * Fix cleaning TaskPhotos column shift + restore Reports (and optional TaskPhotos) from Trash.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportPath = path.resolve(__dirname, '..', 'migration-data', 'export.json');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!fs.existsSync(exportPath)) {
  console.error('Missing', exportPath);
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const BATCH = 200;

function s(v) {
  return v == null ? '' : String(v);
}
function fmtDate(v) {
  const t = s(v).trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}
function n(v) {
  if (v === '' || v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
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
function periodFromDate(dateStr) {
  const d = fmtDate(dateStr);
  return d ? d.slice(0, 7) : '';
}

/** Map TaskPhotos row — sheet headers are shifted vs modern Apps Script layout. */
function mapTaskPhotoRow(r) {
  const id = s(r.id);
  if (!id) return null;

  let period = s(r.period);
  let image = s(r.image);
  let created_by = s(r.createdBy || r.created_by);
  let created_at = s(r.createdAt || r.created_at);

  const imageLooksPeriod = /^\d{4}-\d{2}/.test(image) && image.indexOf('http') !== 0;
  const createdByLooksUrl = created_by.indexOf('http') === 0;

  // Active sheet bug: headers image/createdBy/ts/(blank) = period/image/user/createdAt
  if (imageLooksPeriod && createdByLooksUrl) {
    period = period || image;
    image = created_by;
    created_by = s(r.ts);
    created_at = s(r.col8 || r.created_at || r.createdAt);
  } else if (!period && image.indexOf('http') === 0) {
    // Older trash layout: image is URL, no period column
    period = periodFromDate(r.date);
  }

  if (!period) period = periodFromDate(r.date);
  if (image.indexOf('http') !== 0) {
    // still broken — skip
    return null;
  }

  return {
    id,
    project: s(r.project),
    freq: s(r.freq),
    task: s(r.task),
    date: fmtDate(r.date),
    period,
    image,
    created_by,
    created_at,
    lat: n(r.lat),
    lng: n(r.lng),
    accuracy: n(r.accuracy),
    source: s(r.source || 'camera') || 'camera',
  };
}

function mapReportFromArray(arr) {
  if (!Array.isArray(arr) || !arr[0]) return null;
  return {
    id: s(arr[0]),
    date: fmtDate(arr[1]),
    project: s(arr[2]),
    building: s(arr[3]),
    employees: s(arr[4]),
    level: s(arr[5]),
    floors: s(arr[6]),
    photo: s(arr[7]),
    created_by: s(arr[8]),
    created_at: s(arr[9]),
  };
}

function mapTaskPhotoFromArray(arr) {
  if (!Array.isArray(arr) || !arr[0]) return null;
  // Older: id, project, freq, task, date, image, createdBy, createdAt
  // Newer shifted stored as values in trash may vary
  let period = '';
  let image = s(arr[5]);
  let created_by = s(arr[6]);
  let created_at = s(arr[7]);
  if (/^\d{4}-\d{2}/.test(image) && image.indexOf('http') !== 0 && String(arr[6] || '').indexOf('http') === 0) {
    period = image;
    image = s(arr[6]);
    created_by = s(arr[7]);
    created_at = s(arr[8]);
  }
  if (!period) period = periodFromDate(arr[4]);
  if (image.indexOf('http') !== 0) return null;
  return {
    id: s(arr[0]),
    project: s(arr[1]),
    freq: s(arr[2]),
    task: s(arr[3]),
    date: fmtDate(arr[4]),
    period,
    image,
    created_by,
    created_at,
    lat: null,
    lng: null,
    accuracy: null,
    source: 'camera',
  };
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

const photos = [];
const seenPhoto = new Set();
for (const r of data.sheets.TaskPhotos?.rows || []) {
  const m = mapTaskPhotoRow(r);
  if (!m || seenPhoto.has(m.id)) continue;
  seenPhoto.add(m.id);
  photos.push(m);
}

const reports = [];
const seenRep = new Set();
for (const r of data.sheets.Reports?.rows || []) {
  const id = s(r.id);
  if (!id || seenRep.has(id)) continue;
  seenRep.add(id);
  reports.push({
    id,
    date: fmtDate(r.date),
    project: s(r.project),
    building: s(r.building),
    employees: s(r.employees),
    level: s(r.level),
    floors: s(r.floors),
    photo: s(r.photo),
    created_by: s(r.createdBy || r.created_by),
    created_at: s(r.createdAt || r.created_at),
  });
}

// Restore from Trash
let restoredReports = 0;
let restoredPhotos = 0;
for (const t of data.sheets.Trash?.rows || []) {
  const src = s(t.sourceSheet || t.source_sheet);
  const arr = parseJson(t.rowJson || t.row_json, null);
  if (!Array.isArray(arr)) continue;
  if (src === 'Reports') {
    const m = mapReportFromArray(arr);
    if (m && !seenRep.has(m.id)) {
      seenRep.add(m.id);
      reports.push(m);
      restoredReports++;
    }
  }
  if (src === 'TaskPhotos') {
    const m = mapTaskPhotoFromArray(arr);
    if (m && !seenPhoto.has(m.id)) {
      seenPhoto.add(m.id);
      photos.push(m);
      restoredPhotos++;
    }
  }
}

console.log('Task photos to upsert:', photos.length, '(from trash extras:', restoredPhotos + ')');
console.log('Reports to upsert:', reports.length, '(from trash:', restoredReports + ')');
if (photos[0]) console.log('Sample photo:', {
  id: photos[0].id,
  period: photos[0].period,
  image: photos[0].image.slice(0, 80) + '...',
  created_by: photos[0].created_by,
});

const pCount = await upsert('task_photos', photos, 'id');
const rCount = await upsert('cleaning_reports', reports, 'id');
console.log('Upserted task_photos:', pCount);
console.log('Upserted cleaning_reports:', rCount);

const { count: pc } = await sb.from('task_photos').select('*', { count: 'exact', head: true });
const { count: rc } = await sb.from('cleaning_reports').select('*', { count: 'exact', head: true });
console.log('DB counts now — task_photos:', pc, 'cleaning_reports:', rc);
console.log('Done. Hard refresh Cleaning dashboard.');
