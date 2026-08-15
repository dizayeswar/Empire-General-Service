import { CIVIL_WORKER_TEAM, ELECTRIC_WORKER_TEAM, HSE_INSPECTOR, resetPasswordOk } from "./config.ts";
import { AuthOk } from "./auth.ts";
import { dtIssue, fmtDate, isoNow, nextCounter, sb, selectAllRows, trashRows } from "./db.ts";
import {
  formatFixedPhotosForStorage,
  issueStatusFromCondition,
  mergeWorkerCompletionPhotos,
  normalizeTrade,
  normalizeWorkerId,
  parseAssignVoiceNote,
  parseFixedPhotosFromCell,
  workerAlreadyCompleted,
  workerAssignedToIssue,
} from "./helpers.ts";

type IssueTable = "civil_issues" | "electric_issues" | "fire_issues" | "hse_inspections";

function sheetNameFor(table: IssueTable): string {
  return ({
    civil_issues: "CivilIssues",
    electric_issues: "ElectricIssues",
    fire_issues: "FireIssues",
    hse_inspections: "HseInspections",
  } as const)[table];
}

function isWorkerIssue(table: IssueTable): boolean {
  return table === "civil_issues" || table === "electric_issues";
}

function routedDisposition(table: IssueTable): string {
  return table === "electric_issues" ? "not_electric" : "not_civil";
}

function counterKey(table: IssueTable): string {
  return `issnum_${sheetNameFor(table)}`;
}

function teamFor(table: IssueTable): Record<string, string> {
  return table === "electric_issues" ? ELECTRIC_WORKER_TEAM : CIVIL_WORKER_TEAM;
}

function rowToApi(row: Record<string, unknown>, table: IssueTable, auth?: AuthOk) {
  const st = String(row.status || "open");
  const fp = String(row.fixed_photo || "");
  const assignedGroup = isWorkerIssue(table) ? normalizeTrade(row.assigned_group) : "";
  const assignedWorkers = isWorkerIssue(table)
    ? (Array.isArray(row.assigned_workers) ? row.assigned_workers as string[] : [])
    : [];
  const workersRequired = isWorkerIssue(table) ? Number(row.workers_required || 1) || 1 : 1;
  const workerCompletions = isWorkerIssue(table)
    ? (Array.isArray(row.worker_completions) ? row.worker_completions as Array<Record<string, unknown>> : [])
    : [];

  let fixedPhotos = st === "fixed" ? parseFixedPhotosFromCell(fp) : [];
  if (isWorkerIssue(table) && st !== "fixed" && workerCompletions.length) {
    fixedPhotos = mergeWorkerCompletionPhotos(workerCompletions as Array<{ photos?: string[] }>);
  }

  const item: Record<string, unknown> = {
    id: String(row.id),
    num: Number(row.num || 0),
    project: String(row.project || ""),
    building: String(row.building || ""),
    floor: String(row.floor || ""),
    spot: String(row.spot || ""),
    issueType: String(row.issue_type || ""),
    note: String(row.note || ""),
    date: fmtDate(row.date),
    photo: String(row.photo || ""),
    fixedPhoto: st === "fixed" ? fp : (fixedPhotos.length ? formatFixedPhotosForStorage(fixedPhotos) : ""),
    fixedPhotos,
    status: st,
    createdBy: String(row.created_by || ""),
    createdAt: dtIssue(row.created_at),
    fixedBy: String(row.fixed_by || ""),
    fixedAt: dtIssue(row.fixed_at),
    assignedGroup,
  };

  if (isWorkerIssue(table)) {
    item.disposition = String(row.disposition || "").trim();
    item.fixDelay = String(row.fix_delay || "").trim();
    item.assignVoiceNote = parseAssignVoiceNote(row.assign_voice_note);
    item.workersRequired = workersRequired;
    item.workerCompletions = workerCompletions;
    item.workerDone = workerCompletions.length;
    item.assignedWorkers = assignedWorkers;
    item.monthlyTransferStatus = String(row.monthly_transfer_status || "").trim();
    item.transferredJobId = String(row.transferred_job_id || "").trim();
    item.editedJobNote = String(row.edited_job_note || "").trim();
    item.transferredAt = dtIssue(row.transferred_at);
    item.transferredBy = String(row.transferred_by || "").trim();
  }
  if (table === "hse_inspections") {
    item.assetKey = String(row.asset_key || "");
    item.reportPeriod = String(row.report_period || "");
    item.jobDept = String(row.job_dept || "");
    item.createdBy = HSE_INSPECTOR;
  }
  return item;
}

