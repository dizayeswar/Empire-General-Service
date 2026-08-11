import { AuthOk } from "./auth.ts";
import { RESET_PASSWORD } from "./config.ts";
import { fmtDate, isoNow, nextCounter, sb, selectAllRows, trashRows } from "./db.ts";
import {
  formatFixedPhotosForStorage,
  isElectricWorkerId,
  normalizeDeptField,
  normalizeWorkerId,
  parseAssignVoiceNote,
  parseFixedPhotosFromCell,
} from "./helpers.ts";

function electricWorkerReportToApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    date: fmtDate(r.date),
    place: r.place,
    note: r.note,
    photo: r.photo,
    voiceNote: parseAssignVoiceNote(r.voice_note),
    reportedBy: r.reported_by,
    workerName: r.worker_name,
    createdAt: r.created_at,
    amount: r.amount,
    reportType: r.report_type,
    status: r.status,
    transferredJobId: r.transferred_job_id,
    editedNote: r.edited_note,
    transferredAt: r.transferred_at,
    transferredBy: r.transferred_by,
    materials: r.materials,
    invoicePhoto: r.invoice_photo,
    num: r.num,
  };
}

function jobFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    num: Number(row.num || 0) || 0,
    date: fmtDate(row.date),
    job: String(row.job || ""),
    location: String(row.location || ""),
    materials: String(row.materials || ""),
    staff: String(row.staff || ""),
    type: String(row.type || ""),
    photo: String(row.photo || ""),
    invoicePhoto: String(row.invoice_photo || row.invoicePhoto || ""),
    notes: String(row.notes || ""),
    createdBy: String(row.created_by || ""),
    createdAt: row.created_at,
    amount: row.amount || "",
  };
}

export async function handleAddElectricalJob(body: Record<string, unknown>) {
  const id = String(body.id || "") || `job-${Date.now()}`;
  if (body.id) {
    const { data: ex } = await sb().from("electrical_jobs").select("*").eq("id", id).maybeSingle();
    if (ex) return { ok: true, success: true, id, num: ex.num, job: Object.assign(jobFromRow(ex), { deduped: true }) };
  }
  const num = await nextCounter("jobnum_ElectricalJobs");
  const row = {
    id,
    date: String(body.date || ""),
    job: String(body.job || ""),
    location: String(body.location || ""),
    materials: String(body.materials || ""),
    staff: String(body.staff || ""),
    type: String(body.type || ""),
    photo: String(body.photo || ""),
    invoice_photo: String(body.invoicePhoto || body.invoice_photo || ""),
    notes: String(body.notes || ""),
    created_by: String(body.username || ""),
    created_at: isoNow(),
    amount: String(body.amount || ""),
    num,
  };
  const { error } = await sb().from("electrical_jobs").insert(row);
  if (error) throw error;
  return { ok: true, success: true, id, num, job: jobFromRow(row) };
}

export async function handleGetElectricalJobs() {
  const data = await selectAllRows<Record<string, unknown>>("electrical_jobs");
  // Backfill invoice photos from transferred field reports (older jobs before invoice_photo column).
  const reports = await selectAllRows<Record<string, unknown>>("electric_worker_reports", {
    columns: "transferred_job_id,invoice_photo,status",
  });
  const invoiceByJob: Record<string, string> = {};
  for (const r of reports) {
    if (String(r.status || "").toLowerCase() !== "transferred") continue;
    const jid = String(r.transferred_job_id || "").trim();
    const inv = String(r.invoice_photo || "").trim();
    if (jid && inv && !invoiceByJob[jid]) invoiceByJob[jid] = inv;
  }
  return data.map((row) => {
    const id = String(row.id || "");
    const existing = String(row.invoice_photo || "").trim();
    if (!existing && invoiceByJob[id]) {
      row = { ...row, invoice_photo: invoiceByJob[id] };
      // Persist quietly so next loads are fast.
      void sb().from("electrical_jobs").update({ invoice_photo: invoiceByJob[id] }).eq("id", id);
    }
    return jobFromRow(row);
  });
}

