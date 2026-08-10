/**
 * Re-import only users with correct department/Projects/Trade column mapping.
 * Uses same env as import-to-supabase.mjs:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportPath = path.resolve(__dirname, '..', 'migration-data', 'export.json');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const rows = data.sheets.Users.rows || [];
const byUser = new Map();
for (const r of rows) {
  const username = String(r.username || '').trim().toLowerCase();
  if (!username) continue;
  const plain = String(r.password || '').trim();
  byUser.set(username, {
    username,
    password_hash: plain ? await bcrypt.hash(plain, 10) : '',
    dept: String(r.dept || r.department || '').trim(),
    role: String(r.role || '').trim(),
    hide: String(r.hide || '').trim(),
    projects: String(r.projects || r.Projects || '').trim(),
    trade: String(r.trade || r.Trade || '').trim(),
    hide_electrical: String(r.hideElectrical || r.hide_electrical || '').trim(),
  });
}
const out = [...byUser.values()];
const { error } = await sb.from('users').upsert(out, { onConflict: 'username' });
if (error) throw error;
console.log('Updated users:', out.length);
console.log('Sample dizaye:', out.find((u) => u.username === 'dizaye'));
