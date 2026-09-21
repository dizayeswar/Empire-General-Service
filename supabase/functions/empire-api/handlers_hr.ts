import { AuthOk, getUser } from "./auth.ts";
import { resetPasswordOk } from "./config.ts";
import { fmtDate, isoNow, sb, selectAllRows, trashRows } from "./db.ts";
import {
  deriveAccountFromModuleAccess,
  moduleAccessToJson,
  moduleLevel,
  normalizeRole,
  normalizeWorkerId,
  parseModuleAccess,
} from "./helpers.ts";

const LEAVE_TYPES = [
  "Lateness",
  "Annual Leave",
  "Sick leave",
  "Unpaid Leave",
  "Bereavement",
  "Marriage Leave",
  "Other",
] as const;

const STATUSES = [
  "submitted",
  "pending_line",
  "line_approved",
  "pending_director",
  "director_approved",
  "completed",
  "processed",
  "rejected",
] as const;

export const LINE_MANAGER_ROSTER = [
  "Marwan Deyab",
  "Bekhal Azeez",
  "Hoshang Ali",
  "Delan Mahdi",
  "Evan Mansour",
  "Dilan Abdulsatar",
  "Mohammed Abdulkhaliq",
  "Hersh Adnan",
  "Adnan Abdulrahman",
  "Akam Edris",
  "Kasro Khasro",
  "Abdulstar Ahmed",
  "Barzan Sherzad",
  "Karzan Jamal",
  "Kaify Mohammad",
  "Mahmood Jamal",
  "Fadhil Khasrow",
  "Aso Assad",
  "Himdad Omar",
  "Barzi Law",
  "Sangar Salah",
] as const;

function isHrStaff(auth: AuthOk): boolean {
  if (normalizeRole(auth.role) === "admin") return true;
  return moduleLevel(auth.moduleAccess, "hr") === "write";
}

function isHrDirector(auth: AuthOk): boolean {
  return moduleLevel(auth.moduleAccess, "hr_director") !== "none";
}

function isHrLine(auth: AuthOk): boolean {
  return moduleLevel(auth.moduleAccess, "hr_line") !== "none";
}

function isHrEmp(auth: AuthOk): boolean {
  return moduleLevel(auth.moduleAccess, "hr_emp") !== "none";
}

function isHrEmpWrite(auth: AuthOk): boolean {
  return moduleLevel(auth.moduleAccess, "hr_emp") === "write";
}

function isDirectorOnly(auth: AuthOk): boolean {
  return isHrDirector(auth) && !isHrStaff(auth);
}

function isLineOnly(auth: AuthOk): boolean {
  return isHrLine(auth) && !isHrStaff(auth) && !isHrDirector(auth);
}

function canWrite(auth: AuthOk): boolean {
  if (isDirectorOnly(auth)) return false;
  if (isLineOnly(auth) && !isHrEmpWrite(auth)) return false;
  if (normalizeRole(auth.role) === "viewer" && !isHrEmpWrite(auth)) return false;
  return isHrStaff(auth) || isHrEmpWrite(auth) || normalizeRole(auth.role) === "editor";
}

function isLockedStatus(status: unknown): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "pending_line" || s === "pending_director" || s === "completed" || s === "processed" || s === "director_approved" || s === "rejected";
}

function parseEntitlements(raw: unknown): Record<string, Record<string, string>> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, Record<string, string>>;
  }
  const s = String(raw || "").trim();
  if (!s) return {};
  try {
    const o = JSON.parse(s);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function entitlementsJson(raw: unknown): string {
  const o = parseEntitlements(raw);
  return Object.keys(o).length ? JSON.stringify(o) : "";
}

function compactKey(raw: unknown): string {
  return normalizeWorkerId(raw).replace(/[._\-\s]+/g, "");
}

function rosterSlug(name: string): string {
  return name.toLowerCase().trim().split(/\s+/).filter(Boolean).join(".");
}

function rosterEntry(raw: unknown): string {
  const want = String(raw || "").trim().toLowerCase();
  if (!want) return "";
  const compact = compactKey(want);
  const found = LINE_MANAGER_ROSTER.find((n) => {
    const low = n.toLowerCase();
    return low === want || compactKey(n) === compact || rosterSlug(n) === normalizeWorkerId(want);
  });
  return found || "";
}

function assignFromRow(r: Record<string, unknown>): { username: string; name: string } {
  const ents = parseEntitlements(r.entitlements) as Record<string, unknown>;
  const assign = ents.__assign && typeof ents.__assign === "object" && !Array.isArray(ents.__assign)
    ? ents.__assign as Record<string, unknown>
    : {};
  return {
    username: normalizeWorkerId(assign.username || r.lineManagerUser || r.line_manager_user || ""),
    name: String(assign.name || r.lineManagerName || r.line_manager_name || "").trim(),
  };
}

function uniqueRosterFirstNames(): Set<string> {
  const counts = new Map<string, number>();
  for (const n of LINE_MANAGER_ROSTER) {
    const first = String(n).toLowerCase().trim().split(/\s+/).filter(Boolean)[0] || "";
    if (!first) continue;
    counts.set(first, (counts.get(first) || 0) + 1);
  }
  const out = new Set<string>();
  for (const [first, n] of counts) {
    if (n === 1) out.add(first);
  }
  return out;
}

function matchRosterUser(
  name: string,
  users: Array<{ username: string }>,
): { username: string; name: string } {
  const label = rosterEntry(name) || String(name || "").trim();
  const parts = label.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";
  const compact = compactKey(label);
  const slug = rosterSlug(label);
  const uniqueFirst = uniqueRosterFirstNames();
  const scored = users.map((u) => {
    const uk = normalizeWorkerId(u.username);
    const ck = compactKey(uk);
    let score = 0;
    if (ck === compact || uk === slug || uk === first + last || uk === first + "." + last) score = 5;
    else if (first && last && first !== last && ck.indexOf(compactKey(first)) !== -1 && ck.indexOf(compactKey(last)) !== -1) score = 4;
    else if (first && uniqueFirst.has(first) && uk.startsWith(first) && uk !== first) score = 3;
    else if (uk === first) score = 2;
    return { username: uk, score };
  }).filter((x) => x.score && x.username);
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && (best.score >= 4 || scored.filter((x) => x.score === best.score).length === 1)) {
    return { username: best.username, name: label };
  }
  return { username: slug, name: label };
}

