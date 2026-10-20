import { AuthOk } from "./auth.ts";
import { isoNow, sb, trashRows } from "./db.ts";

/* A.S.A.A.S Leave Request papers: the whole form is stored as JSON in `form`. */

function canWrite(body: Record<string, unknown>): boolean {
  return String(body._authRole || "") !== "viewer";
}

function toApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    employeeName: r.employee_name,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    form: r.form || {},
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  };
}

export async function handleGetAsaasLeaveRequests() {
  const { data, error } = await sb().from("asaas_leave_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return { ok: true, success: true, requests: (data || []).map(toApi) };
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
    const { data, error } = await sb().from("asaas_leave_requests").update(fields).eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) return { ok: false, success: false, error: "not_found" };
    return { ok: true, success: true, id };
  }
  const newId = `asaas-leave-${Date.now()}`;
  const { error } = await sb().from("asaas_leave_requests").insert({
    id: newId, ...fields, created_by: auth.username, created_at: now,
  });
  if (error) throw error;
  return { ok: true, success: true, id: newId };
}

export async function handleDeleteAsaasLeaveRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(body)) return { ok: false, success: false, error: "not_allowed", message: "View-only users cannot delete." };
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: row } = await sb().from("asaas_leave_requests").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, success: false, error: "not_found" };
  await trashRows("AsaasLeaveRequests", [row], "delete", auth.username);
  const { error } = await sb().from("asaas_leave_requests").delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id };
}
