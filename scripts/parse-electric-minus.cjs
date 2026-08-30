/* Import Electric minus.xlsx into assets/empire-electric-minus-data.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const xlsxPath = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Electric minus.xlsx'
);
if (!fs.existsSync(xlsxPath)) throw new Error('Spreadsheet not found: ' + xlsxPath);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'em-xlsx-'));
const zipCopy = path.join(tmp, 'file.zip');
fs.copyFileSync(xlsxPath, zipCopy);
execFileSync('tar', ['-xf', zipCopy, '-C', tmp]);
const root = path.join(tmp, 'xl');
const sstXml = fs.readFileSync(path.join(root, 'sharedStrings.xml'), 'utf8');
const sheetXml = fs.readFileSync(path.join(root, 'worksheets', 'sheet1.xml'), 'utf8');

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

const sst = [];
const siRe = /<si>([\s\S]*?)<\/si>/g;
let m;
while ((m = siRe.exec(sstXml))) {
  const texts = [];
  const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let tm;
  while ((tm = tRe.exec(m[1]))) texts.push(decodeXml(tm[1]));
  sst.push(texts.join(''));
}

function colRow(ref) {
  const mm = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!mm) return null;
  let col = 0;
  for (const ch of mm[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { c: col - 1, r: Number(mm[2]) };
}

function excelSerialToIso(n) {
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return '';
  const utc = Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000;
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + mo + '-' + da;
}

function parseLooseDate(s) {
  s = String(s || '').trim();
  if (!s) return '';
  let mm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (mm) {
    const d = mm[1].padStart(2, '0');
    const mo = mm[2].padStart(2, '0');
    let y = mm[3];
    return y + '-' + mo + '-' + d;
  }
  mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (mm) return s.slice(0, 10);
  return s;
}

const grid = {};
const cellRe = /<c\s+([^>]+)>([\s\S]*?)<\/c>/g;
while ((m = cellRe.exec(sheetXml))) {
  const attrs = m[1];
  const body = m[2];
  const r = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
  const t = (attrs.match(/t="([^"]+)"/) || [])[1] || '';
  const pos = colRow(r);
  if (!pos) continue;
  let val = '';
  if (t === 's') {
    const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    val = sst[Number(v)] || '';
  } else if (t === 'inlineStr') {
    const texts = [];
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(body))) texts.push(decodeXml(tm[1]));
    val = texts.join('');
  } else {
    const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v != null) val = decodeXml(v);
  }
  if (!grid[pos.r]) grid[pos.r] = [];
  grid[pos.r][pos.c] = String(val).trim();
}

const maxRow = Math.max(...Object.keys(grid).map(Number));
const preview = [];
for (let r = 1; r <= Math.min(12, maxRow); r++) {
  preview.push({ r, row: grid[r] || [] });
}

function formatExcelTime(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/[ap]\s*m/i.test(s) || /:/.test(s) || /;/.test(s)) return s.replace(/\s+/g, ' ');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n >= 1) return s;
  const totalMinutes = Math.round(n * 24 * 60);
  let h = Math.floor(totalMinutes / 60) % 24;
  const min = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + String(min).padStart(2, '0') + ampm;
}

function cellDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s) || /^[\d.]+E[+-]?\d+$/i.test(s)) {
    return excelSerialToIso(Number(s)) || s;
  }
  return parseLooseDate(s);
}

const records = [];
for (let r = 5; r <= maxRow; r++) {
  const row = grid[r] || [];
  const no = String(row[0] || '').trim();
  const unit = String(row[1] || '').trim();
  const date = cellDate(row[2]);
  const time = formatExcelTime(row[3]);
  const agent = String(row[4] || '').trim();
  const phone = String(row[5] || '').trim();
  const notes = String(row[6] || '').trim();
  if (/^(#|units|date)$/i.test(no) || /^units$/i.test(unit)) continue;
  if (!unit && !date && !time && !agent && !phone && !notes) continue;
  records.push({ no, unit, date, time, agent, phone, notes });
}

const dataJsPath = path.join(__dirname, '..', 'assets', 'empire-electric-minus-data.js');
const dataJs =
  '/* Electric Minus log imported from Electric minus.xlsx — standalone electrical section. */\n' +
  'window.EMPIRE_ELECTRIC_MINUS=' + JSON.stringify(records) + ';\n';
fs.writeFileSync(dataJsPath, dataJs);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
console.log('wrote', dataJsPath, 'records', records.length);