function workerFilter(row: Record<string, unknown>, table: IssueTable, auth: AuthOk): boolean {
  const st = String(row.status || "open");
  if (st === "fixed") return false;
  const disposition = String(row.disposition || "").trim().toLowerCase();
  if (disposition === routedDisposition(table)) return false;
  const assignedWorkers = Array.isArray(row.assigned_workers) ? row.assigned_workers as string[] : [];
  const workerUser = normalizeWorkerId(auth.username);
  const workerTrade = normalizeTrade(auth.trade);
  if (assignedWorkers.length) {
    if (!workerAssignedToIssue(assignedWorkers, workerUser)) return false;
  } else {
    const assignedGroup = normalizeTrade(row.assigned_group);
    if (!workerTrade || assignedGroup !== workerTrade) return false;
  }
  const completions = Array.isArray(row.worker_completions) ? row.worker_completions as Array<{ user?: string }> : [];
  if (workerAlreadyCompleted(completions, auth.username)) return false;
  return true;
}

export async function handleAddIssue(body: Record<string, unknown>, table: IssueTable) {
  const id = String(body.id || "") || crypto.randomUUID();
  if (body.id) {
    const { data: existing } = await sb().from(table).select("id,num").eq("id", id).maybeSingle();
    if (existing) {
      return { ok: true, success: true, id, num: existing.num || null, deduped: true };
    }
  }
  const num = await nextCounter(counterKey(table));
  const reporter = String(body.supervisor || "").trim() || String(body.username || "");
  const status = issueStatusFromCondition(body);
  const base: Record<string, unknown> = {
    id,
    project: String(body.project || ""),
    building: String(body.building || ""),
    floor: String(body.floor || ""),
    spot: String(body.spot || ""),
    issue_type: String(body.issueType || ""),
    note: String(body.note || ""),
    date: String(body.date || ""),
    photo: String(body.photo || ""),
    fixed_photo: "",
    status,
    created_by: reporter,
    created_at: isoNow(),
    fixed_by: "",
    fixed_at: "",
    num,
  };
  if (isWorkerIssue(table)) {
    Object.assign(base, {
      assigned_group: "",
      workers_required: 1,
      worker_completions: [],
      assigned_workers: [],
      disposition: "",
      fix_delay: "",
    });
  }
  const { error } = await sb().from(table).insert(base);
  if (error) throw error;
  return { ok: true, success: true, id, num };
}

export async function handleUpdateIssue(body: Record<string, unknown>, table: IssueTable) {
  const patch: Record<string, unknown> = {
    project: String(body.project || ""),
    building: String(body.building || ""),
    floor: String(body.floor || ""),
    spot: String(body.spot || ""),
    issue_type: String(body.issueType || ""),
    note: String(body.note || ""),
    date: String(body.date || ""),
    photo: String(body.photo || ""),
  };
  const reporter = String(body.supervisor || "").trim();
  if (reporter) patch.created_by = reporter;
  if (body.condition) patch.status = issueStatusFromCondition(body);
  const { data, error } = await sb().from(table).update(patch).eq("id", String(body.id)).select("id");
  if (error) throw error;
  if (!data?.length) return { ok: false, error: "Issue not found" };
  return { ok: true, success: true, id: String(body.id) };
}

export async function handleGetIssues(body: Record<string, unknown>, table: IssueTable, auth?: AuthOk) {
  const isWorker = auth && String(auth.role || "").toLowerCase() === "worker" && isWorkerIssue(table);
  const status = String(body.status || "").trim().toLowerCase();
  const project = String(body.project || "").trim().toLowerCase();
  const dateRaw = String(body.date || body.day || "").trim();
  const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : "";

  const rows = await selectAllRows<Record<string, unknown>>(table, {
    filter: (q) => {
      let qq = q;
      // Workers need their full assigned set; desk can filter server-side for speed.
      if (!isWorker) {
        if (status === "open" || status === "fixed") {
          qq = qq.eq("status", status);
        } else if ((status === "report_pending" || status === "report-pending") && isWorkerIssue(table)) {
          qq = qq.eq("status", "fixed").neq("monthly_transfer_status", "transferred").eq("transferred_job_id", "");
        }
        if (project) qq = qq.eq("project", project);
        if (date) qq = qq.eq("date", date);
      }
      return qq;
    },
  });

  let out = rows;
  if (isWorker && auth) {
    out = rows.filter((r) => workerFilter(r, table, auth));
  }
  return out.map((r) => rowToApi(r, table, auth));
}

