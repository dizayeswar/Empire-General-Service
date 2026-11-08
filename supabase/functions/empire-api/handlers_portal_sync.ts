import { AuthOk } from "./auth.ts";
import { isoNow, sb } from "./db.ts";
import { type AccessLevel, isAdminAccount, moduleLevel } from "./helpers.ts";

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

// Application → Sync to portal. A person sends Unit Code + phone; the invite bot on the office
// PC (invite-bot/website_bot.py) asks for work, updates SAP, sends the portal invitation and
// writes each step back here so the page shows the progress. Own tables only:
// portal_sync_requests + portal_sync_bot_state.

const TABLE = "portal_sync_requests";
const BOT_STATE = "portal_sync_bot_state";
const ACTIVE = ["waiting", "sap", "sap_done", "portal"];
const BOT_STATUSES = ["waiting", "sap", "sap_done", "portal", "done", "failed"];
const LIST_LIMIT = 300;

function fail(message: string, error = "not_allowed") {
  return { ok: false, success: false, error, message };
}

function level(auth: AuthOk): AccessLevel {
  return isAdminAccount(auth.role, auth.moduleAccess) ? "write" : moduleLevel(auth.moduleAccess, "app_portal");
}

/** "es 4 8 06" / "ww_13_24_h" → "ES-4-8-06" / "WW-13-24-H"; "" when it is not a unit code. */
export function normUnitCode(raw: unknown): string {
  const parts = String(raw ?? "").trim().toUpperCase().split(/[\s\-_/.]+/).filter(Boolean);
  const code = parts.join("-");
  if (!/^[A-Z]{2}(-[A-Z0-9]{1,3}){3}$/.test(code)) return "";
  if (!/\d/.test(code.slice(3))) return "";
  return code;
}

/** "0750 123 4567" / "+964 750 123 4567" → "07501234567"; "" when it is not 07XXXXXXXXX. */
export function normPhone(raw: unknown): string {
  let d = String(raw ?? "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0)).replace(/\D/g, "");
  if (d.startsWith("00964")) d = "0" + d.slice(5);
  else if (d.startsWith("964")) d = "0" + d.slice(3);
  else if (d.length === 10 && d.startsWith("7")) d = "0" + d;
  return /^07\d{9}$/.test(d) ? d : "";
}

function toApi(r: Row) {
  return {
    id: String(r.id || ""),
    unitCode: String(r.unit_code || ""),
    phone: String(r.phone || ""),
    status: String(r.status || ""),
    result: String(r.result || ""),
    message: String(r.message || ""),
    createdBy: String(r.created_by || ""),
    cancelledBy: String(r.cancelled_by || ""),
    createdAt: String(r.created_at || ""),
    updatedAt: String(r.updated_at || ""),
    finishedAt: String(r.finished_at || ""),
  };
}

async function botLastSeen(): Promise<string> {
  const { data } = await sb().from(BOT_STATE).select("last_seen").eq("id", "default").maybeSingle();
  return String(data?.last_seen || "");
}

export async function handleGetPortalSyncRequests(_body: Body, auth: AuthOk) {
  if (level(auth) === "none") return fail("No access to Sync to portal.");
  const { data, error } = await sb().from(TABLE).select("*")
    .order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw error;
  return {
    ok: true,
    requests: (data || []).map(toApi),
    botLastSeen: await botLastSeen(),
    serverNow: isoNow(),
    canWrite: level(auth) === "write",
  };
}

export async function handleAddPortalSyncRequest(body: Body, auth: AuthOk) {
  if (level(auth) !== "write") return fail("You can only look at Sync to portal, not send.");
  const unitCode = normUnitCode(body.unitCode);
  if (!unitCode) return fail("Unit Code must look like ES-4-8-06 or WW-13-24-H.", "bad_unit_code");
  const phone = normPhone(body.phone);
  if (!phone) return fail("Phone must be 07XXXXXXXXX (11 digits).", "bad_phone");

  const { data: busy, error: busyErr } = await sb().from(TABLE).select("unit_code, phone, status")
    .in("status", ACTIVE).or(`unit_code.eq.${unitCode},phone.eq.${phone}`);
  if (busyErr) throw busyErr;
  if (busy && busy.length) {
    const b = busy[0];
    return fail(`Already being processed: ${b.unit_code} / ${b.phone}. Wait until it finishes.`, "duplicate");
  }

  const now = isoNow();
  const row = {
    id: `psync-${crypto.randomUUID()}`,
    unit_code: unitCode,
    phone,
    status: "waiting",
    result: "",
    message: "Waiting for the bot",
    created_by: auth.username,
    created_at: now,
    updated_at: now,
  };
  const { error } = await sb().from(TABLE).insert(row);
  if (error) throw error;
  return { ok: true, success: true, request: toApi(row) };
}

export async function handleCancelPortalSyncRequest(body: Body, auth: AuthOk) {
  if (level(auth) !== "write") return fail("You can only look at Sync to portal, not cancel.");
  const id = String(body.id || "").trim();
  if (!id) return fail("Missing request.", "missing_id");
  const now = isoNow();
  const { data, error } = await sb().from(TABLE)
    .update({ status: "cancelled", message: "Cancelled", cancelled_by: auth.username, updated_at: now, finished_at: now })
    .eq("id", id).eq("status", "waiting").select("*");
  if (error) throw error;
  if (!data || !data.length) return fail("Only a request that is still Waiting can be cancelled.", "not_waiting");
  return { ok: true, success: true, request: toApi(data[0]) };
}

/** Bot: everything not finished yet, oldest first. Also marks the bot as online. */
export async function handleGetPortalSyncWork(_body: Body, auth: AuthOk) {
  if (level(auth) !== "write") return fail("This account cannot run the Sync to portal bot.");
  const now = isoNow();
  const { error: stErr } = await sb().from(BOT_STATE)
    .upsert({ id: "default", last_seen: now, note: auth.username });
  if (stErr) throw stErr;
  const { data, error } = await sb().from(TABLE).select("*").in("status", ACTIVE)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return { ok: true, requests: (data || []).map(toApi) };
}

/** Bot: move a request to the next step. `from` = the status it must still have
 * (so a request cancelled a second ago is never picked up). */
export async function handleUpdatePortalSyncRequest(body: Body, auth: AuthOk) {
  if (level(auth) !== "write") return fail("This account cannot run the Sync to portal bot.");
  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim();
  const from = String(body.from || "").trim();
  if (!id) return fail("Missing request.", "missing_id");
  if (BOT_STATUSES.indexOf(status) === -1) return fail(`Unknown status ${status}.`, "bad_status");
  if (from && ACTIVE.indexOf(from) === -1) return fail(`Unknown from-status ${from}.`, "bad_status");
  const now = isoNow();
  const patch: Row = {
    status,
    message: String(body.message ?? "").slice(0, 1000),
    updated_at: now,
  };
  if (body.result != null) patch.result = String(body.result).slice(0, 100);
  if (status === "done" || status === "failed") patch.finished_at = now;
  let q = sb().from(TABLE).update(patch).eq("id", id);
  q = from ? q.eq("status", from) : q.in("status", ACTIVE);
  const { data, error } = await q.select("*");
  if (error) throw error;
  if (!data || !data.length) return { ok: true, success: true, updated: false };
  return { ok: true, success: true, updated: true, request: toApi(data[0]) };
}