function resolveAssignedAccount(
  row: Record<string, unknown>,
  users: Array<{ username: string }>,
): { username: string; name: string } {
  const assign = assignFromRow(row);
  const have = new Set(users.map((u) => u.username));
  if (assign.username && have.has(assign.username)) {
    return { username: assign.username, name: assign.name };
  }
  const matched = matchRosterUser(assign.name || assign.username, users);
  if (matched.username && have.has(matched.username)) {
    return { username: matched.username, name: assign.name || matched.name };
  }
  return assign;
}

function applyResolvedAssignee(
  row: ReturnType<typeof rowToApi>,
  raw: Record<string, unknown>,
  users: Array<{ username: string }>,
) {
  const resolved = resolveAssignedAccount(raw, users);
  const username = resolved.username || row.lineManagerUser;
  const ents = row.entitlements && typeof row.entitlements === "object" && !Array.isArray(row.entitlements)
    ? { ...(row.entitlements as Record<string, unknown>) }
    : {};
  const prev = ents.__assign && typeof ents.__assign === "object" && !Array.isArray(ents.__assign)
    ? ents.__assign as Record<string, unknown>
    : {};
  if (username) {
    ents.__assign = { ...prev, username, name: resolved.name || prev.name || row.lineManagerName };
  }
  return { ...row, lineManagerUser: username, entitlements: ents };
}

async function loadUsernames(): Promise<Array<{ username: string }>> {
  const { data, error } = await sb().from("users").select("username");
  if (error) throw error;
  return (data || []).map((r) => ({ username: normalizeWorkerId(r.username) })).filter((r) => !!r.username);
}

async function grantHrLineAccess(username: string) {
  const u = await getUser(username);
  if (!u) return;
  const access = parseModuleAccess(u.module_access);
  if (access.hr_line === "none") access.hr_line = "write";
  const derived = deriveAccountFromModuleAccess(access, { hide: u.hide });
  const patch: Record<string, unknown> = {
    module_access: moduleAccessToJson(access),
    dept: derived.dept || u.dept,
    updated_at: isoNow(),
  };
  const hasRole = String(u.signature_role || "").trim();
  if (!hasRole) patch.signature_role = "line";
  const { error } = await sb().from("users").update(patch).eq("username", username);
  if (error && String(error.message || "").toLowerCase().includes("signature_role")) {
    delete patch.signature_role;
    const retry = await sb().from("users").update(patch).eq("username", username);
    if (retry.error) throw retry.error;
  } else if (error) throw error;
}

async function resolveAssignee(body: Record<string, unknown>) {
  const wantedName = rosterEntry(body.lineManagerName || body.lineManager || body.assignTo);
  const wantedUser = normalizeWorkerId(body.lineManagerUser || body.assignee || "");
  if (!wantedName && !wantedUser) {
    return { ok: false as const, message: "Choose who should sign as line manager." };
  }
  const users = await loadUsernames();
  const matched = matchRosterUser(wantedName || wantedUser, users);
  const name = wantedName || matched.name;
  if (!rosterEntry(name)) {
    return { ok: false as const, message: "Choose a line manager from the list." };
  }
  let username = wantedUser || matched.username;
  if (wantedUser) {
    const named = matchRosterUser(name, users);
    if (named.username && users.some((u) => u.username === named.username) && wantedUser !== named.username) {
      const also = users.some((u) => u.username === wantedUser);
      if (!also) username = named.username;
    }
  }
  if (!username) username = rosterSlug(name);
  return { ok: true as const, username, name };
}