export async function handleUpdateElectricalJob(body: Record<string, unknown>) {
  const { data, error } = await sb().from("electrical_jobs").update({
    date: String(body.date || ""),
    job: String(body.job || ""),
    location: String(body.location || ""),
    materials: String(body.materials || ""),
    staff: String(body.staff || ""),
    type: String(body.type || ""),
    photo: String(body.photo || ""),
    invoice_photo: String(body.invoicePhoto || body.invoice_photo || ""),
    notes: String(body.notes || ""),
    amount: String(body.amount || ""),
  }).eq("id", String(body.id)).select("id");
  if (error) throw error;
  if (!data?.length) return { ok: false, error: "Job not found" };
  return { ok: true, success: true };
}

async function trashFieldReportsLinkedToJobs_(
  jobIds: string[],
  reason: string,
  username: string,
) {
  const ids = [...new Set(jobIds.map((x) => String(x || "")).filter(Boolean))];
  if (!ids.length) return 0;
  const reports = await selectAllRows<Record<string, unknown>>("electric_worker_reports");
  const idSet = new Set(ids);
  const linked = reports.filter((r) => idSet.has(String(r.transferred_job_id || "")));
  if (!linked.length) return 0;
  await trashRows("ElectricWorkerReports", linked, reason, username);
  for (let i = 0; i < linked.length; i += 100) {
    const chunk = linked.slice(i, i + 100).map((r) => String(r.id || "")).filter(Boolean);
    if (chunk.length) await sb().from("electric_worker_reports").delete().in("id", chunk);
  }
  return linked.length;
}

/** Transferred field reports whose monthly job was deleted — remove from live lists. */
async function purgeOrphanTransferredFieldReports_(username: string) {
  const [reports, jobs] = await Promise.all([
    selectAllRows<Record<string, unknown>>("electric_worker_reports"),
    selectAllRows<{ id?: string }>("electrical_jobs", { columns: "id" }),
  ]);
  const jobIds = new Set(jobs.map((j) => String(j.id || "")).filter(Boolean));
  const orphans = reports.filter((r) => {
    if (String(r.status || "").toLowerCase() !== "transferred") return false;
    const tj = String(r.transferred_job_id || "").trim();
    return !tj || !jobIds.has(tj);
  });
  if (!orphans.length) return 0;
  await trashRows("ElectricWorkerReports", orphans, "orphan_job_missing", username || "system");
  for (let i = 0; i < orphans.length; i += 100) {
    const chunk = orphans.slice(i, i + 100).map((r) => String(r.id || "")).filter(Boolean);
    if (chunk.length) await sb().from("electric_worker_reports").delete().in("id", chunk);
  }
  return orphans.length;
}

export async function handleDeleteElectricalJob(body: Record<string, unknown>) {
  const { data: row } = await sb().from("electrical_jobs").select("*").eq("id", String(body.id)).maybeSingle();
  if (!row) return { ok: false, error: "Job not found" };
  await trashRows("ElectricalJobs", [row], "delete", String(body.username));
  await sb().from("electrical_jobs").delete().eq("id", row.id);
  await trashFieldReportsLinkedToJobs_([String(row.id)], "job_deleted", String(body.username || ""));
  return { ok: true, success: true };
}

export async function handleClearElectricalJobs(body: Record<string, unknown>) {
  if (String(body.resetPassword || "") !== RESET_PASSWORD) {
    return { ok: false, success: false, error: "bad_password" };
  }
  let target = String(body.target || "all").trim().toLowerCase();
  if (target === "field_reports") target = "fieldreports";
  if (target !== "jobs" && target !== "fieldreports" && target !== "all") target = "all";
  if (target === "jobs" || target === "all") {
    const data = await selectAllRows("electrical_jobs");
    if (data.length) {
      const jobIds = data.map((j) => String(j.id || "")).filter(Boolean);
      await trashRows("ElectricalJobs", data, "reset", String(body.username));
      await sb().from("electrical_jobs").delete().gte("id", "");
      // Jobs gone → transferred field reports become ghosts; remove them too.
      await trashFieldReportsLinkedToJobs_(jobIds, "jobs_reset", String(body.username || ""));
      await purgeOrphanTransferredFieldReports_(String(body.username || ""));
    }
  }
  if (target === "fieldreports" || target === "all") {
    const data = await selectAllRows("electric_worker_reports");
    if (data.length) {
      await trashRows("ElectricWorkerReports", data, "reset", String(body.username));
      await sb().from("electric_worker_reports").delete().gte("id", "");
    }
  }
  return { ok: true, success: true, target };
}

