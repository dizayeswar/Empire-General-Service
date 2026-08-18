/* Generate assets/empire-warehouse-sp.js from Inventory Bezhan Sheet1 (SP- only). */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Inventory Bezhan 12311 (3).xlsx'
);
const outPath = path.join(__dirname, '..', 'assets', 'empire-warehouse-sp.js');

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets.Sheet1;
if (!ws) throw new Error('Sheet1 not found in ' + xlsxPath);

const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const items = [];
for (let R = 1; R < rows.length; R++) {
  const code = String(rows[R][0] || '').trim();
  const desc = String(rows[R][1] || '').trim().replace(/\s+/g, ' ');
  if (!code || !/^SP[-]?/i.test(code)) continue;
  items.push({ code, desc });
}

items.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

const lines = items
  .map((it) => '    { code: ' + JSON.stringify(it.code) + ', desc: ' + JSON.stringify(it.desc) + ' }')
  .join(',\n');

const js =
  '/* Empire Warehouse — Sheet1 SP- item codes (Inventory Bezhan) */\n' +
  '(function () {\n' +
  '  var CATALOG = [\n' +
  lines +
  '\n  ];\n\n' +
  '  window.EMPIRE_WAREHOUSE_SP = CATALOG;\n' +
  '  window.empireWarehouseFindSp = function (q) {\n' +
  '    q = String(q || \"\").trim().toLowerCase();\n' +
  '    if (!q) return [];\n' +
  '    var out = [];\n' +
  '    for (var i = 0; i < CATALOG.length && out.length < 40; i++) {\n' +
  '      var it = CATALOG[i];\n' +
  '      var hay = (it.code + \" \" + it.desc).toLowerCase();\n' +
  '      if (hay.indexOf(q) !== -1) out.push(it);\n' +
  '    }\n' +
  '    return out;\n' +
  '  };\n' +
  '  window.empireWarehouseSpByCode = function (code) {\n' +
  '    code = String(code || \"\").trim().toUpperCase();\n' +
  '    for (var i = 0; i < CATALOG.length; i++) {\n' +
  '      if (String(CATALOG[i].code).toUpperCase() === code) return CATALOG[i];\n' +
  '    }\n' +
  '    return null;\n' +
  '  };\n' +
  '})();\n';

fs.writeFileSync(outPath, js);
console.log('wrote', outPath, 'SP items', items.length);
