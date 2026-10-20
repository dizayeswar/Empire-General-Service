import { AuthOk } from "./auth.ts";
import { isoNow, sb, trashRows } from "./db.ts";
import { normalizeWorkerId } from "./helpers.ts";

/* A.S.A.A.S Leave Request papers: the whole form is stored as JSON in `form`.
   Flow: saved → (Confirm) pending_line → (Line Manager signs) pending_director → (Director signs) completed.
   A signer can reject: status rejected + reason; the portal fixes it and confirms again. */

const TABLE = "asaas_leave_requests";
const EDITABLE = ["saved", "rejected"];

function canWrite(body: Record<string, unknown>): boolean {
  return String(body._authRole || "") !== "viewer";
}
function isAdmin(body: Record<string, unknown>): boolean {
  return String(body._authRole || "") === "admin";
}
function statusOf(r: Record<string, unknown>): string {
  return String(r.status || "saved").trim().toLowerCase() || "saved";
}

/** The caller's e-signature and which box it signs (line / director), from Admin → Users. */
async function signerFor(username: string): Promise<{ role: string; signature: string }> {
  const { data, error } = await sb().from("users").select("signature,signature_role").eq("username", normalizeWorkerId(username)).maybeSingle();
  if (error || !data) return { role: "", signature: "" };
  const role = String(data.signature_role || "").trim().toLowerCase();
  return { role: role === "line" || role === "director" ? role : "", signature: String(data.signature || "").trim() };
}

function toApi(r: Record<string, unknown>, withSigs: boolean) {
  return {
    id: r.id,
    employeeName: r.employee_name,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    form: r.form || {},
    status: statusOf(r),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
    confirmedBy: r.confirmed_by || "",
    confirmedAt: r.confirmed_at || "",
    lineSignedBy: r.line_signed_by || "",
    lineSignedAt: r.line_signed_at || "",
    directorSignedBy: r.director_signed_by || "",
    directorSignedAt: r.director_signed_at || "",
    rejectReason: r.reject_reason || "",
    rejectedBy: r.rejected_by || "",
    rejectedAt: r.rejected_at || "",
    lineSignature: withSigs ? (r.line_signature || "") : "",
    directorSignature: withSigs ? (r.director_signature || "") : "",
  };
}

async function loadRow(id: string) {
  const { data, error } = await sb().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function handleGetAsaasLeaveRequests(_body: Record<string, unknown>, auth: AuthOk) {
  const cols = "id,employee_name,leave_type,start_date,end_date,form,status,created_by,created_at,updated_by,updated_at," +
    "confirmed_by,confirmed_at,line_signed_by,line_signed_at,director_signed_by,director_signed_at,reject_reason,rejected_by,rejected_at";
  const { data, error } = await sb().from(TABLE).select(cols).order("created_at", { ascending: false });
  if (error) throw error;
  const me = await signerFor(auth.username);
  return {
    ok: true,
    success: true,
    requests: ((data || []) as unknown as Record<string, unknown>[]).map((r) => toApi(r, false)),
    signer: { role: me.role, hasSignature: !!me.signature },
  };
}

export async function handleGetAsaasLeaveRequest(body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const row = await loadRow(id);
  if (!row) return { ok: false, success: false, error: "not_found" };
  return { ok: true, success: true, request: toApi(row, true) };
}

export async function handleSaveAsaasLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(body)) return { ok: false, success: false, error: "not_allowed", message: "View-only users cannot save." };
  const form = body.form && typeof body.form === "object" ? body.form as Record<string, unknown> : null;
  if (!form) return { ok: false, success: false, error: "missing_form" };
  const pick = (k: string) => String(form[k] ?? "").trim().slice(0, 200);
  const now = isoNow();
  const id = String(body.id || "").trim();
  const fields = {
    employee_name: pick("name"),
    leave_type: pick("leaveType"),
    start_date: pick("startDate"),
    end_date: pick("endDate"),
    form,
    updated_by: auth.username,
    updated_at: now,
  };
  if (id) {
    const row = await loadRow(id);
    if (!row) return { ok: false, success: false, error: "not_found" };
    if (!EDITABLE.includes(statusOf(row))) {
      return { ok: false, success: false, error: "locked", message: "This request is already confirmed and can no longer be changed." };
    }
    const { error } = await sb().from(TABLE).update(fields).eq("id", id);
    if (error) throw error;
    return { ok: true, success: true, id };
  }
  const newId = `asaas-leave-${Date.now()}`;
  const { error } = await sb().from(TABLE).insert({
    id: newId, ...fields, status: "saved", created_by: auth.username, created_at: now,
  });
  if (error) throw error;
  return { ok: true, success: true, id: newId };
}