export async function handleDeleteIssue(body: Record<string, unknown>, table: IssueTable) {
  const ids = (body.ids && (body.ids as string[]).length)
    ? body.ids as string[]
    : (body.id ? [String(body.id)] : []);
  if (!ids.length) return { ok: false, error: "No id" };
  const { data } = await sb().from(table).select("*").in("id", ids);
  if (!data?.length) return { ok: false, error: "Issue not found" };
  await trashRows(sheetNameFor(table), data, "delete", String(body.username));
  await sb().from(table).delete().in("id", ids);
  return { ok: true, success: true, deleted: data.length };
}

export async function handleClearIssues(body: Record<string, unknown>, table: IssueTable) {
  if (!resetPasswordOk(body)) {
    return { ok: false, success: false, error: "bad_password" };
  }
  const { data } = await sb().from(table).select("*");
  if (data?.length) {
    await trashRows(sheetNameFor(table), data, "reset", String(body.username));
    await sb().from(table).delete().gte("id", "");
  }
  await sb().from("id_counters").upsert({ key: counterKey(table), value: 0 });
  return { ok: true, success: true };
}

export async function handleMarkFixed(
  body: Record<string, unknown>,
  table: IssueTable,
  auth?: AuthOk,
) {
  const id = String(body.id || "");
  const { data: row, error } = await sb().from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false, error: "Issue not found" };

  let photos = (body.fixedPhotos as string[]) || [];
  if (!photos.length && body.fixedPhoto) photos = parseFixedPhotosFromCell(String(body.fixedPhoto));
  if (!photos.length) return { ok: false, error: "photo_required", message: "A fix photo is required." };

  const role = String(auth?.role || "").toLowerCase();
  if (role === "worker" && isWorkerIssue(table)) {
    const disposition = String(row.disposition || "").trim().toLowerCase();
    if (disposition === routedDisposition(table)) {
      return { ok: false, error: routedDisposition(table), message: "Issue is routed out of department." };
    }
    const assignedWorkers = Array.isArray(row.assigned_workers) ? row.assigned_workers as string[] : [];
    const workerUser = normalizeWorkerId(auth!.username);
    const workerTrade = normalizeTrade(auth!.trade);
    if (assignedWorkers.length) {
      if (!workerAssignedToIssue(assignedWorkers, workerUser)) {
        return { ok: false, error: "not_assigned", message: "Not assigned to you." };
      }
    } else {
      if (!workerTrade || normalizeTrade(row.assigned_group) !== workerTrade) {
        return { ok: false, error: "not_assigned", message: "Not assigned to your trade." };
      }
    }
    if (String(row.status) === "fixed") {
      return { ok: false, error: "already_fixed" };
    }
    const completions = Array.isArray(row.worker_completions)
      ? [...(row.worker_completions as Array<Record<string, unknown>>)]
      : [];
    if (workerAlreadyCompleted(completions as Array<{ user?: string }>, workerUser)) {
      return { ok: false, error: "already_submitted" };
    }
    const completion: Record<string, unknown> = {
      user: workerUser,
      photos,
      photoSources: body.photoSources || [],
      at: isoNow(),
      note: String(body.fixNote || ""),
      materials: String(body.fixMaterials || ""),
    };
    const voice = parseAssignVoiceNote(body.fixVoiceNote);
    if (voice) completion.voiceNote = voice;
    if (body.lat != null) completion.lat = body.lat;
    if (body.lng != null) completion.lng = body.lng;
    if (body.accuracy != null) completion.accuracy = body.accuracy;
    completions.push(completion);

    const workersRequired = Number(row.workers_required || 1) || 1;
    const merged = mergeWorkerCompletionPhotos(completions as Array<{ photos?: string[] }>);
    const patch: Record<string, unknown> = {
      worker_completions: completions,
      fixed_photo: formatFixedPhotosForStorage(merged),
      fixed_by: `${workerUser} (${completions.length}/${workersRequired})`,
    };
    if (completions.length < workersRequired) {
      await sb().from(table).update(patch).eq("id", id);
      return {
        ok: true,
        success: true,
        partial: true,
        workerDone: completions.length,
        workersRequired,
        workerCompletions: completions,
      };
    }
    const names = completions.map((c) => String(c.user || "")).filter(Boolean).join(", ");
    let note = String(row.note || "");
    const fixNote = String(body.fixNote || "").trim();
    if (fixNote) note = note ? `${note}\n[Fix] ${fixNote}` : `[Fix] ${fixNote}`;
    Object.assign(patch, {
      status: "fixed",
      fix_delay: "",
      monthly_transfer_status: "pending",
      fixed_by: names,
      fixed_at: isoNow(),
      note,
    });
    await sb().from(table).update(patch).eq("id", id);
    return {
      ok: true,
      success: true,
      partial: false,
      workerDone: completions.length,
      workersRequired,
    };
  }

  // editor/admin path
  const patch: Record<string, unknown> = {
    fixed_photo: formatFixedPhotosForStorage(photos),
    status: "fixed",
    fixed_at: isoNow(),
  };
  if (isWorkerIssue(table)) {
    patch.fix_delay = "";
    patch.monthly_transfer_status = "pending";
  }
  const byName = String(body.fixedByName || "").trim();
  if (byName) patch.fixed_by = byName;
  const fixNote = String(body.fixNote || "").trim();
  if (fixNote) {
    const note = String(row.note || "");
    patch.note = note ? `${note}\n[Fix] ${fixNote}` : `[Fix] ${fixNote}`;
  }
  await sb().from(table).update(patch).eq("id", id);
  return { ok: true, success: true };
}

