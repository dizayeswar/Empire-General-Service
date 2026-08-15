const fs = require('fs');
const path = require('path');
const V = '2026-08-15-v2';
const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', '.git', 'supabase', 'scripts', 'tools', 'migration-data', 'agent-tools', 'agent-transcripts']);

function walk(d, out = []) {
  for (const name of fs.readdirSync(d)) {
    if (skip.has(name)) continue;
    const p = path.join(d, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const re = /(href|src)=(["'])((?:\.?\/)?(?:assets\/[^"'?]+|config\.js|firebase-messaging-sw\.js|manifest\.webmanifest))(?:\?[^"']*)?\2/g;
let n = 0;
for (const f of walk(root)) {
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(re, (_, attr, q, url) => attr + '=' + q + url + '?v=' + V + q);
  if (after !== before) {
    fs.writeFileSync(f, after);
    n++;
    console.log('updated', path.relative(root, f));
  }
}
console.log('done', n, 'files ->', V);
