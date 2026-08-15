const fs = require('fs');
const path = require('path');
const V = process.argv[2] || '2026-08-15-v2';
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

const cfgPath = path.join(root, 'config.js');
let cfg = fs.readFileSync(cfgPath, 'utf8');
cfg = cfg.replace(/const APP_VERSION = '[^']+'/, "const APP_VERSION = '" + V + "'");
fs.writeFileSync(cfgPath, cfg);

const swPath = path.join(root, 'firebase-messaging-sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/var CACHE_VERSION = '[^']+'/, "var CACHE_VERSION = '" + V + "'");
fs.writeFileSync(swPath, sw);

const updPath = path.join(root, 'assets', 'empire-sw-update.js');
let upd = fs.readFileSync(updPath, 'utf8');
upd = upd.replace(/: '[0-9]{4}-[0-9]{2}-[0-9]{2}[^']*'/, ": '" + V + "'");
fs.writeFileSync(updPath, upd);

console.log('done', n, 'html files + config/sw ->', V);
