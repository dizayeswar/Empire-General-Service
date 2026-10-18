import { AuthOk } from "./auth.ts";
import { nextCounter, sb, selectAllRows } from "./db.ts";
import { notifyUsers_ } from "./fcm.ts";
import {
  type AccessLevel,
  isAdminAccount,
  type ModuleAccessKey,
  moduleLevel,
  normalizeWorkerId,
  parseModuleAccess,
} from "./helpers.ts";

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

type DeptCfg = { label: string; sendKey: ModuleAccessKey; workerKey: ModuleAccessKey; prefix: string };

const DTASK_DEPTS: Record<string, DeptCfg> = {
  electrical: {
    label: "Electrical",
    sendKey: "dtask_send_electrical",
    workerKey: "dtask_worker_electrical",
    prefix: "ET",
  },
};

const DTASK_PAGE = "dept-tasks.html";
const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"];
const ITEM_STATUSES = ["pending", "done", "cant_fix"];
const PHOTO_KINDS = ["before", "after"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const VIEW_DEDUPE_MS = 10 * 60 * 1000;

function fail(message: string, error = "not_allowed") {
  return { ok: false, success: false, error, message };
}

function str(v: unknown, max = 2000): string {
  return String(v ?? "").trim().slice(0, max);
}

function deptCfg(raw: unknown): { key: string; cfg: DeptCfg } | null {
  const key = str(raw || "electrical").toLowerCase();
  const cfg = DTASK_DEPTS[key];
  return cfg ? { key, cfg } : null;
}

function levels(auth: AuthOk, cfg: DeptCfg): { send: AccessLevel; work: AccessLevel } {
  if (isAdminAccount(auth.role, auth.moduleAccess)) return { send: "write", work: "write" };
  return {
    send: moduleLevel(auth.moduleAccess, cfg.sendKey),
    work: moduleLevel(auth.moduleAccess, cfg.workerKey),
  };
}

function prettyName(username: string): string {
  return String(username || "")
    .split(/[_.\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function iso(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function taskRef(cfg: DeptCfg, num: unknown): string {
  const n = Number(num) || 0;
  return n ? cfg.prefix + "-" + n : "";
}

function taskToApi(r: Row, cfg: DeptCfg): Row {
  return {
    id: r.id,
    num: Number(r.num) || 0,
    ref: taskRef(cfg, r.num),
    dept: r.dept,
    locationId: r.location_id || "",
    project: r.project || "",
    building: r.building || "",
    floor: r.floor || "",
    unit: r.unit || "",
    status: r.status || "open",
    priority: r.priority || "normal",
    note: r.note || "",
    createdBy: r.created_by || "",
    assignedTo: r.assigned_to || "",
    createdAt: iso(r.created_at),
    sentAt: iso(r.sent_at),
    acceptedAt: iso(r.accepted_at),
    completedAt: iso(r.completed_at),
    cancelledAt: iso(r.cancelled_at),
    updatedAt: iso(r.updated_at),
  };
}

function itemToApi(r: Row): Row {
  return {
    id: r.id,
    taskId: r.task_id,
    issueTypeId: r.issue_type_id || "",
    issueLabel: r.issue_label || "",
    note: r.note || "",
    status: r.status || "pending",
    workerNote: r.worker_note || "",
    completedBy: r.completed_by || "",
    completedAt: iso(r.completed_at),
    sortOrder: Number(r.sort_order) || 0,
  };
}

function eventToApi(r: Row): Row {
  return {
    id: r.id,
    taskId: r.task_id,
    itemId: r.item_id || "",
    actor: r.actor || "",
    action: r.action || "",
    payload: r.payload || {},
    createdAt: iso(r.created_at),
  };
}

function photoToApi(r: Row): Row {
  return {
    id: r.id,
    taskId: r.task_id,
    itemId: r.item_id || "",
    kind: r.kind || "after",
    url: r.url || "",
    uploadedBy: r.uploaded_by || "",
    createdAt: iso(r.created_at),
  };
}

async function logEvent(
  taskId: string,
  actor: string,
  action: string,
  payload: Row = {},
  itemId = "",
) {
  const { error } = await sb().from("dept_task_events").insert({
    task_id: taskId,
    item_id: itemId,
    actor,
    action,
    payload,
  });
  if (error) throw error;
}

async function loadTask(id: string): Promise<Row | null> {
  if (!id) return null;
  const { data, error } = await sb().from("dept_tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

/** A worker sees department-wide open tasks, tasks assigned to them, and nothing else. */
function workerCanSee(task: Row, me: string): boolean {
  const assignee = String(task.assigned_to || "");
  if (assignee === me) return true;
  return !assignee && String(task.status) === "open";
}

async function usersWithAccess(key: ModuleAccessKey): Promise<string[]> {
  const rows = await selectAllRows<Row>("users", { columns: "username,module_access,role" });
  return rows
    .filter((u) => {
      if (String(u.role || "").toLowerCase() === "admin") return false;
      return parseModuleAccess(u.module_access)[key] === "write";
    })
    .map((u) => normalizeWorkerId(u.username))
    .filter(Boolean)
    .sort();
}

async function notifySafe(usernames: string[], title: string, body: string, taskId: string) {
  try {
    await notifyUsers_(usernames, title, body, {
      type: "dtask_assign",
      deptPage: DTASK_PAGE,
      issueId: taskId,
    });
  } catch (_e) { /* a missed alert must not undo the task change */ }
}

function locText(t: Row): string {
  return [t.building, t.floor, t.unit].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
}

async function resolveTaskForAction(body: Body, auth: AuthOk) {
  const task = await loadTask(str(body.id || body.taskId));
  if (!task) return { err: fail("Task not found.", "not_found") };
  const d = deptCfg(task.dept);
  if (!d) return { err: fail("Unknown department.", "bad_dept") };
  const lv = levels(auth, d.cfg);
  if (lv.send === "none" && lv.work === "none") return { err: fail("No access to this department's tasks.") };
  return { task, cfg: d.cfg, lv, me: normalizeWorkerId(auth.username) };
}

// ---------------------------------------------------------------------------
// Catalogs
// ---------------------------------------------------------------------------

export async function handleGetDtaskLocations(body: Body, auth: AuthOk) {
  const d = deptCfg(body.dept);
  if (!d) return fail("Unknown department.", "bad_dept");
  const lv = levels(auth, d.cfg);
  if (lv.send === "none" && lv.work === "none") return fail("No access to department tasks.");
  const rows = await selectAllRows<Row>("dept_locations", {
    columns: "id,project,building,floor,unit,label,sort_order",
    filter: (q) => q.eq("active", true).order("building").order("sort_order").order("unit"),
  });
  return {
    ok: true,
    success: true,
    locations: rows.map((r) => ({
      id: r.id,
      project: r.project,
      building: r.building,
      floor: r.floor,
      unit: r.unit,
      label: r.label,
      sortOrder: Number(r.sort_order) || 0,
    })),
  };
}

export async function handleAddDtaskLocation(body: Body, auth: AuthOk) {
  const d = deptCfg(body.dept);
  if (!d) return fail("Unknown department.", "bad_dept");
  if (levels(auth, d.cfg).send !== "write") return fail("Only task senders can add apartments.");
  const project = str(body.project, 20).toLowerCase();
  const building = str(body.building, 40);
  const floor = str(body.floor, 20);
  const unit = str(body.unit, 40);
  if (!project || !building || !floor || !unit) return fail("Building, floor and apartment are required.", "bad_input");
  const label = building + " " + floor + " " + unit;
  const { data, error } = await sb()
    .from("dept_locations")
    .upsert(
      { project, building, floor, unit, label, active: true, created_by: normalizeWorkerId(auth.username) },
      { onConflict: "project,building,floor,unit" },
    )
    .select("id,project,building,floor,unit,label,sort_order")
    .single();
  if (error) throw error;
  return { ok: true, success: true, location: data };
}

export async function handleGetDtaskIssueTypes(body: Body, auth: AuthOk) {
  const d = deptCfg(body.dept);
  if (!d) return fail("Unknown department.", "bad_dept");
  const lv = levels(auth, d.cfg);
  if (lv.send === "none" && lv.work === "none") return fail("No access to department tasks.");
  const { data, error } = await sb()
    .from("dept_issue_types")
    .select("id,code,label,sort_order")
    .eq("dept", d.key)
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return {
    ok: true,
    success: true,
    issueTypes: (data || []).map((r: Row) => ({ id: r.id, code: r.code, label: r.label })),
  };
}

export async function handleGetDtaskWorkers(body: Body, auth: AuthOk) {
  const d = deptCfg(body.dept);
  if (!d) return fail("Unknown department.", "bad_dept");
  if (levels(auth, d.cfg).send === "none") return fail("Only task senders can see the worker list.");
  const names = await usersWithAccess(d.cfg.workerKey);
  return {
    ok: true,
    success: true,
    workers: names.map((u) => ({ username: u, name: prettyName(u) })),
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function handleGetDtasks(body: Body, auth: AuthOk) {
  const d = deptCfg(body.dept);
  if (!d) return fail("Unknown department.", "bad_dept");
  const lv = levels(auth, d.cfg);
  if (lv.send === "none" && lv.work === "none") return fail("No access to department tasks.");
  const me = normalizeWorkerId(auth.username);
  const asWorker = str(body.view) === "worker" || lv.send === "none";
  const status = str(body.status);

  const tasks = await selectAllRows<Row>("dept_tasks", {
    filter: (q) => {
      let x = q.eq("dept", d.key);
      if (status && TASK_STATUSES.includes(status)) x = x.eq("status", status);
      if (asWorker) x = x.or(`assigned_to.eq."${me}",and(assigned_to.eq."",status.eq.open)`);
      return x.order("created_at", { ascending: false });
    },
  });

  const ids = tasks.map((t) => String(t.id));
  const itemsByTask: Record<string, Row[]> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await sb()
      .from("dept_task_items")
      .select("*")
      .in("task_id", chunk)
      .order("sort_order");
    if (error) throw error;
    for (const it of (data || []) as Row[]) {
      const k = String(it.task_id);
      (itemsByTask[k] = itemsByTask[k] || []).push(itemToApi(it));
    }
  }

  return {
    ok: true,
    success: true,
    view: asWorker ? "worker" : "sender",
    tasks: tasks.map((t) => ({ ...taskToApi(t, d.cfg), items: itemsByTask[String(t.id)] || [] })),
  };
}

export async function handleGetDtask(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, cfg, lv, me } = r;
  if (lv.send === "none" && !workerCanSee(task, me)) return fail("This task is not assigned to you.");

  const id = String(task.id);
  if (!body._skipView && me !== String(task.created_by || "")) {
    const { data: last } = await sb()
      .from("dept_task_events")
      .select("created_at")
      .eq("task_id", id)
      .eq("actor", me)
      .eq("action", "viewed")
      .order("created_at", { ascending: false })
      .limit(1);
    const lastAt = last && last[0] ? new Date(String(last[0].created_at)).getTime() : 0;
    if (!lastAt || Date.now() - lastAt > VIEW_DEDUPE_MS) {
      await logEvent(id, me, "viewed", { status: task.status });
    }
  }

  const [items, events, photos] = await Promise.all([
    sb().from("dept_task_items").select("*").eq("task_id", id).order("sort_order"),
    sb().from("dept_task_events").select("*").eq("task_id", id).order("created_at"),
    sb().from("dept_task_photos").select("*").eq("task_id", id).order("created_at"),
  ]);
  if (items.error) throw items.error;
  if (events.error) throw events.error;
  if (photos.error) throw photos.error;

  return {
    ok: true,
    success: true,
    task: {
      ...taskToApi(task, cfg),
      items: ((items.data || []) as Row[]).map(itemToApi),
      events: ((events.data || []) as Row[]).map(eventToApi),
      photos: ((photos.data || []) as Row[]).map(photoToApi),
    },
  };
}

export async function handleCreateDtask(body: Body, auth: AuthOk) {
  const d = deptCfg(body.dept);
  if (!d) return fail("Unknown department.", "bad_dept");
  if (levels(auth, d.cfg).send !== "write") return fail("This account cannot send tasks to " + d.cfg.label + ".");
  const me = normalizeWorkerId(auth.username);

  const project = str(body.project, 20).toLowerCase();
  const building = str(body.building, 40);
  const floor = str(body.floor, 20);
  const unit = str(body.unit, 40);
  if (!building || !floor) return fail("Pick a building and floor.", "bad_input");

  const rawItems = Array.isArray(body.items) ? body.items as Row[] : [];
  if (!rawItems.length) return fail("Pick at least one issue.", "bad_input");
  if (rawItems.length > 50) return fail("Too many issues on one task (max 50).", "bad_input");

  const { data: typeRows, error: typeErr } = await sb()
    .from("dept_issue_types")
    .select("id,label")
    .eq("dept", d.key);
  if (typeErr) throw typeErr;
  const typeLabel: Record<string, string> = {};
  for (const t of (typeRows || []) as Row[]) typeLabel[String(t.id)] = String(t.label);

  const items: Row[] = [];
  for (const it of rawItems) {
    const typeId = str(it.issueTypeId, 80);
    const label = typeLabel[typeId] ? (str(it.label, 200) || typeLabel[typeId]) : str(it.label, 200);
    if (!label) return fail("Each issue needs a type or a description.", "bad_input");
    items.push({ issue_type_id: typeLabel[typeId] ? typeId : "", issue_label: label, note: str(it.note, 1000) });
  }

  let assignedTo = normalizeWorkerId(body.assignedTo);
  if (assignedTo) {
    const workers = await usersWithAccess(d.cfg.workerKey);
    if (!workers.includes(assignedTo)) return fail("That worker does not have " + d.cfg.label + " task access.", "bad_input");
  }

  let locationId = "";
  if (project) {
    const { data: found, error: findErr } = await sb()
      .from("dept_locations")
      .select("id")
      .eq("project", project).eq("building", building).eq("floor", floor).eq("unit", unit)
      .maybeSingle();
    if (findErr) throw findErr;
    if (found) {
      locationId = String(found.id);
    } else {
      const { data: loc, error: locErr } = await sb()
        .from("dept_locations")
        .insert({ project, building, floor, unit, label: [building, floor, unit].filter(Boolean).join(" "), created_by: me })
        .select("id")
        .single();
      if (locErr) throw locErr;
      locationId = String(loc?.id || "");
    }
  }

  const priority = PRIORITIES.includes(str(body.priority)) ? str(body.priority) : "normal";
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const num = await nextCounter("dtnum_DeptTasks");
  const taskRow = {
    id,
    num,
    dept: d.key,
    location_id: locationId,
    project,
    building,
    floor,
    unit,
    status: "open",
    priority,
    note: str(body.note, 2000),
    created_by: me,
    assigned_to: assignedTo,
    created_at: now,
    sent_at: now,
    updated_at: now,
  };
  const { error: tErr } = await sb().from("dept_tasks").insert(taskRow);
  if (tErr) throw tErr;

  const itemRows = items.map((it, i) => ({ ...it, task_id: id, sort_order: i + 1 }));
  const { data: insertedItems, error: iErr } = await sb().from("dept_task_items").insert(itemRows).select("*");
  if (iErr) throw iErr;

  await logEvent(id, me, "created", {
    dept: d.key,
    location: locText(taskRow),
    priority,
    note: taskRow.note,
    items: itemRows.map((it) => it.issue_label),
  });
  await logEvent(id, me, "sent", { to: assignedTo || "department" });

  const ref = taskRef(d.cfg, num);
  const recipients = assignedTo ? [assignedTo] : await usersWithAccess(d.cfg.workerKey);
  await notifySafe(
    recipients,
    "New " + d.cfg.label + " task " + ref,
    locText(taskRow) + " â€” " + items.length + " issue" + (items.length === 1 ? "" : "s"),
    id,
  );

  return {
    ok: true,
    success: true,
    task: { ...taskToApi(taskRow, d.cfg), items: ((insertedItems || []) as Row[]).map(itemToApi) },
  };
}

export async function handleAcceptDtask(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, lv, me } = r;
  if (lv.work !== "write") return fail("Only workers can accept tasks.");
  if (String(task.status) !== "open") return fail("This task is not open.", "bad_state");
  const assignee = String(task.assigned_to || "");
  if (assignee && assignee !== me) return fail("This task is assigned to someone else.");

  const now = new Date().toISOString();
  let q = sb().from("dept_tasks")
    .update({ status: "in_progress", assigned_to: me, accepted_at: now, updated_at: now })
    .eq("id", task.id)
    .eq("status", "open");
  q = assignee ? q.eq("assigned_to", me) : q.eq("assigned_to", "");
  const { data, error } = await q.select("id");
  if (error) throw error;
  if (!data || !data.length) return fail("Someone else accepted this task first.", "bad_state");

  await logEvent(String(task.id), me, "accepted", { from: "open", to: "in_progress" });
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleUpdateDtaskItem(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, lv, me } = r;
  if (lv.work !== "write" || String(task.assigned_to || "") !== me) return fail("Only the assigned worker can update issues.");
  if (String(task.status) !== "in_progress") return fail("Accept the task first.", "bad_state");

  const itemId = str(body.itemId, 80);
  const status = str(body.status);
  if (!ITEM_STATUSES.includes(status)) return fail("Unknown issue status.", "bad_input");
  const { data: item, error: itErr } = await sb()
    .from("dept_task_items").select("*").eq("id", itemId).eq("task_id", task.id).maybeSingle();
  if (itErr) throw itErr;
  if (!item) return fail("Issue not found on this task.", "not_found");

  const workerNote = body.workerNote != null ? str(body.workerNote, 1000) : String(item.worker_note || "");
  const now = new Date().toISOString();
  const patch: Row = {
    status,
    worker_note: workerNote,
    completed_by: status === "pending" ? "" : me,
    completed_at: status === "pending" ? null : now,
  };
  const { error } = await sb().from("dept_task_items").update(patch).eq("id", itemId);
  if (error) throw error;
  await sb().from("dept_tasks").update({ updated_at: now }).eq("id", task.id);

  await logEvent(String(task.id), me, "item_updated", {
    issue: item.issue_label,
    from: item.status,
    to: status,
    workerNote: workerNote !== String(item.worker_note || "") ? workerNote : undefined,
  }, itemId);
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleCompleteDtask(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, cfg, lv, me } = r;
  if (lv.work !== "write" || String(task.assigned_to || "") !== me) return fail("Only the assigned worker can complete this task.");
  if (String(task.status) !== "in_progress") return fail("This task is not in progress.", "bad_state");

  const { data: items, error: iErr } = await sb().from("dept_task_items").select("status").eq("task_id", task.id);
  if (iErr) throw iErr;
  const pending = ((items || []) as Row[]).filter((i) => String(i.status) === "pending").length;
  if (pending) return fail(pending + " issue(s) are still pending. Mark each one done or can't fix.", "bad_state");

  const now = new Date().toISOString();
  const { error } = await sb().from("dept_tasks")
    .update({ status: "done", completed_at: now, updated_at: now })
    .eq("id", task.id);
  if (error) throw error;
  const note = str(body.note, 1000);
  await logEvent(String(task.id), me, "completed", { from: "in_progress", to: "done", note: note || undefined });

  const sender = String(task.created_by || "");
  if (sender && sender !== me) {
    await notifySafe([sender], cfg.label + " task " + taskRef(cfg, task.num) + " done", locText(task) + " â€” by " + prettyName(me), String(task.id));
  }
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleReopenDtask(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, cfg, lv, me } = r;
  if (lv.send !== "write") return fail("Only task senders can reopen tasks.");
  if (String(task.status) !== "done") return fail("Only finished tasks can be reopened.", "bad_state");
  const reason = str(body.reason, 1000);
  if (!reason) return fail("Write why the task is being reopened.", "bad_input");

  const now = new Date().toISOString();
  const assignee = String(task.assigned_to || "");
  const { error } = await sb().from("dept_tasks")
    .update({ status: assignee ? "in_progress" : "open", completed_at: null, updated_at: now })
    .eq("id", task.id);
  if (error) throw error;
  const { error: iErr } = await sb().from("dept_task_items")
    .update({ status: "pending", completed_by: "", completed_at: null })
    .eq("task_id", task.id);
  if (iErr) throw iErr;
  await logEvent(String(task.id), me, "reopened", { from: "done", to: assignee ? "in_progress" : "open", reason });

  const recipients = assignee ? [assignee] : await usersWithAccess(cfg.workerKey);
  await notifySafe(recipients, cfg.label + " task " + taskRef(cfg, task.num) + " reopened", reason, String(task.id));
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleCancelDtask(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, lv, me } = r;
  if (lv.send !== "write") return fail("Only task senders can cancel tasks.");
  const from = String(task.status);
  if (from === "done" || from === "cancelled") return fail("This task is already closed.", "bad_state");
  const reason = str(body.reason, 1000);
  if (!reason) return fail("Write why the task is being cancelled.", "bad_input");

  const now = new Date().toISOString();
  const { error } = await sb().from("dept_tasks")
    .update({ status: "cancelled", cancelled_at: now, updated_at: now })
    .eq("id", task.id);
  if (error) throw error;
  await logEvent(String(task.id), me, "cancelled", { from, to: "cancelled", reason });
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleReassignDtask(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, cfg, lv, me } = r;
  if (lv.send !== "write") return fail("Only task senders can reassign tasks.");
  const from = String(task.status);
  if (from === "done" || from === "cancelled") return fail("This task is already closed.", "bad_state");

  const to = normalizeWorkerId(body.assignedTo);
  if (to) {
    const workers = await usersWithAccess(cfg.workerKey);
    if (!workers.includes(to)) return fail("That worker does not have " + cfg.label + " task access.", "bad_input");
  }
  const prev = String(task.assigned_to || "");
  if (prev === to) return fail("The task is already assigned that way.", "bad_input");

  const now = new Date().toISOString();
  const { error } = await sb().from("dept_tasks")
    .update({ assigned_to: to, status: "open", accepted_at: null, updated_at: now })
    .eq("id", task.id);
  if (error) throw error;
  await logEvent(String(task.id), me, "reassigned", {
    fromWorker: prev || "department",
    toWorker: to || "department",
    from,
    to: "open",
    reason: str(body.reason, 1000) || undefined,
  });

  const recipients = to ? [to] : await usersWithAccess(cfg.workerKey);
  await notifySafe(recipients, "New " + cfg.label + " task " + taskRef(cfg, task.num), locText(task), String(task.id));
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleAddDtaskNote(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, lv, me } = r;
  if (lv.send === "none" && String(task.assigned_to || "") !== me) return fail("Only the assigned worker can add notes.");
  const text = str(body.text, 2000);
  if (!text) return fail("Write a note first.", "bad_input");
  await logEvent(String(task.id), me, "note", { text }, str(body.itemId, 80));
  await sb().from("dept_tasks").update({ updated_at: new Date().toISOString() }).eq("id", task.id);
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}

export async function handleAddDtaskPhoto(body: Body, auth: AuthOk) {
  const r = await resolveTaskForAction(body, auth);
  if (r.err) return r.err;
  const { task, lv, me } = r;
  if (lv.send === "none" && String(task.assigned_to || "") !== me) return fail("Only the assigned worker can add photos.");
  const url = str(body.url, 1000);
  if (!/^https:\/\//i.test(url)) return fail("Photo upload failed. Try again.", "bad_input");
  const kind = PHOTO_KINDS.includes(str(body.kind)) ? str(body.kind) : "after";
  const itemId = str(body.itemId, 80);
  const { data, error } = await sb().from("dept_task_photos")
    .insert({ task_id: task.id, item_id: itemId, kind, url, uploaded_by: me })
    .select("id")
    .single();
  if (error) throw error;
  await logEvent(String(task.id), me, "photo", { kind, url, photoId: data?.id }, itemId);
  await sb().from("dept_tasks").update({ updated_at: new Date().toISOString() }).eq("id", task.id);
  return handleGetDtask({ id: task.id, _skipView: true }, auth);
}
