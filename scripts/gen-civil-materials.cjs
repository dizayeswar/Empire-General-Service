/* Generate assets/empire-civil-materials.js from Inventory Bezhan CAI sheet. */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Inventory Bezhan 12311 (2).xlsx'
);
const outPath = path.join(__dirname, '..', 'assets', 'empire-civil-materials.js');

const wb = XLSX.readFile(xlsxPath, { cellStyles: true });
const ws = wb.Sheets.CAI;
if (!ws) throw new Error('Sheet CAI not found in ' + xlsxPath);

const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

function isRedCell(cell) {
  const rgb = ((cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb) || '').toUpperCase();
  return rgb === 'FFC7CE' || rgb.endsWith('C7CE');
}

const items = [];
for (let R = 1; R < rows.length; R++) {
  const code = String(rows[R][0] || '').trim();
  const desc = String(rows[R][1] || '').trim().replace(/\s+/g, ' ');
  if (!code && !desc) continue;
  const cellA = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
  const cellB = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
  const red = isRedCell(cellA) || isRedCell(cellB);
  const sp = /^SP[-]?/i.test(code);
  const name = code && desc ? code + ' ' + desc : code || desc;
  items.push({ name, variants: [], priority: !!(red || sp), red: !!red });
}

items.sort((a, b) => {
  const ra = a.red ? 0 : 1;
  const rb = b.red ? 0 : 1;
  if (ra !== rb) return ra - rb;
  const sa = /^SP[-]?/i.test(a.name) ? 0 : 1;
  const sb = /^SP[-]?/i.test(b.name) ? 0 : 1;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
});

const lines = items
  .map((it) => {
    const parts = ['name: ' + JSON.stringify(it.name), 'variants: []'];
    if (it.priority) parts.push('priority: true');
    if (it.red) parts.push('red: true');
    return '    { ' + parts.join(', ') + ' }';
  })
  .join(',\n');

const js =
  '/* Empire Civil Department — CAI inventory materials (Inventory Bezhan sheet CAI) */\n' +
  '(function () {\n' +
  '  var CATALOG = [\n' +
  lines +
  '\n  ];\n\n' +
  '  window.EMPIRE_CIVIL_MATERIALS = CATALOG;\n' +
  '  window.EMPIRE_MATERIALS_CATALOG = CATALOG;\n' +
  '})();\n';

fs.writeFileSync(outPath, js);
console.log('wrote', outPath, 'items', items.length, 'red', items.filter((i) => i.red).length);
