import { projectAllowedForUser, projectsForUser, getUser } from "./auth.ts";
import { fmtDate, isoNow, sb, selectAllRows, trashRows } from "./db.ts";
import { resetPasswordOk } from "./config.ts";

function normalizePhotoSource(v: unknown): string {
  return String(v || "camera").toLowerCase() === "gallery" ? "gallery" : "camera";
}

function photoGps(body: Record<string, unknown>, index: number) {
  let lat: unknown = "", lng: unknown = "", accuracy: unknown = "";
  const gps = body.photoGps as Array<Record<string, unknown>> | undefined;
  if (gps && gps[index]) {
    lat = gps[index].lat;
    lng = gps[index].lng;
    accuracy = gps[index].accuracy;
  } else {
    lat = body.lat;
    lng = body.lng;
    accuracy = body.accuracy;
  }
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { lat: null, lng: null, accuracy: null };
  const acc = Number(accuracy);
  return { lat: la, lng: ln, accuracy: Number.isFinite(acc) ? acc : null };
}

export async function handleSaveReport(body: Record<string, unknown>) {
  const r = (body.report || {}) as Record<string, unknown>;
  if (!(await projectAllowedForUser(String(body.username), r.project))) {
    return { ok: false, success: false, error: "not_allowed", message: "You do not have access to this project." };
  }
  const id = String(r.id || `rep-${Date.now()}`);
  const floors = Array.isArray(r.floors) ? (r.floors as string[]).join(",") : String(r.floors || "");
  const { error } = await sb().from("cleaning_reports").upsert({
    id,
    date: String(r.date || ""),
    project: String(r.project || ""),
    building: String(r.building || ""),
    employees: String(r.employees || ""),
    level: String(r.level || ""),
    floors,
    photo: String(r.photo || ""),
    created_by: String(body.username || ""),
    created_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true, success: true, id };
}

export async function handleGetReports(body: Record<string, unknown>) {
  const dateRaw = String(body.date || body.day || "").trim();
  const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : "";
  const rows = await selectAllRows<Record<string, unknown>>("cleaning_reports", {
    filter: (q) => (date ? q.eq("date", date) : q),
  });
  const allowed = projectsForUser(await getUser(String(body.username || "")));
  const reports = rows
    .filter((row) => {
      const proj = String(row.project || "").trim().toLowerCase();
      if (allowed.length && allowed.indexOf(proj) === -1) return false;
      return true;
    })
    .map((row) => ({
      id: row.id,
      date: fmtDate(row.date),
      project: row.project,
      building: row.building,
      employees: row.employees,
      level: row.level,
      floors: row.floors,
      photo: row.photo,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  return reports;
}

export async function handleDeleteReport(body: Record<string, unknown>) {
  const { data: row } = await sb().from("cleaning_reports").select("*").eq("id", String(body.id)).maybeSingle();
  if (!row) return { ok: false, error: "Report not found" };
  if (!(await projectAllowedForUser(String(body.username), row.project))) {
    return { ok: false, error: "not_allowed", message: "You do not have access to this project." };
  }
  await trashRows("Reports", [[
    row.id, row.date, row.project, row.building, row.employees, row.level, row.floors, row.photo, row.created_by, row.created_at,
  ]], "delete", String(body.username));
  await sb().from("cleaning_reports").delete().eq("id", row.id);
  return { ok: true, success: true };
}

export async function handleSaveTasks(body: Record<string, unknown>) {
  const key = String(body.key || "");
  const val = JSON.stringify(body.tasks);
  const { error } = await sb().from("tasks").upsert({
    key,
    done: null,
    done_blob: val,
    updated_by: String(body.username || ""),
    updated_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true };
}

export async function handleGetTasks(body: Record<string, unknown>) {
  const { data, error } = await sb().from("tasks").select("*");
  if (error) throw error;
  if (body.key) {
    const row = (data || []).find((r) => r.key === body.key);
    if (!row) return { ok: true, tasks: {} };
    try {
      return { ok: true, tasks: JSON.parse(String(row.done_blob || "{}")) };
    } catch {
      return { ok: true, tasks: {} };
    }
  }
  const out: Record<string, boolean> = {};
  for (const row of data || []) {
    if (row.done === true) out[row.key] = true;
  }
  return out;
}

export async function handleSetTask(body: Record<string, unknown>) {
  const key = String(body.key || "");
  const done = !!body.done;
  const { error } = await sb().from("tasks").upsert({
    key,
    done,
    done_blob: null,
    updated_by: String(body.username || ""),
    updated_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true, success: true };
}

export async function handleResetTasks(body: Record<string, unknown>) {
  const keys = (body.keys || []) as string[];
  if (keys.length) await sb().from("tasks").delete().in("key", keys);
  return { ok: true, success: true };
}

export async function handleAddTaskPhoto(body: Record<string, unknown>) {
  const project = String(body.project || "").trim().toLowerCase();
  if (!project) return { ok: false, error: "missing_project", message: "Project is required." };
  if (!(await projectAllowedForUser(String(body.username), project))) {
    return { ok: false, error: "not_allowed", message: "You do not have access to this project." };
  }
  const gps = photoGps(body, 0);
  const source = normalizePhotoSource(body.source || (body.photoSources as string[] | undefined)?.[0]);
  const id = `tp-${crypto.randomUUID()}`;
  const { error } = await sb().from("task_photos").insert({
    id,
    project: String(body.project || ""),
    freq: String(body.freq || ""),
    task: String(body.task || ""),
    date: String(body.date || ""),
    period: String(body.period || ""),
    image: String(body.image || ""),
    created_by: String(body.username || ""),
    created_at: isoNow(),
    lat: gps.lat,
    lng: gps.lng,
    accuracy: gps.accuracy,
    source,
  });
  if (error) throw error;
  return { ok: true, success: true, id, source };
}

export async function handleAddTaskPhotos(body: Record<string, unknown>) {
  const project = String(body.project || "").trim().toLowerCase();
  if (!project) return { ok: false, error: "missing_project", message: "Project is required." };
  if (!(await projectAllowedForUser(String(body.username), project))) {
    return { ok: false, error: "not_allowed", message: "You do not have access to this project." };
  }
  const images = (body.images || []) as string[];
  if (!images.length) return { ok: false, error: "No images" };
  if (images.length > 3) return { ok: false, error: "too_many_photos", message: "Maximum 3 photos per save." };
  const task = String(body.task || "");
  const period = String(body.period || "");
  const { data: existing } = await sb().from("task_photos").select("*")
    .ilike("project", project).eq("task", task).eq("period", period);
  const existingUrls: Record<string, boolean> = {};
  let existingCount = 0;
  for (const r of existing || []) {
    existingCount++;
    if (r.image) existingUrls[r.image] = true;
  }
  const sources = (body.photoSources || []) as string[];
  const items: unknown[] = [];
  let added = 0;
  const now = isoNow();
  for (let i = 0; i < images.length; i++) {
    const img = String(images[i] || "");
    if (!img) continue;
    const source = normalizePhotoSource(sources[i]);
    if (existingUrls[img]) {
      items.push({ id: "existing", image: img, skipped: true, lat: "", lng: "", accuracy: "", source });
      continue;
    }
    if (existingCount + added >= 3) break;
    const id = `tp-${crypto.randomUUID()}`;
    const gps = photoGps(body, i);
    await sb().from("task_photos").insert({
      id,
      project: String(body.project || ""),
      freq: String(body.freq || ""),
      task,
      date: String(body.date || ""),
      period,
      image: img,
      created_by: String(body.username || ""),
      created_at: now,
      lat: gps.lat,
      lng: gps.lng,
      accuracy: gps.accuracy,
      source,
    });
    existingUrls[img] = true;
    added++;
    items.push({ id, image: img, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, source });
  }
  return { ok: true, success: true, items };
}

export async function handleGetTaskPhotos(body: Record<string, unknown>) {
  const prefix = body.periodPrefix ? String(body.periodPrefix) : "";
  // Page through all rows — PostgREST defaults to ~1000 and was truncating busy months,
  // so the portal missed completed tasks that mobile still showed from sticky/offline cache.
  const data = await selectAllRows<Record<string, unknown>>("task_photos", {
    filter: prefix
      ? (q) => q.like("period", `${prefix}%`)
      : undefined,
  });
  return data.map((row) => ({
    id: String(row.id),
    project: String(row.project),
    freq: String(row.freq),
    task: String(row.task),
    date: fmtDate(row.date),
    period: String(row.period || ""),
    image: String(row.image || ""),
    createdBy: String(row.created_by || ""),
    createdAt: String(row.created_at || ""),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    source: normalizePhotoSource(row.source),
  }));
}

export async function handleDeleteTaskPhoto(body: Record<string, unknown>) {
  const { data: row } = await sb().from("task_photos").select("*").eq("id", String(body.id)).maybeSingle();
  if (!row) return { ok: false, error: "Photo not found" };
  await trashRows("TaskPhotos", [row], "delete", String(body.username));
  await sb().from("task_photos").delete().eq("id", row.id);
  return { ok: true, success: true };
}

export async function handleMarkTaskWeek(body: Record<string, unknown>) {
  const weekStart = String(body.weekStart || "");
  const project = String(body.project || "");
  const task = String(body.task || "");
  const { error } = await sb().from("week_coverage").upsert({
    week_start: weekStart,
    project,
    task,
    done: !!body.done,
    image: String(body.image || ""),
    updated_by: String(body.username || ""),
    updated_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true, success: true };
}

export async function handleGetWeekCoverage(body: Record<string, unknown>) {
  const weekStart = String(body.weekStart || "");
  const { data, error } = await sb().from("week_coverage").select("*").eq("week_start", weekStart);
  if (error) throw error;
  const out: Record<string, { done: boolean; image: string }> = {};
  for (const row of data || []) {
    out[`${row.project}|${row.task}`] = { done: !!row.done, image: String(row.image || "") };
  }
  return out;
}

export async function handleGetRangeCoverage(body: Record<string, unknown>) {
  const from = String(body.from || "");
  const to = String(body.to || "");
  const { data, error } = await sb().from("week_coverage").select("*");
  if (error) throw error;
  return (data || [])
    .filter((row) => {
      const ws = fmtDate(row.week_start);
      if (from && ws < from) return false;
      if (to && ws > to) return false;
      return true;
    })
    .map((row) => ({
      weekStart: fmtDate(row.week_start),
      project: String(row.project),
      task: String(row.task),
      done: !!row.done,
      image: String(row.image || ""),
    }));
}

export async function handleLogTask(body: Record<string, unknown>) {
  const { error } = await sb().from("task_log").insert({
    date: String(body.date || ""),
    project: String(body.project || ""),
    freq: String(body.freq || ""),
    task: String(body.task || ""),
    done: !!body.done,
    logged_by: String(body.username || ""),
    logged_at: isoNow(),
  });
  if (error) throw error;
  return { ok: true, success: true };
}

export async function handleGetTaskLog(body: Record<string, unknown>) {
  const from = String(body.from || "");
  const to = String(body.to || "");
  const { data, error } = await sb().from("task_log").select("*");
  if (error) throw error;
  return (data || [])
    .filter((row) => {
      const d = fmtDate(row.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .map((row) => ({
      date: fmtDate(row.date),
      project: String(row.project),
      freq: String(row.freq),
      task: String(row.task),
      done: !!row.done,
      loggedBy: String(row.logged_by || ""),
      loggedAt: String(row.logged_at || ""),
    }));
}

export async function handleClearAll(body: Record<string, unknown>) {
  if (!resetPasswordOk(body)) {
    return { ok: false, success: false, error: "bad_password" };
  }
  const { data: reports } = await sb().from("cleaning_reports").select("*");
  if (reports?.length) {
    await trashRows("Reports", reports, "reset", String(body.username));
    await sb().from("cleaning_reports").delete().gte("id", "");
  }
  const { data: tasks } = await sb().from("tasks").select("*");
  if (tasks?.length) {
    await trashRows("Tasks", tasks, "reset", String(body.username));
    await sb().from("tasks").delete().gte("key", "");
  }
  const { data: photos } = await sb().from("task_photos").select("*");
  if (photos?.length) {
    await trashRows("TaskPhotos", photos, "reset", String(body.username));
    await sb().from("task_photos").delete().gte("id", "");
  }
  const { data: week } = await sb().from("week_coverage").select("*");
  if (week?.length) {
    await trashRows("WeekCoverage", week, "reset", String(body.username));
    await sb().from("week_coverage").delete().gte("week_start", "");
  }
  return { ok: true, success: true };
}