export async function handleGetElectricalSummary(body: Record<string, unknown>) {
  const { data } = await sb().from("electrical_summaries").select("*").eq("month", String(body.month)).maybeSingle();
  return { ok: true, text: data ? String(data.text || "") : "" };
}

export async function handleSaveElectricalSummary(body: Record<string, unknown>) {
  const { error } = await sb().from("electrical_summaries").upsert({
    month: String(body.month),
    text: String(body.text || ""),
    saved_by: String(body.username || ""),
    saved_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true, success: true };
}

export async function handleAddCivilJob(body: Record<string, unknown>) {
  const id = String(body.id || "") || `job-${Date.now()}`;
  const row = {
    id,
    date: String(body.date || ""),
    job: String(body.job || ""),
    location: String(body.location || ""),
    materials: String(body.materials || ""),
    staff: String(body.staff || ""),
    type: String(body.type || ""),
    photo: String(body.photo || ""),
    notes: String(body.notes || ""),
    created_by: String(body.username || ""),
    created_at: isoNow(),
    amount: String(body.amount || ""),
  };
  const { error } = await sb().from("civil_jobs").upsert(row);
  if (error) throw error;
  return { ok: true, success: true, id };
}

export async function handleGetCivilJobs() {
  const { data, error } = await sb().from("civil_jobs").select("*");
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    date: fmtDate(row.date),
    job: row.job,
    location: row.location,
    materials: row.materials,
    staff: row.staff,
    type: row.type,
    photo: row.photo,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    amount: row.amount || "",
  }));
}

export async function handleUpdateCivilJob(body: Record<string, unknown>) {
  const { data, error } = await sb().from("civil_jobs").update({
    date: String(body.date || ""),
    job: String(body.job || ""),
    location: String(body.location || ""),
    materials: String(body.materials || ""),
    staff: String(body.staff || ""),
    type: String(body.type || ""),
    photo: String(body.photo || ""),
    notes: String(body.notes || ""),
    amount: String(body.amount || ""),
  }).eq("id", String(body.id)).select("id");
  if (error) throw error;
  if (!data?.length) return { ok: false, error: "Job not found" };
  return { ok: true, success: true };
}

export async function handleDeleteCivilJob(body: Record<string, unknown>) {
  const { data: row } = await sb().from("civil_jobs").select("*").eq("id", String(body.id)).maybeSingle();
  if (!row) return { ok: false, error: "Job not found" };
  await trashRows("CivilJobs", [row], "delete", String(body.username));
  await sb().from("civil_jobs").delete().eq("id", row.id);
  return { ok: true, success: true };
}

export async function handleClearCivilJobs(body: Record<string, unknown>) {
  if (String(body.resetPassword || "") !== RESET_PASSWORD) {
    return { ok: false, success: false, error: "bad_password" };
  }
  const { data } = await sb().from("civil_jobs").select("*");
  if (data?.length) {
    await trashRows("CivilJobs", data, "reset", String(body.username));
    await sb().from("civil_jobs").delete().gte("id", "");
  }
  return { ok: true, success: true };
}

export async function handleGetCivilSummary(body: Record<string, unknown>) {
  const { data } = await sb().from("civil_summaries").select("*").eq("month", String(body.month)).maybeSingle();
  return { ok: true, text: data ? String(data.text || "") : "" };
}