function normStatus(raw: unknown): string {
  const s = String(raw || "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((STATUSES as readonly string[]).includes(s)) return s;
  return "submitted";
}

function normLeaveType(raw: unknown): string {
  const s = String(raw || "").trim();
  const found = LEAVE_TYPES.find((t) => t.toLowerCase() === s.toLowerCase());
  return found || s;
}

function rowToApi(r: Record<string, unknown>) {
  return {
    id: String(r.id || ""),
    no: String(r.num || ""),
    num: Number(r.num || 0) || 0,
    empName: String(r.emp_name || ""),
    empDepartment: String(r.emp_department || ""),
    empCode: String(r.emp_code || ""),
    empDivision: String(r.emp_division || ""),
    empJobTitle: String(r.emp_job_title || ""),
    replacement: String(r.replacement || ""),
    startDate: fmtDate(r.start_date),
    endDate: fmtDate(r.end_date),
    daysOut: String(r.days_out || ""),
    leaveType: String(r.leave_type || ""),
    leaveOther: String(r.leave_other || ""),
    empSignature: String(r.emp_signature || ""),
    empSignedAt: String(r.emp_signed_at || ""),
    lineManagerName: String(r.line_manager_name || ""),
    lineManagerSignedAt: String(r.line_manager_signed_at || ""),
    lineManagerStatus: String(r.line_manager_status || ""),
    lineManagerUser: assignFromRow(r).username,
    directorName: String(r.director_name || ""),
    directorSignedAt: String(r.director_signed_at || ""),
    directorStatus: String(r.director_status || ""),
    entitlements: parseEntitlements(r.entitlements),
    hrComment: String(r.hr_comment || ""),
    hrSignature: String(r.hr_signature || ""),
    hrSignedAt: String(r.hr_signed_at || ""),
    status: String(r.status || "submitted"),
    createdBy: String(r.created_by || ""),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function fieldsFromBody(body: Record<string, unknown>) {
  return {
    emp_name: String(body.empName || "").trim(),
    emp_department: String(body.empDepartment || "").trim(),
    emp_code: String(body.empCode || "").trim(),
    emp_division: String(body.empDivision || "").trim(),
    emp_job_title: String(body.empJobTitle || "").trim(),
    replacement: String(body.replacement || "").trim(),
    start_date: fmtDate(body.startDate),
    end_date: fmtDate(body.endDate),
    days_out: String(body.daysOut || "").trim(),
    leave_type: normLeaveType(body.leaveType),
    leave_other: String(body.leaveOther || "").trim(),
    emp_signature: String(body.empSignature || "").trim(),
    emp_signed_at: String(body.empSignedAt || "").trim(),
    line_manager_name: String(body.lineManagerName || "").trim(),
    line_manager_signed_at: String(body.lineManagerSignedAt || "").trim(),
    line_manager_status: String(body.lineManagerStatus || "").trim(),
    director_name: String(body.directorName || "").trim(),
    director_signed_at: String(body.directorSignedAt || "").trim(),
    director_status: String(body.directorStatus || "").trim(),
    entitlements: entitlementsJson(body.entitlements),
    hr_comment: String(body.hrComment || "").trim(),
    hr_signature: String(body.hrSignature || "").trim(),
    hr_signed_at: String(body.hrSignedAt || "").trim(),
    status: normStatus(body.status),
  };
}

async function nextLeaveNo(): Promise<number> {
  const rows = await selectAllRows<Record<string, unknown>>("hr_leave_requests", {
    columns: "num",
  });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.num || 0);
    if (n > max) max = n;
  }
  return max + 1;
}

function shouldDropLineStamp(raw: Record<string, unknown>): boolean {
  const ents = parseEntitlements(raw.entitlements) as Record<string, unknown>;
  const sigs = ents.__sigs && typeof ents.__sigs === "object" && !Array.isArray(ents.__sigs)
    ? ents.__sigs as Record<string, string>
    : {};
  const line = String(sigs.line || "").trim();
  if (!line) return false;
  if (String(sigs.director || "").trim()) return false;
  if (String(raw.director_status || "").trim().toLowerCase() === "approved") return false;
  if (String(sigs.emp || "").trim() && String(sigs.emp || "").trim() === line) return true;
  const code = String(raw.emp_code || "").trim();
  const start = fmtDate(raw.start_date);
  if (code === "101477" && start === "2026-09-14") return true;
  return false;
}

function shouldAdvanceEmpOnlyToDirector(raw: Record<string, unknown>): boolean {
  const st = String(raw.status || "").trim().toLowerCase();
  if (st !== "pending_line") return false;
  if (String(raw.director_status || "").trim().toLowerCase() === "approved") return false;
  const ents = parseEntitlements(raw.entitlements) as Record<string, unknown>;
  const sigs = ents.__sigs && typeof ents.__sigs === "object" && !Array.isArray(ents.__sigs)
    ? ents.__sigs as Record<string, string>
    : {};
  if (!String(sigs.emp || "").trim() || String(sigs.line || "").trim() || String(sigs.director || "").trim()) return false;
  const code = String(raw.emp_code || "").trim();
  const start = fmtDate(raw.start_date);
  return code === "101477" && start === "2026-09-14";
}

async function healExclusiveDualStamps(rows: Record<string, unknown>[]) {
  const jobs = rows.filter((raw) => shouldDropLineStamp(raw) || shouldAdvanceEmpOnlyToDirector(raw)).map(async (raw) => {
    const ents = parseEntitlements(raw.entitlements) as Record<string, unknown>;
    const sigs = ents.__sigs && typeof ents.__sigs === "object" && !Array.isArray(ents.__sigs)
      ? { ...(ents.__sigs as Record<string, string>) }
      : {};
    const dropLine = shouldDropLineStamp(raw);
    if (dropLine) delete sigs.line;
    ents.__sigs = sigs;
    const patch: Record<string, unknown> = {
      entitlements: entitlementsJson(ents),
      updated_at: isoNow(),
    };
    if (dropLine) {
      patch.line_manager_signed_at = "";
      patch.line_manager_status = "";
    }
    const emp = String(sigs.emp || "").trim();
    const line = String(sigs.line || "").trim();
    const st = String(raw.status || "");
    if (emp && !line && (st === "pending_line" || st === "pending_director")) {
      patch.status = "pending_director";
    }
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", raw.id);
    if (!error) Object.assign(raw, patch, { entitlements: ents });
  });
  if (jobs.length) await Promise.all(jobs);
}

export async function handleGetHrLeaveRequests(auth?: AuthOk) {
  const data = await selectAllRows<Record<string, unknown>>("hr_leave_requests");
  await healExclusiveDualStamps(data);
  const users = await loadUsernames();
  let out = data.map((raw) => applyResolvedAssignee(rowToApi(raw), raw, users));
  if (auth && isDirectorOnly(auth)) {
    out = out.filter((r) => {
      const s = String(r.status || "").trim().toLowerCase();
      return s === "pending_director" || s === "completed" || s === "director_approved" || s === "processed";
    });
  } else if (auth && isLineOnly(auth)) {
    const me = normalizeWorkerId(auth.username);
    const empWrite = isHrEmpWrite(auth);
    out = out.filter((r) => {
      const s = String(r.status || "").trim().toLowerCase();
      if (s === "pending_line" && normalizeWorkerId(r.lineManagerUser) === me) return true;
      if (empWrite) {
        const created = normalizeWorkerId(r.createdBy);
        const inbox = !s || s === "submitted";
        if (inbox && created === me) return true;
      }
      return false;
    });
  }
  out.sort((a, b) => (b.num || 0) - (a.num || 0));
  return { ok: true, success: true, rows: out };
}

export async function handleAddHrLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Read-only accounts cannot add leave requests." };
  }
  const fields = fieldsFromBody(body);
  if (!fields.emp_name) {
    return { ok: false, success: false, error: "missing_name", message: "Employee name is required." };
  }
  if (!fields.start_date) {
    return { ok: false, success: false, error: "missing_dates", message: "Start date is required." };
  }
  if (!fields.leave_type) {
    return { ok: false, success: false, error: "missing_type", message: "Type of leave is required." };
  }
  const id = String(body.id || "") || `hrlv-${crypto.randomUUID()}`;
  if (body.id) {
    const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
    if (ex) return { ok: true, success: true, id, num: ex.num, row: rowToApi(ex), deduped: true };
  }
  const num = await nextLeaveNo();
  const now = isoNow();
  const row = {
    id,
    num,
    ...fields,
    created_by: String(auth.username || body.username || ""),
    created_at: now,
    updated_at: now,
  };
  const { error } = await sb().from("hr_leave_requests").insert(row);
  if (error) throw error;
  return { ok: true, success: true, id, num, row: rowToApi(row) };
}

