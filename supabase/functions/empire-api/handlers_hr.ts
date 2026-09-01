import { AuthOk, getUser } from "./auth.ts";
import { resetPasswordOk } from "./config.ts";
import { fmtDate, isoNow, sb, selectAllRows, trashRows } from "./db.ts";
import { moduleLevel, normalizeRole } from "./helpers.ts";

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
  "line_approved",
  "pending_director",
  "director_approved",
  "completed",
  "processed",
  "rejected",
] as const;

function isHrStaff(auth: AuthOk): boolean {
  if (normalizeRole(auth.role) === "admin") return true;
  return moduleLevel(auth.moduleAccess, "hr") === "write";
}

function isHrDirector(auth: AuthOk): boolean {
  return moduleLevel(auth.moduleAccess, "hr_director") !== "none";
}

function isDirectorOnly(auth: AuthOk): boolean {
  return isHrDirector(auth) && !isHrStaff(auth);
}

function canWrite(auth: AuthOk): boolean {
  if (isDirectorOnly(auth)) return false;
  if (normalizeRole(auth.role) === "viewer") return false;
  return isHrStaff(auth) || normalizeRole(auth.role) === "editor";
}

function isLockedStatus(status: unknown): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "pending_director" || s === "completed" || s === "processed" || s === "director_approved" || s === "rejected";
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

export async function handleGetHrLeaveRequests(auth?: AuthOk) {
  const data = await selectAllRows<Record<string, unknown>>("hr_leave_requests");
  let out = data.map(rowToApi);
  if (auth && isDirectorOnly(auth)) {
    out = out.filter((r) => {
      const s = String(r.status || "").trim().toLowerCase();
      return s === "pending_director" || s === "completed" || s === "director_approved" || s === "processed";
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

export async function handleConfirmHrLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id", message: "Request id is required." };
  const { data: ex } = await sb().from("hr_leave_requests").select("*").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found", message: "Leave request not found." };
  const status = String(ex.status || "submitted");
  const staff = isHrStaff(auth);
  const director = isHrDirector(auth);
  const directorOnly = isDirectorOnly(auth);

  if (staff && !directorOnly && (status === "submitted" || status === "line_approved")) {
    const patch = { status: "pending_director", updated_at: isoNow() };
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }) };
  }

  if (director && status === "pending_director") {
    const incoming = parseEntitlements(body.entitlements) as Record<string, unknown>;
    const existing = parseEntitlements(ex.entitlements) as Record<string, unknown>;
    const incomingSigs = incoming.__sigs && typeof incoming.__sigs === "object" && !Array.isArray(incoming.__sigs)
      ? incoming.__sigs as Record<string, string>
      : {};
    const existingSigs = existing.__sigs && typeof existing.__sigs === "object" && !Array.isArray(existing.__sigs)
      ? existing.__sigs as Record<string, string>
      : {};
    let directorSig = String(incomingSigs.director || body.directorSignature || existingSigs.director || "").trim();
    if (!directorSig) {
      const u = await getUser(auth.username);
      directorSig = String((u && u.signature) || "").trim();
    }
    if (!directorSig) {
      return { ok: false, success: false, error: "missing_signature", message: "Add your e-signature in the Director box first." };
    }
    const merged: Record<string, unknown> = { ...existing, ...incoming, __sigs: { ...existingSigs, ...incomingSigs, director: directorSig } };
    if (existing.__scan && !incoming.__scan) merged.__scan = existing.__scan;
    const patch = {
      status: "completed",
      director_name: String(body.directorName || auth.username || "").trim(),
      director_signed_at: String(body.directorSignedAt || "").trim() || isoNow().slice(0, 10),
      director_status: "approved",
      entitlements: entitlementsJson(merged),
      updated_at: isoNow(),
    };
    const { error } = await sb().from("hr_leave_requests").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id, row: rowToApi({ ...ex, ...patch }) };
  }

  if (!staff && !director) {
    return { ok: false, success: false, error: "not_allowed", message: "Not allowed." };
  }
  return { ok: false, success: false, error: "bad_status", message: "This paper cannot be confirmed in its current status." };
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