export async function handleConfirmAsaasLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(body)) return { ok: false, success: false, error: "not_allowed", message: "View-only users cannot confirm." };
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const row = await loadRow(id);
  if (!row) return { ok: false, success: false, error: "not_found" };
  if (!EDITABLE.includes(statusOf(row))) return { ok: false, success: false, error: "already_confirmed", message: "This request is already confirmed." };
  const now = isoNow();
  const { error } = await sb().from(TABLE).update({
    status: "pending_line",
    confirmed_by: auth.username,
    confirmed_at: now,
    line_signature: "", line_signed_by: "", line_signed_at: "",
    director_signature: "", director_signed_by: "", director_signed_at: "",
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, status: "pending_line" };
}

export async function handleSignAsaasLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const row = await loadRow(id);
  if (!row) return { ok: false, success: false, error: "not_found" };
  const me = await signerFor(auth.username);
  const st = statusOf(row);
  const now = isoNow();
  if (!me.signature) {
    return { ok: false, success: false, error: "no_signature", message: "Your account has no e-signature. Ask the admin to upload it in Admin → Users." };
  }
  if (st === "pending_line" && me.role === "line") {
    const { error } = await sb().from(TABLE).update({
      status: "pending_director",
      line_signature: me.signature, line_signed_by: auth.username, line_signed_at: now, updated_at: now,
    }).eq("id", id).eq("status", "pending_line");
    if (error) throw error;
    return { ok: true, success: true, id, status: "pending_director" };
  }
  if (st === "pending_director" && me.role === "director") {
    const { error } = await sb().from(TABLE).update({
      status: "completed",
      director_signature: me.signature, director_signed_by: auth.username, director_signed_at: now, updated_at: now,
    }).eq("id", id).eq("status", "pending_director");
    if (error) throw error;
    return { ok: true, success: true, id, status: "completed" };
  }
  return { ok: false, success: false, error: "not_your_turn", message: "This request is not waiting for your signature." };
}

export async function handleRejectAsaasLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  const reason = String(body.reason || "").trim().slice(0, 1000);
  if (!id) return { ok: false, success: false, error: "missing_id" };
  if (!reason) return { ok: false, success: false, error: "missing_reason", message: "Write the reason for rejecting." };
  const row = await loadRow(id);
  if (!row) return { ok: false, success: false, error: "not_found" };
  const me = await signerFor(auth.username);
  const st = statusOf(row);
  if (!((st === "pending_line" && me.role === "line") || (st === "pending_director" && me.role === "director"))) {
    return { ok: false, success: false, error: "not_your_turn", message: "This request is not waiting for you." };
  }
  const now = isoNow();
  const { error } = await sb().from(TABLE).update({
    status: "rejected",
    reject_reason: reason, rejected_by: auth.username, rejected_at: now,
    line_signature: "", line_signed_by: "", line_signed_at: "",
    director_signature: "", director_signed_by: "", director_signed_at: "",
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, status: "rejected" };
}

export async function handleDeleteAsaasLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(body)) return { ok: false, success: false, error: "not_allowed", message: "View-only users cannot delete." };
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const row = await loadRow(id);
  if (!row) return { ok: false, success: false, error: "not_found" };
  if (!EDITABLE.includes(statusOf(row)) && !isAdmin(body)) {
    return { ok: false, success: false, error: "locked", message: "Only an admin can delete a confirmed request." };
  }
  await trashRows("AsaasLeaveRequests", [row], "delete", auth.username);
  const { error } = await sb().from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id };
}
