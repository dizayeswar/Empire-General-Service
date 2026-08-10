/**
 * Minimal smoke test against a deployed empire-api Edge Function.
 *
 *   set EMPIRE_API_URL=https://xxx.supabase.co/functions/v1/empire-api
 *   set SMOKE_USER=admin_username
 *   set SMOKE_PASS=password
 *   node scripts/smoke-api.mjs
 */

const url = process.env.EMPIRE_API_URL || "";
const username = process.env.SMOKE_USER || "";
const password = process.env.SMOKE_PASS || "";

if (!url || !username || !password) {
  console.error("Set EMPIRE_API_URL, SMOKE_USER, SMOKE_PASS");
  process.exit(1);
}

async function call(body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON: " + text.slice(0, 200)); }
  return data;
}

const health = await fetch(url, { method: "GET" });
console.log("GET", health.status, await health.text());

const login = await call({ action: "login", username, password, dept: "auto" });
console.log("login", login.ok, login.role || login.error);
if (!login.ok) process.exit(1);

const perms = await call({ action: "getPerms", token: login.token });
console.log("getPerms", perms.ok, perms.role);

const summary = await call({ action: "getSummary", token: login.token });
console.log("getSummary", summary.ok, Object.keys(summary.summary || {}));

console.log("Smoke OK");
