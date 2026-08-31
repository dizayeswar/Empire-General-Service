import { AuthOk } from "./auth.ts";
import { fmtDate, isoNow, sb, selectAllRows } from "./db.ts";

const LEAVE_TYPES = [
  "Lateness",
  "Annual Leave",
  "Sick leave",
  "Unpaid Leave",
  "Bereavement",
  "Marriage Leave",
  "Other",
] as const;

const STATUSES = ["submitted", "line_approved", "director_approved", "processed", "rejected"] as const;

function canWrite(auth: AuthOk): boolean {
  const role = String(auth.role || "").toLowerCase();
  if (role === "viewer") return false;
  return true;
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

export async function handleGetHrLeaveRequests() {
  const data = await selectAllRows<Record<string, unknown>>("hr_leave_requests");
  const out = data.map(rowToApi);
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
  const { error } = await sb().from("hr_leave_requests").delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id };
}