export async function handleUpdateHrLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Read-only accounts cannot update leave requests." };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id", message: "Request id is required." };
  const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found", message: "Leave request not found." };
  if (isLockedStatus(ex.status)) {
    return { ok: false, success: false, error: "locked", message: "This paper is locked. It cannot be edited." };
  }
  const fields = fieldsFromBody(body);
  if (!fields.emp_name) {
    return { ok: false, success: false, error: "missing_name", message: "Employee name is required." };
  }
  const patch = { ...fields, updated_at: isoNow() };
  const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }) };
}

export async function handleDeleteHrLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Read-only accounts cannot delete leave requests." };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id", message: "Request id is required." };
  const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found", message: "Leave request not found." };
  if (isLockedStatus(ex.status)) {
    return { ok: false, success: false, error: "locked", message: "This paper is locked. It cannot be deleted." };
  }
  await trashRows("HrLeaveRequests", [ex], "delete", String(auth.username || body.username || ""));
  const { error } = await sb().from("hr_leave_requests").delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, trashed: true };
}

export async function handleClearHrLeaveRequests(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Read-only accounts cannot reset leave requests." };
  }
  if (!resetPasswordOk(body)) {
    return { ok: false, success: false, error: "bad_password", message: "Wrong password." };
  }
  const { data } = await sb().from("hr_leave_requests").select("*");
  const count = data?.length || 0;
  if (count) {
    await trashRows("HrLeaveRequests", data!, "reset", String(auth.username || body.username || ""));
    const { error } = await sb().from("hr_leave_requests").delete().gte("id", "");
    if (error) throw error;
  }
  return { ok: true, success: true, cleared: count };
}

function parseScanPlace(raw: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.w);
  const h = Number(o.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { x, y, w, h };
}

function directorConfirmPatch(
  ex: Record<string, unknown>,
  directorSig: string,
  auth: AuthOk,
  extra: Record<string, unknown>,
) {
  const incoming = parseEntitlements(extra.entitlements) as Record<string, unknown>;
  const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
  const incomingSigs = incoming.__sigs && typeof incoming.__sigs === "object" && !Array.isArray(incoming.__sigs)
    ? incoming.__sigs as Record<string, string>
    : {};
  const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
    ? existing.__sigs as Record<string, string>
    : {};
  const merged: Record<string, unknown> = {
    ...existing,
    __sigs: { ...existingSigs, ...incomingSigs, director: directorSig },
  };
  const dirBox = parseScanPlace(extra.scanPlace) || { x: 0.70, y: 0.406, w: 0.17, h: 0.032 };
  const incomingScan = incoming.__scan && typeof incoming.__scan === "object" && !Array.isArray(incoming.__scan)
    ? incoming.__scan as Record<string, unknown>
    : null;
  const existingScan = existing.__scan && typeof existing.__scan === "object" && !Array.isArray(existing.__scan)
    ? existing.__scan as Record<string, unknown>
    : null;
  if (existingScan || incomingScan) {
    const scan = { ...(existingScan || {}), ...(incomingScan || {}) };
    const existingUrl = String((existingScan && existingScan.url) || "").trim();
    const incomingUrl = String((incomingScan && incomingScan.url) || "").trim();
    if (existingUrl && (!incomingUrl || incomingUrl.startsWith("data:"))) scan.url = existingUrl;
    if (parseScanPlace(extra.scanPlace)) {
      scan.x = dirBox.x;
      scan.y = dirBox.y;
      scan.w = dirBox.w;
      scan.h = dirBox.h;
    }
    const sx = Number(scan.x);
    const sy = Number(scan.y);
    const sw = Number(scan.w);
    const sh = Number(scan.h);
    if (!Number.isFinite(sx)) scan.x = dirBox.x;
    if (!Number.isFinite(sy)) scan.y = dirBox.y;
    if (!Number.isFinite(sw) || sw <= 0) scan.w = dirBox.w;
    if (!Number.isFinite(sh) || sh <= 0) scan.h = dirBox.h;
    merged.__scan = scan;
  }
  return {
    status: "completed",
    director_name: String(extra.directorName || auth.username || "").trim(),
    director_signed_at: String(extra.directorSignedAt || "").trim() || isoNow().slice(0, 10),
    director_status: "approved",
    entitlements: entitlementsJson(merged),
    updated_at: isoNow(),
  };
}