async function assignIssues(
  body: Record<string, unknown>,
  table: "civil_issues" | "electric_issues",
  auth: AuthOk,
) {
  const role = String(auth.role || "").toLowerCase();
  if (role !== "admin" && role !== "editor") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  const ids = (body.ids && (body.ids as string[]).length)
    ? body.ids as string[]
    : (body.id ? [String(body.id)] : []);
  if (!ids.length) return { ok: false, error: "missing_id" };

  let assignedWorkers = (body.assignedWorkers || []) as string[];
  assignedWorkers = assignedWorkers.map(normalizeWorkerId).filter(Boolean);
  if (assignedWorkers.length > 4) {
    return { ok: false, success: false, error: "too_many_workers" };
  }
  const team = teamFor(table);
  for (const w of assignedWorkers) {
    if (!team[w]) return { ok: false, success: false, error: "too_many_workers", message: "Unknown worker." };
  }
  const assignedGroup = normalizeTrade(body.assignedGroup || body.group || "");
  if (!assignedGroup && !assignedWorkers.length) {
    return { ok: false, success: false, error: "invalid_group" };
  }
  const workersRequired = body.workersRequired != null
    ? Number(body.workersRequired) || assignedWorkers.length || 1
    : (assignedWorkers.length || 1);

  const routed = routedDisposition(table);
  const { data: rows } = await sb().from(table).select("*").in("id", ids);
  let updated = 0;
  for (const row of rows || []) {
    if (String(row.disposition || "").toLowerCase() === routed) continue;
    const patch: Record<string, unknown> = {
      assigned_group: assignedGroup || normalizeTrade(team[assignedWorkers[0]] || ""),
      assigned_workers: assignedWorkers,
    };
    if (body.workersRequired != null || assignedWorkers.length) {
      patch.workers_required = workersRequired;
      patch.worker_completions = [];
      patch.status = "open";
      patch.fixed_by = "";
      patch.fixed_at = "";
    }
    const voice = parseAssignVoiceNote(body.assignVoiceNote);
    if (voice) patch.assign_voice_note = voice;
    await sb().from(table).update(patch).eq("id", row.id);
    updated++;
  }
  if (!updated) return { ok: false, error: "Issue not found" };
  return {
    ok: true,
    success: true,
    assignedGroup: assignedGroup || "",
    assignedWorkers,
    workersRequired,
    updated,
  };
}

export const handleAssignCivilIssue = (body: Record<string, unknown>, auth: AuthOk) =>
  assignIssues(body, "civil_issues", auth);
export const handleAssignElectricIssue = (body: Record<string, unknown>, auth: AuthOk) =>
  assignIssues(body, "electric_issues", auth);

