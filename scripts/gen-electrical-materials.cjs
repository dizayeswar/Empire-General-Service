/* Generate MEP catalog into assets/empire-electrical-materials.js (keeps picker UI). */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Inventory Bezhan 12311 (2).xlsx'
);
const jsPath = path.join(__dirname, '..', 'assets', 'empire-electrical-materials.js');

const wb = XLSX.readFile(xlsxPath, { cellStyles: true });
const ws = wb.Sheets.MEP;
if (!ws) throw new Error('Sheet MEP not found in ' + xlsxPath);

const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

function cellRgb(cell) {
  return ((cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb) || '').toUpperCase();
}

/** CAI uses soft-red FFC7CE; MEP uses soft-yellow FFEB9C for priority rows. */
function highlightKind(rgb) {
  if (!rgb || rgb === 'NONE') return null;
  if (rgb === 'FFC7CE' || rgb.endsWith('C7CE')) return 'red';
  if (rgb === 'FFEB9C' || rgb.endsWith('EB9C')) return 'yellow';
  if (rgb !== 'FFFFFF' && rgb !== '000000') return 'other';
  return null;
}

const items = [];
for (let R = 1; R < rows.length; R++) {
  const code = String(rows[R][0] || '').trim();
  const desc = String(rows[R][1] || '').trim().replace(/\s+/g, ' ');
  if (!code && !desc) continue;
  const cellA = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
  const cellB = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
  const kind = highlightKind(cellRgb(cellA)) || highlightKind(cellRgb(cellB));
  const sp = /^SP[-]?/i.test(code);
  const name = code && desc ? code + ' ' + desc : code || desc;
  const highlighted = !!kind;
  items.push({
    name,
    variants: [],
    priority: !!(highlighted || sp),
    red: kind === 'red',
    yellow: kind === 'yellow' || kind === 'other',
  });
}

items.sort((a, b) => {
  const ha = a.red || a.yellow ? 0 : 1;
  const hb = b.red || b.yellow ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const sa = /^SP[-]?/i.test(a.name) ? 0 : 1;
  const sb = /^SP[-]?/i.test(b.name) ? 0 : 1;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
});

const catalogLines = items
  .map((it) => {
    const parts = ['name: ' + JSON.stringify(it.name), 'variants: []'];
    if (it.priority) parts.push('priority: true');
    if (it.red) parts.push('red: true');
    if (it.yellow) parts.push('yellow: true');
    return '    { ' + parts.join(', ') + ' }';
  })
  .join(',\n');

const existing = fs.readFileSync(jsPath, 'utf8');
const marker = '  function formatSelection(name, variant)';
const idx = existing.indexOf(marker);
if (idx < 0) throw new Error('Could not find picker body marker in ' + jsPath);
const rest = existing.slice(idx);

const js =
  '/* Empire Electrical Department — MEP inventory materials (Inventory Bezhan sheet MEP) */\n' +
  '(function () {\n' +
  '  var CATALOG = [\n' +
  catalogLines +
  '\n  ];\n\n' +
  rest;

fs.writeFileSync(jsPath, js);
console.log(
  'wrote',
  jsPath,
  'items',
  items.length,
  'yellow',
  items.filter((i) => i.yellow).length,
  'red',
  items.filter((i) => i.red).length
);