export async function handleSaveCivilSummary(body: Record<string, unknown>) {
  const { error } = await sb().from("civil_summaries").upsert({
    month: String(body.month),
    text: String(body.text || ""),
    saved_by: String(body.username || ""),
    saved_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true, success: true };
}

function parseAmount(body: Record<string, unknown>): number {
  const raw = body.amount;
  if (raw == null || raw === "") return 0;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
  if (isNaN(n) || n <= 0) return 0;
  return Math.round(n);
}

export async function handleAddElectricWorkerReport(body: Record<string, unknown>, auth: AuthOk) {
  const place = String(body.place || body.location || "").trim();
  const note = String(body.note || body.notes || "").trim();
  let photos = (body.photos as string[]) || [];
  if (!photos.length) photos = parseFixedPhotosFromCell(String(body.photo || ""));
  if (photos.length > 3) photos = photos.slice(0, 3);
  const photo = photos.length ? formatFixedPhotosForStorage(photos) : "";
  let voiceNote = body.voiceNote;
  if (voiceNote && typeof voiceNote === "object") voiceNote = JSON.stringify(parseAssignVoiceNote(voiceNote));
  else voiceNote = String(voiceNote || "").trim();
  if (!place && !note && !photos.length && !voiceNote) {
    return { ok: false, success: false, error: "empty_report", message: "Add a place, note, photo, or voice recording before submitting." };
  }
  const username = normalizeWorkerId(auth.username);
  const amount = parseAmount(body);
  let reportType = String(body.reportType || "").trim().toLowerCase();
  if (reportType !== "refundable" && reportType !== "maintenance") {
    reportType = amount > 0 ? "refundable" : "maintenance";
  }
  const id = String(body.id || "") || `fr-${Date.now()}`;
  const num = await nextCounter("frnum_ElectricWorkerReports");
  const dateStr = String(body.date || "").trim() || isoNow().slice(0, 10);
  const row = {
    id,
    date: dateStr,
    place,
    note,
    photo,
    voice_note: String(voiceNote || ""),
    reported_by: username,
    worker_name: String(body.workerName || body.displayName || username || "").trim(),
    created_at: isoNow(),
    amount,
    report_type: reportType,
    status: "",
    transferred_job_id: "",
    edited_note: "",
    transferred_at: "",
    transferred_by: "",
    materials: String(body.materials || ""),
    invoice_photo: String(body.invoicePhoto || "").trim(),
    num,
  };
  const { error } = await sb().from("electric_worker_reports").insert(row);
  if (error) throw error;
  return { ok: true, success: true, id, num };
}

export async function handleUpdateElectricWorkerReportInvoice(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "");
  const invoicePhoto = String(body.invoicePhoto || "").trim();
  if (!invoicePhoto) return { ok: false, success: false, error: "missing_photo" };
  const { data: row } = await sb().from("electric_worker_reports").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  const reportedBy = normalizeWorkerId(row.reported_by);
  const workerUser = normalizeWorkerId(auth.username);
  if (reportedBy !== workerUser) {
    return { ok: false, success: false, error: "not_allowed", message: "You can only add an invoice photo to your own report." };
  }
  if (String(row.status || "").toLowerCase() === "transferred") {
    return { ok: false, success: false, error: "already_transferred" };
  }
  const { data, error } = await sb().from("electric_worker_reports")
    .update({ invoice_photo: invoicePhoto }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) return { ok: false, error: "not_found" };
  return { ok: true, success: true, id };
}

async function trashedElectricWorkerReportIds_(): Promise<Set<string>> {
  const trash = await selectAllRows<Record<string, unknown>>("trash", {
    filter: (q) => q.eq("source_sheet", "ElectricWorkerReports"),
  });
  const ids = new Set<string>();
  for (const t of trash) {
    const rj = t.row_json;
    if (Array.isArray(rj) && rj[0]) ids.add(String(rj[0]));
    else if (rj && typeof rj === "object" && (rj as Record<string, unknown>).id) {
      ids.add(String((rj as Record<string, unknown>).id));
    }
  }
  return ids;
}