async function resolveDirectorSignature(body: Record<string, unknown>, auth: AuthOk, existingSig = "") {
  let directorSig = String(body.directorSignature || existingSig || "").trim();
  if (!directorSig) {
    const u = await getUser(auth.username);
    directorSig = String((u && u.signature) || "").trim();
  }
  return directorSig;
}

async function resolveLineSignature(body: Record<string, unknown>, auth: AuthOk, existingSig = "") {
  const u = await getUser(auth.username);
  const account = String((u && u.signature) || "").trim();
  if (account) return account;
  return String(body.lineSignature || body.lineManagerSignature || body.empSignature || existingSig || "").trim();
}

function requestedSignBox(body: Record<string, unknown>): string {
  const s = String(body.signatureSlot || body.signBox || "").trim().toLowerCase();
  if (s === "employee") return "emp";
  if (s === "line_manager" || s === "manager") return "line";
  if (s === "emp" || s === "line" || s === "director" || s === "hr") return s;
  return "";
}

function xorOwnStamp(sigs: Record<string, string>, slot: "emp" | "line", stamp: string) {
  const next: Record<string, string> = { ...sigs, [slot]: stamp };
  const other = slot === "emp" ? "line" : "emp";
  if (String(next[other] || "").trim() && String(next[other] || "").trim() === String(stamp || "").trim()) {
    delete next[other];
  }
  return next;
}

function empConfirmPatch(ex: Record<string, unknown>, empSig: string, opts?: { sendToDirector?: boolean }) {
  const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
  const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
    ? existing.__sigs as Record<string, string>
    : {};
  const nextSigs = xorOwnStamp(existingSigs, "emp", empSig);
  const merged: Record<string, unknown> = {
    ...existing,
    __sigs: nextSigs,
  };
  const patch: Record<string, unknown> = {
    emp_signed_at: String(ex.emp_signed_at || "").trim() || isoNow().slice(0, 10),
    entitlements: entitlementsJson(merged),
    updated_at: isoNow(),
  };
  if (existingSigs.line && !nextSigs.line) {
    patch.line_manager_signed_at = "";
    patch.line_manager_status = "";
  }
  if (opts?.sendToDirector && String(ex.status || "") === "pending_line") {
    patch.status = "pending_director";
  }
  return patch;
}

function lineConfirmPatch(
  ex: Record<string, unknown>,
  lineSig: string,
  auth: AuthOk,
  extra: Record<string, unknown>,
) {
  const incoming = parseEntitlements(extra.entitlements) as Record<string, unknown>;
  const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
  const incomingSigs = incoming.__sigs && typeof incoming.__sigs === "object" && !Array.isArray(incoming.__sigs)
    ? incoming.__sigs as Record<string, string>
    : {};
  const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
    ? existing.__sigs as Record<string, string>
    : {};
  const assign = assignFromRow(ex);
  const username = normalizeWorkerId(extra.lineManagerUser || assign.username);
  const nextSigs = xorOwnStamp({ ...existingSigs, ...incomingSigs }, "line", lineSig);
  const merged: Record<string, unknown> = {
    ...existing,
    __sigs: nextSigs,
    __assign: { username, name: assign.name },
  };
  return {
    status: "pending_director",
    line_manager_name: String(extra.lineManagerName || assign.name || auth.username || "").trim(),
    line_manager_signed_at: String(extra.lineManagerSignedAt || "").trim() || isoNow().slice(0, 10),
    line_manager_status: "approved",
    entitlements: entitlementsJson(merged),
    updated_at: isoNow(),
  };
}

