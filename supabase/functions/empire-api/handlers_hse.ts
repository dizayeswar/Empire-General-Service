import { AuthOk } from "./auth.ts";
import { nextCounter, sb, selectAllRows } from "./db.ts";
import { type AccessLevel, isAdminAccount, moduleLevel } from "./helpers.ts";

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

// HSE department: observation register + action plan, incidents / fire alarms, and the monthly
// numbers. The page works out the monthly report (KPIs, man-hours, LTIFR, TRIR) from these.

const PRIORITIES = ["High", "Medium", "Low"];
/** Days from "found" to the target date when none is typed. */
const TARGET_DAYS: Record<string, number> = { High: 7, Medium: 14, Low: 30 };
const OBS_STATUS = ["open", "in_progress", "closed"];
const EVENT_KINDS = ["false_alarm", "incident", "accident", "near_miss", "security"];
const MAX_PHOTOS = 10;

function fail(message: string, error = "not_allowed") {
  return { ok: false, success: false, error, message };
}
function str(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}
function maxLevel(...levels: AccessLevel[]): AccessLevel {
  if (levels.includes("write")) return "write";
  if (levels.includes("read")) return "read";
  return "none";
}
function hseLevel(auth: AuthOk): AccessLevel {
  if (isAdminAccount(auth.role, auth.moduleAccess)) return "write";
  return maxLevel(
    moduleLevel(auth.moduleAccess, "hse"),
    moduleLevel(auth.moduleAccess, "hse_log"),
    moduleLevel(auth.moduleAccess, "hse_add"),
    moduleLevel(auth.moduleAccess, "hse_monthly"),
    moduleLevel(auth.moduleAccess, "hse_analytics"),
  );
}
function canWrite(auth: AuthOk) {
  return hseLevel(auth) === "write";
}
/** "2026-10-05" or "" — anything else becomes "". */
function day(v: unknown): string {
  const t = str(v, 30);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(t + "T00:00:00Z").getTime()) ? t : "";
}
function addDays(d: string, n: number): string {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function todayBaghdad(): string {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function photoList(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((u) => str(u, 600)).filter((u) => /^https:\/\//i.test(u)).slice(0, MAX_PHOTOS);
}
function int(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function iso(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function obsToApi(r: Row) {
  return {
    id: r.id,
    num: Number(r.num) || 0,
    building: r.building || "",
    location: r.location || "",
    observation: r.observation || "",
    priority: r.priority || "High",
    requiredAction: r.required_action || "",
    responsible: r.responsible || "",
    status: r.status || "open",
    foundOn: r.found_on || "",
    targetOn: r.target_on || "",
    closedOn: r.closed_on || "",
    remarks: r.remarks || "",
    photos: Array.isArray(r.photos) ? r.photos : [],
    closedPhotos: Array.isArray(r.closed_photos) ? r.closed_photos : [],
    createdBy: r.created_by || "",
    createdAt: iso(r.created_at),
    updatedBy: r.updated_by || "",
    updatedAt: iso(r.updated_at),
  };
}
function eventToApi(r: Row) {
  return {
    id: r.id,
    num: Number(r.num) || 0,
    kind: r.kind || "incident",
    building: r.building || "",
    location: r.location || "",
    happenedAt: iso(r.happened_at),
    cause: r.cause || "",
    outcome: r.outcome || "",
    injury: !!r.injury,
    lostTime: !!r.lost_time,
    daysLost: Number(r.days_lost) || 0,
    status: r.status || "open",
    photos: Array.isArray(r.photos) ? r.photos : [],
    createdBy: r.created_by || "",
    createdAt: iso(r.created_at),
  };
}
function monthToApi(r: Row) {
  return {
    month: r.month,
    workforce: Number(r.workforce) || 0,
    workingDays: Number(r.working_days) || 0,
    hoursPerDay: Number(r.hours_per_day) || 0,
    overallStatus: r.overall_status || "",
    summary: r.summary || "",
    improved: r.improved || "",
    updatedBy: r.updated_by || "",
    updatedAt: iso(r.updated_at),
  };
}

/** Everything the page needs: the whole register, all events and every month's numbers. */
export async function handleGetHseData(_body: Body, auth: AuthOk) {
  const lvl = hseLevel(auth);
  if (lvl === "none") return fail("This account has no HSE access.");
  const [obs, events, months] = await Promise.all([
    selectAllRows("hse_observations", { filter: (q) => q.is("deleted_at", null).order("num", { ascending: true }) }),
    selectAllRows("hse_events", { filter: (q) => q.is("deleted_at", null).order("happened_at", { ascending: false }) }),
    selectAllRows("hse_months", { filter: (q) => q.order("month", { ascending: false }) }),
  ]);
  return {
    ok: true,
    success: true,
    canWrite: lvl === "write",
    targetDays: TARGET_DAYS,
    observations: obs.map(obsToApi),
    events: events.map(eventToApi),
    months: months.map(monthToApi),
  };
}

/** Add (no id) or edit an observation. The HSE number never changes. */
export async function handleSaveHseObservation(body: Body, auth: AuthOk) {
  if (!canWrite(auth)) return fail("You can view HSE but not change it.");
  const id = str(body.id, 80);
  const priority = PRIORITIES.includes(str(body.priority)) ? str(body.priority) : "High";
  const foundOn = day(body.foundOn) || todayBaghdad();
  const targetOn = day(body.targetOn) || addDays(foundOn, TARGET_DAYS[priority]);
  const row: Row = {
    building: str(body.building, 60),
    location: str(body.location, 200),
    observation: str(body.observation, 2000),
    priority,
    required_action: str(body.requiredAction, 2000),
    responsible: str(body.responsible, 120),
    found_on: foundOn,
    target_on: targetOn,
    remarks: str(body.remarks, 2000),
    photos: photoList(body.photos),
    updated_by: auth.username,
    updated_at: new Date().toISOString(),
  };
  if (!row.observation) return fail("Write what the observation is.", "bad_input");
  if (!row.building) return fail("Choose the building or area.", "bad_input");

  if (id) {
    const { data, error } = await sb().from("hse_observations").update(row).eq("id", id).is("deleted_at", null)
      .select("*").maybeSingle();
    if (error) throw error;
    if (!data) return fail("Observation not found.", "not_found");
    return { ok: true, success: true, observation: obsToApi(data as Row) };
  }
  const num = await nextCounter("hse_observation");
  const { data, error } = await sb().from("hse_observations").insert({
    ...row,
    num,
    status: "open",
    created_by: auth.username,
  }).select("*").single();
  if (error) throw error;
  return { ok: true, success: true, observation: obsToApi(data as Row) };
}

/** Open / In progress / Closed. Closing sets the closed date (today unless one is sent). */
export async function handleSetHseObservationStatus(body: Body, auth: AuthOk) {
  if (!canWrite(auth)) return fail("You can view HSE but not change it.");
  const status = str(body.status, 20);
  if (!OBS_STATUS.includes(status)) return fail("Unknown status.", "bad_input");
  const patch: Row = {
    status,
    closed_on: status === "closed" ? (day(body.closedOn) || todayBaghdad()) : null,
    updated_by: auth.username,
    updated_at: new Date().toISOString(),
  };
  if (status === "closed" && Array.isArray(body.closedPhotos)) patch.closed_photos = photoList(body.closedPhotos);
  if (status !== "closed") patch.closed_photos = [];
  const { data, error } = await sb().from("hse_observations").update(patch).eq("id", str(body.id, 80))
    .is("deleted_at", null).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return fail("Observation not found.", "not_found");
  return { ok: true, success: true, observation: obsToApi(data as Row) };
}

export async function handleDeleteHseObservation(body: Body, auth: AuthOk) {
  if (!canWrite(auth)) return fail("You can view HSE but not change it.");
  const { data, error } = await sb().from("hse_observations")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.username })
    .eq("id", str(body.id, 80)).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return fail("Observation not found.", "not_found");
  return { ok: true, success: true };
}

/** Add (no id) or edit an incident / alarm / near miss. */
export async function handleSaveHseEvent(body: Body, auth: AuthOk) {
  if (!canWrite(auth)) return fail("You can view HSE but not change it.");
  const id = str(body.id, 80);
  const kind = EVENT_KINDS.includes(str(body.kind)) ? str(body.kind) : "incident";
  const at = new Date(str(body.happenedAt, 40));
  if (isNaN(at.getTime())) return fail("Choose the date and time it happened.", "bad_input");
  if (at.getTime() > Date.now() + 24 * 3600 * 1000) return fail("The date is in the future.", "bad_input");
  const lostTime = !!body.lostTime;
  const row: Row = {
    kind,
    building: str(body.building, 60),
    location: str(body.location, 200),
    happened_at: at.toISOString(),
    cause: str(body.cause, 2000),
    outcome: str(body.outcome, 2000),
    injury: !!body.injury || lostTime,
    lost_time: lostTime,
    days_lost: lostTime ? int(body.daysLost, 0, 3650) : 0,
    status: str(body.status) === "closed" ? "closed" : "open",
    photos: photoList(body.photos),
    updated_by: auth.username,
    updated_at: new Date().toISOString(),
  };
  if (!row.building) return fail("Choose the building or area.", "bad_input");
  if (id) {
    const { data, error } = await sb().from("hse_events").update(row).eq("id", id).is("deleted_at", null)
      .select("*").maybeSingle();
    if (error) throw error;
    if (!data) return fail("Event not found.", "not_found");
    return { ok: true, success: true, event: eventToApi(data as Row) };
  }
  const num = await nextCounter("hse_event");
  const { data, error } = await sb().from("hse_events").insert({ ...row, num, created_by: auth.username })
    .select("*").single();
  if (error) throw error;
  return { ok: true, success: true, event: eventToApi(data as Row) };
}

export async function handleDeleteHseEvent(body: Body, auth: AuthOk) {
  if (!canWrite(auth)) return fail("You can view HSE but not change it.");
  const { data, error } = await sb().from("hse_events")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.username })
    .eq("id", str(body.id, 80)).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return fail("Event not found.", "not_found");
  return { ok: true, success: true };
}

/** The month's workforce numbers and report text. */
export async function handleSaveHseMonth(body: Body, auth: AuthOk) {
  if (!canWrite(auth)) return fail("You can view HSE but not change it.");
  const month = str(body.month, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("Bad month.", "bad_input");
  const { data, error } = await sb().from("hse_months").upsert({
    month,
    workforce: int(body.workforce, 0, 100000),
    working_days: int(body.workingDays, 0, 31),
    hours_per_day: int(body.hoursPerDay, 0, 24),
    overall_status: str(body.overallStatus, 200),
    summary: str(body.summary, 20000),
    improved: str(body.improved, 5000),
    updated_by: auth.username,
    updated_at: new Date().toISOString(),
  }, { onConflict: "month" }).select("*").single();
  if (error) throw error;
  return { ok: true, success: true, month: monthToApi(data as Row) };
}

/** Hub tile: open observations. */
export async function hseHubStats() {
  const openRes = await sb().from("hse_observations").select("id", { count: "exact", head: true })
    .is("deleted_at", null).neq("status", "closed");
  const { data } = await sb().from("hse_observations").select("updated_at").is("deleted_at", null)
    .order("updated_at", { ascending: false }).limit(1);
  return { open: openRes.count || 0, lastActivity: data && data[0] ? iso(data[0].updated_at) : "" };
}