export async function handleGetElectricWorkerReports(_body: Record<string, unknown>, auth: AuthOk) {
  // Mobile / electric-issue logins must only ever see their own reports.
  // Department desk (electrical department, non-worker) still sees everyone.
  const dept = normalizeDeptField(auth.dept);
  const role = String(auth.role || "").toLowerCase();
  const scopeToSelf =
    role === "worker" ||
    dept === "electric issue" ||
    isElectricWorkerId(auth.username);
  const workerUser = normalizeWorkerId(auth.username);

  // Remove transferred reports whose job no longer exists (ghosts on phones).
  await purgeOrphanTransferredFieldReports_(workerUser || String(auth.username || "system"));

  let data = await selectAllRows<Record<string, unknown>>("electric_worker_reports");
  const jobIds = new Set(
    (await selectAllRows<{ id?: string }>("electrical_jobs", { columns: "id" }))
      .map((j) => String(j.id || ""))
      .filter(Boolean),
  );
  const trashed = await trashedElectricWorkerReportIds_();

  data = data.filter((r) => {
    const id = String(r.id || "");
    if (id && trashed.has(id)) return false;
    const st = String(r.status || "").trim().toLowerCase();
    if (st === "transferred") {
      const tj = String(r.transferred_job_id || "").trim();
      // Only keep transferred reports that still exist as a live job.
      return !!tj && jobIds.has(tj);
    }
    // pending / empty = still in Field Reports review queue
    return true;
  });

  if (scopeToSelf) {
    data = data.filter((r) => normalizeWorkerId(r.reported_by) === workerUser);
  }

  const out = data.map(electricWorkerReportToApi);
  out.sort((a, b) =>
    String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || ""))
  );
  return out;
}

export async function handleDeleteElectricWorkerReport(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: row } = await sb().from("electric_worker_reports").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, success: false, error: "not_found" };
  await trashRows("ElectricWorkerReports", [row], "delete", String(body.username || auth.username || ""));
  await sb().from("electric_worker_reports").delete().eq("id", id);
  return { ok: true, success: true, id };
}

export async function handleTransferElectricWorkerReport(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "");
  const note = String(body.note || body.job || "").trim();
  if (!note) return { ok: false, success: false, error: "missing_note", message: "Job note is required." };
  const { data: report } = await sb().from("electric_worker_reports").select("*").eq("id", id).maybeSingle();
  if (!report) return { ok: false, error: "not_found" };
  if (String(report.status) === "transferred") {
    return { ok: false, success: false, error: "already_transferred" };
  }
  const amount = body.amount != null ? parseAmount(body) : Number(report.amount || 0);
  if (String(report.report_type) === "refundable" && amount <= 0) {
    return { ok: false, success: false, error: "amount_required" };
  }
  const jobId = `job-${Date.now()}`;
  const num = await nextCounter("jobnum_ElectricalJobs");
  const jobPhotos = parseFixedPhotosFromCell(String(report.photo || ""));
  const jobRow = {
    id: jobId,
    date: fmtDate(report.date),
    job: note,
    location: String(body.place || report.place || ""),
    materials: String(body.materials || report.materials || ""),
    staff: String(report.worker_name || report.reported_by || ""),
    type: String(report.report_type) === "refundable" ? "refundable" : "general",
    photo: jobPhotos.length ? formatFixedPhotosForStorage(jobPhotos) : String(report.photo || ""),
    invoice_photo: String(report.invoice_photo || "").trim(),
    notes: "",
    created_by: String(body.username || auth.username || ""),
    created_at: isoNow(),
    amount: String(amount || ""),
    num,
  };
  await sb().from("electrical_jobs").insert(jobRow);
  await sb().from("electric_worker_reports").update({
    place: String(body.place || report.place || ""),
    amount,
    status: "transferred",
    transferred_job_id: jobId,
    edited_note: note,
    transferred_at: isoNow(),
    transferred_by: String(auth.username || ""),
    materials: String(body.materials || report.materials || ""),
  }).eq("id", id);
  return { ok: true, success: true, id, jobId, job: jobFromRow(jobRow) };
}