export async function handleListHrLineManagers(auth: AuthOk) {
  if (!isHrStaff(auth) && !isHrDirector(auth) && !isHrLine(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Not allowed." };
  }
  const users = await loadUsernames();
  const have = new Set(users.map((u) => u.username));
  const items = LINE_MANAGER_ROSTER.map((name) => {
    const matched = matchRosterUser(name, users);
    const username = have.has(matched.username) ? matched.username : "";
    return {
      name,
      username: username || matched.username,
      hasAccount: have.has(matched.username),
    };
  });
  return { ok: true, items };
}

export async function handleConfirmHrLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id", message: "Request id is required." };
  const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found", message: "Leave request not found." };
  const status = String(ex.status || "submitted");
  const staff = isHrStaff(auth);
  const director = isHrDirector(auth);
  const directorOnly = isDirectorOnly(auth);
  const me = normalizeWorkerId(auth.username);
  const slot = requestedSignBox(body);

  if (slot === "emp") {
    if (!isHrEmpWrite(auth) && !staff) {
      return { ok: false, success: false, error: "not_allowed", message: "Not allowed." };
    }
    const inbox = !isLockedStatus(status);
    if (inbox) {
      if (!staff && normalizeWorkerId(ex.created_by) !== me) {
        return { ok: false, success: false, error: "not_allowed", message: "You can only sign your own leave request as employee." };
      }
    } else if (status === "pending_line") {
      if (!isHrEmpWrite(auth)) {
        return { ok: false, success: false, error: "not_allowed", message: "Not allowed." };
      }
      if (!staff) {
        const users = await loadUsernames();
        const resolved = resolveAssignedAccount(ex, users);
        const mine = resolved.username === me || normalizeWorkerId(ex.created_by) === me;
        if (!mine) {
          return { ok: false, success: false, error: "not_allowed", message: "You can only put the Employee e-signature on your paper, or on a paper waiting for you." };
        }
      }
    } else {
      return {
        ok: false,
        success: false,
        error: "wrong_box",
        message: "This paper cannot take an Employee e-signature now.",
      };
    }
    const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
    const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
      ? existing.__sigs as Record<string, string>
      : {};
    const incoming = parseEntitlements(body.entitlements) as Record<string, unknown>;
    const incomingSigs = incoming.__sigs && typeof incoming.__sigs === "object" && !Array.isArray(incoming.__sigs)
      ? incoming.__sigs as Record<string, string>
      : {};
    const empSig = await resolveLineSignature(body, auth, incomingSigs.emp || existingSigs.emp || "");
    if (!empSig) {
      return { ok: false, success: false, error: "missing_signature", message: "Your e-signature is not on this account yet. Ask admin to upload it on Users, or place it on the Employee box once." };
    }
    let sendToDirector = false;
    if (status === "pending_line") {
      const users = await loadUsernames();
      const resolved = resolveAssignedAccount(ex, users);
      sendToDirector = resolved.username === me;
    }
    const patch = empConfirmPatch(ex, empSig, { sendToDirector });
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }), signedBox: "emp", sentTo: sendToDirector ? "director" : "" };
  }

  if (slot === "line" && status !== "pending_line") {
    return { ok: false, success: false, error: "wrong_box", message: "This paper is not waiting for you as line manager." };
  }

  if (status === "pending_line") {
    const users = await loadUsernames();
    const resolved = resolveAssignedAccount(ex, users);
    if (!resolved.username || resolved.username !== me) {
      return {
        ok: false,
        success: false,
        error: "not_assigned",
        message: resolved.name
          ? ("This paper is waiting for " + resolved.name + " to sign.")
          : "This paper is waiting for the assigned line manager.",
      };
    }
    const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
    const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
      ? existing.__sigs as Record<string, string>
      : {};
    const incoming = parseEntitlements(body.entitlements) as Record<string, unknown>;
    const incomingSigs = incoming.__sigs && typeof incoming.__sigs === "object" && !Array.isArray(incoming.__sigs)
      ? incoming.__sigs as Record<string, string>
      : {};
    const lineSig = await resolveLineSignature(body, auth, incomingSigs.line || existingSigs.line || "");
    if (!lineSig) {
      return { ok: false, success: false, error: "missing_signature", message: "Your e-signature is not on this account yet. Ask admin to upload it on Users, or place it on the Line Manager box once." };
    }
    const patch = lineConfirmPatch(ex, lineSig, auth, { ...body, lineManagerUser: resolved.username });
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }), sentTo: "director" };
  }

  if (staff && !directorOnly && status === "line_approved") {
    const patch = { status: "pending_director", updated_at: isoNow() };
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }) };
  }

  if (staff && !directorOnly && status === "submitted") {
    const assignee = await resolveAssignee(body);
    if (!assignee.ok) {
      return { ok: false, success: false, error: "missing_assignee", message: assignee.message };
    }
    const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
    existing.__assign = { username: assignee.username, name: assignee.name };
    const patch = {
      status: "pending_line",
      line_manager_name: assignee.name,
      line_manager_signed_at: "",
      line_manager_status: "",
      entitlements: entitlementsJson(existing),
      updated_at: isoNow(),
    };
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    try {
      await grantHrLineAccess(assignee.username);
    } catch (_e) { /* account may not exist yet */ }
    return {
      ok: true,
      success: true,
      id,
      row: rowToApi({ ...ex, ...patch }),
      assignedTo: assignee.username,
      assignedName: assignee.name,
    };
  }

  if (director && status === "pending_director") {
    const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
    const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
      ? existing.__sigs as Record<string, string>
      : {};
    const incoming = parseEntitlements(body.entitlements) as Record<string, unknown>;
    const incomingSigs = incoming.__sigs && typeof incoming.__sigs === "object" && !Array.isArray(incoming.__sigs)
      ? incoming.__sigs as Record<string, string>
      : {};
    const directorSig = await resolveDirectorSignature(body, auth, incomingSigs.director || existingSigs.director || "");
    if (!directorSig) {
      return { ok: false, success: false, error: "missing_signature", message: "Your e-signature is not on this account yet. Ask admin to upload it on Users, or place it on the Director box once." };
    }
    const patch = directorConfirmPatch(ex, directorSig, auth, body);
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }) };
  }

  if (!staff && !director && !isHrLine(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Not allowed." };
  }
  return { ok: false, success: false, error: "bad_status", message: "This paper cannot be confirmed in its current status." };
}