async function routeNotDept(
  body: Record<string, unknown>,
  table: "civil_issues" | "electric_issues",
  auth: AuthOk,
) {
  const role = String(auth.role || "").toLowerCase();
  if (role !== "admin" && role !== "editor") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  const id = String(body.id || "");
  const { data: row } = await sb().from(table).select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Issue not found" };
  if (String(row.status) === "fixed") {
    return { ok: false, success: false, error: "already_fixed" };
  }
  const disposition = routedDisposition(table);
  const stamp = `\n[Routed ${disposition} by ${auth.username} @ ${isoNow()}]`;
  await sb().from(table).update({
    disposition,
    fix_delay: "",
    assigned_group: "",
    assigned_workers: [],
    assign_voice_note: null,
    worker_completions: [],
    workers_required: 1,
    status: "open",
    note: String(row.note || "") + stamp,
  }).eq("id", id);
  return { ok: true, success: true, disposition };
}

export const handleRouteCivilNotDept = (b: Record<string, unknown>, a: AuthOk) =>
  routeNotDept(b, "civil_issues", a);
export const handleRouteElectricNotDept = (b: Record<string, unknown>, a: AuthOk) =>
  routeNotDept(b, "electric_issues", a);

async function restoreIssue(
  body: Record<string, unknown>,
  table: "civil_issues" | "electric_issues",
  auth: AuthOk,
) {
  const role = String(auth.role || "").toLowerCase();
  if (role !== "admin" && role !== "editor") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  const id = String(body.id || "");
  const { data } = await sb().from(table).update({ disposition: "" }).eq("id", id).select("id");
  if (!data?.length) return { ok: false, error: "Issue not found" };
  return { ok: true, success: true, disposition: "" };
}

export const handleRestoreCivilIssue = (b: Record<string, unknown>, a: AuthOk) =>
  restoreIssue(b, "civil_issues", a);
export const handleRestoreElectricIssue = (b: Record<string, unknown>, a: AuthOk) =>
  restoreIssue(b, "electric_issues", a);

async function setFixDelay(
  body: Record<string, unknown>,
  table: "civil_issues" | "electric_issues",
  auth: AuthOk,
) {
  const role = String(auth.role || "").toLowerCase();
  if (role !== "admin" && role !== "editor") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  const id = String(body.id || "");
  const { data: row } = await sb().from(table).select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Issue not found" };
  if (String(row.status) === "fixed") return { ok: false, error: "already_fixed" };
  if (String(row.disposition || "").toLowerCase() === routedDisposition(table)) {
    return { ok: false, error: routedDisposition(table) };
  }
  let fixDelay = String(body.fixDelay || "").trim();
  if (body.toggle) {
    fixDelay = String(row.fix_delay || "") === "month_plus" ? "" : "month_plus";
  }
  let note = String(row.note || "");
  if (fixDelay === "month_plus") {
    note += `\n[Needs month+ by ${auth.username} @ ${isoNow()}]`;
  }
  await sb().from(table).update({ fix_delay: fixDelay, note }).eq("id", id);
  return { ok: true, success: true, fixDelay };
}

export const handleSetCivilFixDelay = (b: Record<string, unknown>, a: AuthOk) =>
  setFixDelay(b, "civil_issues", a);
export const handleSetElectricFixDelay = (b: Record<string, unknown>, a: AuthOk) =>
  setFixDelay(b, "electric_issues", a);

export async function handleAddHseInspection(body: Record<string, unknown>) {
  const id = String(body.id || "") || crypto.randomUUID();
  const num = await nextCounter("issnum_HseInspections");
  const date = String(body.date || "");
  const reportPeriod = date.slice(0, 7);
  const { error } = await sb().from("hse_inspections").insert({
    id,
    project: String(body.project || ""),
    building: String(body.building || ""),
    floor: String(body.floor || ""),
    spot: String(body.spot || ""),
    issue_type: String(body.issueType || ""),
    note: String(body.note || ""),
    date,
    photo: String(body.photo || ""),
    fixed_photo: "",
    status: issueStatusFromCondition(body),
    created_by: HSE_INSPECTOR,
    created_at: isoNow(),
    fixed_by: "",
    fixed_at: "",
    num,
    asset_key: String(body.assetKey || ""),
    report_period: String(body.reportPeriod || reportPeriod),
    job_dept: String(body.jobDept || ""),
  });
  if (error) throw error;
  return { ok: true, success: true, id, num };
}

export async function handleUpdateHseInspection(body: Record<string, unknown>) {
  return handleUpdateIssue(body, "hse_inspections");
}

export async function handleGetHseInspections(_body: Record<string, unknown>) {
  return handleGetIssues({}, "hse_inspections");
}