export async function handleTransferElectricIssueCompletion(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "");
  const jobNote = String(body.job || body.note || "").trim();
  if (!jobNote) return { ok: false, success: false, error: "missing_note", message: "Job note is required." };
  const { data: issue } = await sb().from("electric_issues").select("*").eq("id", id).maybeSingle();
  if (!issue) return { ok: false, error: "not_found" };
  if (String(issue.status) !== "fixed") {
    return { ok: false, success: false, error: "not_fixed" };
  }
  if (String(issue.monthly_transfer_status) === "transferred" || issue.transferred_job_id) {
    return { ok: false, success: false, error: "already_transferred" };
  }
  const jobId = `job-${Date.now()}`;
  const num = await nextCounter("jobnum_ElectricalJobs");
  const jobRow = {
    id: jobId,
    date: String(body.date || issue.date || ""),
    job: jobNote,
    location: String(body.location || `${issue.building}-${issue.floor}-${issue.spot}`),
    materials: String(body.materials || ""),
    staff: String(body.staff || issue.fixed_by || ""),
    type: "general",
    photo: String(body.photo || issue.fixed_photo || ""),
    invoice_photo: String(body.invoicePhoto || ""),
    notes: "",
    created_by: String(body.username || auth.username || ""),
    created_at: isoNow(),
    amount: String(body.amount || ""),
    num,
  };
  await sb().from("electrical_jobs").insert(jobRow);
  await sb().from("electric_issues").update({
    monthly_transfer_status: "transferred",
    transferred_job_id: jobId,
    edited_job_note: jobNote,
    transferred_at: isoNow(),
    transferred_by: String(auth.username || ""),
  }).eq("id", id);
  return { ok: true, success: true, id, jobId, job: jobFromRow(jobRow) };
}

export async function handleTransferCivilIssueCompletion(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "");
  const jobNote = String(body.job || body.note || "").trim();
  if (!jobNote) return { ok: false, success: false, error: "missing_note", message: "Job note is required." };
  const { data: issue } = await sb().from("civil_issues").select("*").eq("id", id).maybeSingle();
  if (!issue) return { ok: false, error: "not_found" };
  if (String(issue.status) !== "fixed") {
    return { ok: false, success: false, error: "not_fixed" };
  }
  if (String(issue.monthly_transfer_status) === "transferred" || issue.transferred_job_id) {
    return { ok: false, success: false, error: "already_transferred" };
  }
  const jobId = `job-${Date.now()}`;
  const jobRow = {
    id: jobId,
    date: String(body.date || issue.date || ""),
    job: jobNote,
    location: String(body.location || `${issue.building}-${issue.floor}-${issue.spot}`),
    materials: String(body.materials || ""),
    staff: String(body.staff || issue.fixed_by || ""),
    type: "general",
    photo: String(body.photo || issue.fixed_photo || ""),
    notes: "",
    created_by: String(body.username || auth.username || ""),
    created_at: isoNow(),
    amount: String(body.amount || ""),
  };
  await sb().from("civil_jobs").insert(jobRow);
  await sb().from("civil_issues").update({
    monthly_transfer_status: "transferred",
    transferred_job_id: jobId,
    edited_job_note: jobNote,
    transferred_at: isoNow(),
    transferred_by: String(auth.username || ""),
  }).eq("id", id);
  return {
    ok: true,
    success: true,
    id,
    jobId,
    job: {
      id: jobRow.id,
      date: fmtDate(jobRow.date),
      job: jobRow.job,
      location: jobRow.location,
      materials: jobRow.materials,
      staff: jobRow.staff,
      type: jobRow.type,
      photo: jobRow.photo,
      notes: jobRow.notes,
      createdBy: jobRow.created_by,
      createdAt: jobRow.created_at,
      amount: jobRow.amount || "",
    },
  };
}