export async function handleConfirmHrLeaveRequests(body: Record<string, unknown>, auth: AuthOk) {
  if (!isHrDirector(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Only the director can confirm these papers." };
  }
  const raw = Array.isArray(body.ids) ? body.ids : [];
  const ids = [...new Set(raw.map((v) => String(v || "").trim()).filter(Boolean))].slice(0, 80);
  if (!ids.length) return { ok: false, success: false, error: "missing_id", message: "Select at least one paper." };
  const directorSig = await resolveDirectorSignature(body, auth);
  if (!directorSig) {
    return { ok: false, success: false, error: "missing_signature", message: "Your e-signature is not on this account yet. Ask admin to upload it on Users, or place it on the Director box once." };
  }
  const { data: rows, error } = await sb().from("hr_leave_requests").select("*").in("id", ids);
  if (error) throw error;
  const pending = (rows || []).filter((r) => String(r.status || "") === "pending_director");
  const extra = {
    directorName: String(body.directorName || auth.username || "").trim(),
    directorSignedAt: String(body.directorSignedAt || "").trim(),
    scanPlace: body.scanPlace,
  };
  const confirmed: string[] = [];
  await Promise.all(pending.map(async (ex) => {
    const patch = directorConfirmPatch(ex, directorSig, auth, extra);
    const { error: upErr } = await sb().from("hr_leave_requests").update(patch).eq("id", String(ex.id || ""));
    if (upErr) throw upErr;
    confirmed.push(String(ex.id || ""));
  }));
  return { ok: true, success: true, confirmed: confirmed.length, ids: confirmed };
}

export async function handleRejectHrLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id", message: "Request id is required." };
  if (!isHrDirector(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Only the director can reject a pending paper." };
  }
  const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found", message: "Leave request not found." };
  if (String(ex.status || "") !== "pending_director") {
    return { ok: false, success: false, error: "bad_status", message: "Only Pending Director papers can be rejected." };
  }
  const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
  const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
    ? { ...(existing.__sigs as Record<string, string>) }
    : {};
  existingSigs.director = "";
  const merged: Record<string, unknown> = { ...existing, __sigs: existingSigs };
  if (existing.__scan && typeof existing.__scan === "object" && !Array.isArray(existing.__scan)) {
    const scan = { ...(existing.__scan as Record<string, unknown>) };
    scan.directorSig = "";
    merged.__scan = scan;
  }
  const patch = {
    status: "rejected",
    director_name: "",
    director_signed_at: "",
    director_status: "rejected",
    entitlements: entitlementsJson(merged),
    updated_at: isoNow(),
  };
  const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }) };
}

const ARCHIVE_KEYS = new Set([
  "annual",
  "bereavement",
  "lateness",
  "marriage",
  "sick",
  "unpaid",
  "other",
]);

export async function handleFileHrLeaveRequests(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Read-only accounts cannot file leave requests." };
  }
  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = rawIds.map((x) => String(x || "").trim()).filter(Boolean);
  const archive = String(body.archive || "").trim().toLowerCase();
  if (!ids.length) {
    return { ok: false, success: false, error: "missing_ids", message: "Select at least one paper." };
  }
  if (archive && !ARCHIVE_KEYS.has(archive)) {
    return { ok: false, success: false, error: "bad_section", message: "Choose a leave section." };
  }
  const completed = new Set(["completed", "processed", "director_approved"]);
  let filed = 0;
  for (const id of ids) {
    const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
    if (!ex) continue;
    if (!completed.has(String(ex.status || "").trim().toLowerCase())) continue;
    const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existing };
    if (archive) merged.__archive = archive;
    else delete merged.__archive;
    const patch = { entitlements: entitlementsJson(merged), updated_at: isoNow() };
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    filed++;
  }
  return { ok: true, success: true, filed };
}

type PdfAnnualPerson = {
  empName: string;
  empDepartment: string;
  empCode: string;
  empDivision: string;
  empJobTitle: string;
  daysOut: string;
  requested: string;
};

const PDF_ANNUAL_PEOPLE: PdfAnnualPerson[] = [
  { empName: "Barzi Law Braim Ali", empDepartment: "MEP", empCode: "101807", empDivision: "Electrical", empJobTitle: "Electrical Engineer", daysOut: "1 day (due to Lateness)", requested: "1" },
  { empName: "Hoshang Ali Ibrahim", empDepartment: "Head Office", empCode: "100489", empDivision: "Procurement", empJobTitle: "HOP", daysOut: "1 day (due to Lateness)", requested: "1" },
  { empName: "Barzan Sherzad Burhan", empDepartment: "Civil & Infrastructure", empCode: "100106", empDivision: "Civil", empJobTitle: "Camp Supervisor", daysOut: "1 day (due to Lateness)", requested: "1" },
  { empName: "Aso Assad Heni Ahmed", empDepartment: "MEP", empCode: "101477", empDivision: "Electrical", empJobTitle: "Administration Coordinator", daysOut: "3 days (due to not compline with F.P and Lateness)", requested: "3" },
  { empName: "Dilan Abdulsatar Jawhar", empDepartment: "Head Office", empCode: "101447", empDivision: "", empJobTitle: "Data Entry Associate", daysOut: "1 day (due to not compline with F.P and Lateness)", requested: "1" },
  { empName: "Delan Mahdi Fard", empDepartment: "Head Office", empCode: "100733", empDivision: "", empJobTitle: "Administrative Assistant", daysOut: "3.5 days (due to not compline with F.P and Lateness)", requested: "3.5" },
  { empName: "Farman Fareed Hussain", empDepartment: "Head Office", empCode: "100068", empDivision: "Procurement", empJobTitle: "Driver", daysOut: "half day (due to not compline with F.P and Lateness)", requested: "0.5" },
  { empName: "Mohammed Abdulkhaliq Hamasharif", empDepartment: "Head Office", empCode: "101786", empDivision: "", empJobTitle: "Lawyer", daysOut: "1 day (due to Lateness)", requested: "1" },
  { empName: "Marwan Deyab Saeed", empDepartment: "Head Office", empCode: "100195", empDivision: "", empJobTitle: "Operation Coordinator", daysOut: "2 days (due to not compline with F.P and Lateness)", requested: "2" },
  { empName: "Ibrahim Mahdi Nader", empDepartment: "Civil & Infrastructure", empCode: "100635", empDivision: "Cleaning", empJobTitle: "Cleaning T.L", daysOut: "2.5 days (due to not compline with F.P)", requested: "2.5" },
  { empName: "Karzan Jamal Omer", empDepartment: "MEP", empCode: "100264", empDivision: "Mechanical", empJobTitle: "Supervisor", daysOut: "3 days (due to not compline with F.P and Lateness)", requested: "3" },
  { empName: "Mahmood Jamal Hashim", empDepartment: "MEP", empCode: "100988", empDivision: "HVAC", empJobTitle: "Supervisor", daysOut: "3 days (due to Lateness)", requested: "3" },
  { empName: "Abdulstar Ahmed Maaroof", empDepartment: "MEP", empCode: "100054", empDivision: "Power", empJobTitle: "Sub-Station Supervisor", daysOut: "3 days (due to not compline with F.P and Lateness)", requested: "3" },
  { empName: "Adnan Abdulrahman Sulaiman", empDepartment: "Landscape", empCode: "100115", empDivision: "", empJobTitle: "HOD", daysOut: "3 days (due to not compline with F.P and Lateness)", requested: "3" },
  { empName: "Adnan Ahmed Khdhir", empDepartment: "Civil & Infrastructure", empCode: "100184", empDivision: "Civil", empJobTitle: "Skilled Worker", daysOut: "2 days (due to not compline with F.P)", requested: "2" },
];

