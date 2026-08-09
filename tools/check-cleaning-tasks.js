const fs = require('fs');

function extractMap(src) {
  const markers = ['var TASK_MAP =', 'const taskMap =', 'let taskMap ='];
  let start = -1;
  for (const m of markers) {
    const i = src.indexOf(m);
    if (i >= 0) { start = i; break; }
  }
  if (start < 0) return {};
  // Find matching closing }; after start
  let i = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) return {};
  return src.slice(start, end);
}

function extractProjectTasks(src) {
  const mapSrc = extractMap(src);
  const out = {};
  for (const p of ['ec', 'es', 'wd', 'ww', 'ww2', 'ra']) {
    const needle = p + ':';
    const i = mapSrc.indexOf(needle);
    if (i < 0) { out[p] = null; continue; }
    let block = mapSrc.slice(i, i + 5000);
    // Cut at the next project key (supports mobile + portal indentation).
    const reCut = /\n\s+(ec|es|wd|ww2|ww|ra)\s*:/g;
    let end = block.length;
    let cm;
    while ((cm = reCut.exec(block))) {
      if (cm.index < 2) continue;
      if (cm[1] === p) continue;
      end = cm.index;
      break;
    }
    block = block.slice(0, end);
    const groups = [];
    const re = /tasks:\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(block))) {
      const tasks = [];
      const tre = /'([^']+)'/g;
      let t;
      while ((t = tre.exec(m[1]))) tasks.push(t[1]);
      if (tasks.length) groups.push(tasks);
    }
    out[p] = groups;
  }
  return out;
}

const mobile = extractProjectTasks(fs.readFileSync('assets/cleaning-mobile-app.js', 'utf8'));
const portal = extractProjectTasks(fs.readFileSync('cleaning-dashboard.html', 'utf8'));

let ok = true;
for (const p of Object.keys(mobile)) {
  const a = JSON.stringify(mobile[p]);
  const b = JSON.stringify(portal[p]);
  const flat = (mobile[p] || []).flat();
  const seen = new Set();
  const dups = [];
  flat.forEach((t) => {
    if (seen.has(t)) dups.push(t);
    seen.add(t);
  });
  const match = a === b;
  console.log(
    p,
    match ? 'MATCH' : 'DIFF',
    'groups=' + (mobile[p] || []).length,
    'tasks=' + flat.length,
    dups.length ? 'DUPS=' + dups.join('|') : 'unique-ok'
  );
  if (!match) {
    ok = false;
    console.log('  mobile', a);
    console.log('  portal', b);
  }
  if (dups.length) ok = false;
}
process.exit(ok ? 0 : 1);