function pdfAnnualId(n: number): string {
  return `hrlv-pdf-annual-${String(n).padStart(2, "0")}`;
}

function pdfAnnualEntitlements(requested: string): string {
  const empty = { annualBalance: "", available: "", requested: "", remaining: "" };
  return JSON.stringify({
    lateness: { ...empty },
    annual: { annualBalance: "", available: "", requested, remaining: "" },
    sick: { ...empty },
    unpaid: { ...empty },
    bereavement: { ...empty },
    marriage: { ...empty },
    other: { ...empty },
  });
}

export async function handleSeedHrPdfAnnualPapers(_body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) {
    return { ok: false, success: false, error: "not_allowed", message: "Read-only accounts cannot save leave requests." };
  }
  const ids = PDF_ANNUAL_PEOPLE.map((_, i) => pdfAnnualId(i + 1));
  const { data: existingRows, error: existingErr } = await sb().from("hr_leave_requests").select("*").in("id", ids);
  if (existingErr) throw existingErr;
  const byId = new Map((existingRows || []).map((r) => [String(r.id), r as Record<string, unknown>]));
  const allRows = await selectAllRows<Record<string, unknown>>("hr_leave_requests", {
    columns: "id,num,emp_name,emp_code,leave_type,start_date",
  });
  let maxNum = 0;
  for (const r of allRows) {
    const n = Number(r.num || 0);
    if (n > maxNum) maxNum = n;
  }
  const now = isoNow();
  const upserts: Record<string, unknown>[] = [];
  for (let i = 0; i < PDF_ANNUAL_PEOPLE.length; i++) {
    const p = PDF_ANNUAL_PEOPLE[i];
    const id = ids[i];
    const ex = byId.get(id);
    if (!ex) continue;
    const existingNum = Number(ex?.num || 0);
    const num = existingNum > 0 ? existingNum : ++maxNum;
    const n = i + 1;
    upserts.push({
      id,
      num,
      emp_name: p.empName,
      emp_department: p.empDepartment,
      emp_code: p.empCode,
      emp_division: p.empDivision,
      emp_job_title: p.empJobTitle,
      replacement: "",
      start_date: "2026-08-01",
      end_date: "2026-08-30",
      days_out: p.daysOut,
      leave_type: "Annual Leave",
      leave_other: "",
      emp_signature: String(ex?.emp_signature || ""),
      emp_signed_at: String(ex?.emp_signed_at || "2026-08-01"),
      line_manager_name: String(ex?.line_manager_name || ""),
      line_manager_signed_at: String(ex?.line_manager_signed_at || ""),
      line_manager_status: String(ex?.line_manager_status || ""),
      director_name: String(ex?.director_name || ""),
      director_signed_at: String(ex?.director_signed_at || ""),
      director_status: String(ex?.director_status || ""),
      entitlements: pdfAnnualEntitlements(p.requested),
      hr_comment: `PDF page ${n} of 15 — Lateness vcations`,
      hr_signature: String(ex?.hr_signature || ""),
      hr_signed_at: String(ex?.hr_signed_at || ""),
      status: String(ex?.status || "submitted") || "submitted",
      created_by: String(ex?.created_by || auth.username || ""),
      created_at: String(ex?.created_at || now),
      updated_at: now,
    });
  }
  if (upserts.length) {
    const { error } = await sb().from("hr_leave_requests").upsert(upserts);
    if (error) throw error;
  }

  const extraIds = allRows
    .filter((r) => {
      const id = String(r.id || "");
      if (ids.includes(id)) return false;
      return String(r.emp_name || "") === "Barzi Law Braim Ali"
        && String(r.leave_type || "") === "Annual Leave"
        && String(r.start_date || "") === "2026-08-01";
    })
    .map((r) => String(r.id));
  if (extraIds.length) {
    const { error: delErr } = await sb().from("hr_leave_requests").delete().in("id", extraIds);
    if (delErr) throw delErr;
  }

  return { ok: true, success: true, updated: upserts.length, removed: extraIds.length };
}
