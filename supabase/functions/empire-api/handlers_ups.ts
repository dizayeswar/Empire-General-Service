import { AuthOk } from "./auth.ts";
import { dtIssue, isoNow, sb, selectAllRows } from "./db.ts";

const UPS_GROUPS = ["wing1", "wing2", "square", "diamond", "tower", "complex"];

function isAdmin(auth: AuthOk) {
  return String(auth.role || "").toLowerCase() === "admin";
}

function monthKey(raw: unknown) {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return "";
}

function currentMonth() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function slugPart(s: string) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function upsRowToApi(r: Record<string, unknown>, extra?: Record<string, unknown>) {
  return {
    id: r.id,
    group: r.ups_group,
    no: Number(r.no || 0) || 0,
    apartment: r.apartment,
    floor: r.floor,
    room: r.room,
    kks: r.kks,
    brand: r.brand,
    capacity: r.capacity,
    upsStatus: r.ups_status,
    batteryStatus: r.battery_status,
    roomClean: r.room_clean,
    acStatus: r.ac_status,
    alarmFault: r.alarm_fault,
    notes: r.notes || "",
    lastInspectedMonth: r.last_inspected_month || "",
    lastInspectedAt: dtIssue(r.last_inspected_at),
    lastInspectedBy: r.last_inspected_by || "",
    updatedAt: dtIssue(r.updated_at),
    updatedBy: r.updated_by,
    ...(extra || {}),
  };
}

function inspectionToApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    unitId: r.unit_id,
    month: r.month,
    upsStatus: r.ups_status,
    batteryStatus: r.battery_status,
    roomClean: r.room_clean,
    acStatus: r.ac_status,
    alarmFault: r.alarm_fault,
    notes: r.notes || "",
    inspectedAt: dtIssue(r.inspected_at),
    inspectedBy: r.inspected_by || "",
  };
}

function historyToApi(h: Record<string, unknown>) {
  return {
    id: h.id,
    checkId: h.check_id,
    field: h.field,
    oldValue: h.old_value,
    newValue: h.new_value,
    inspectionMonth: h.inspection_month || "",
    changedAt: dtIssue(h.changed_at),
    changedBy: h.changed_by,
  };
}

function upsRowFromBody(it: Record<string, unknown>, auth: AuthOk) {
  const group = String(it.group || it.ups_group || "").trim().toLowerCase();
  return {
    id: String(it.id || "").trim(),
    ups_group: UPS_GROUPS.indexOf(group) >= 0 ? group : group,
    no: Number(it.no || 0) || 0,
    apartment: String(it.apartment || "").trim(),
    floor: String(it.floor || "").trim(),
    room: String(it.room || "").trim(),
    kks: String(it.kks || "").trim(),
    brand: String(it.brand || "").trim(),
    capacity: String(it.capacity || "").trim(),
    ups_status: String(it.upsStatus ?? it.ups_status ?? "").trim(),
    battery_status: String(it.batteryStatus ?? it.battery_status ?? "").trim(),
    room_clean: String(it.roomClean ?? it.room_clean ?? "").trim(),
    ac_status: String(it.acStatus ?? it.ac_status ?? "").trim(),
    alarm_fault: String(it.alarmFault ?? it.alarm_fault ?? "").trim(),
    notes: String(it.notes ?? "").trim(),
    updated_at: isoNow(),
    updated_by: auth.username,
  };
}

async function logHistory(
  checkId: string,
  field: string,
  oldV: string,
  newV: string,
  auth: AuthOk,
  month: string,
) {
  if (oldV === newV) return;
  const { error } = await sb().from("ups_check_history").insert({
    id: crypto.randomUUID(),
    check_id: checkId,
    field,
    old_value: oldV,
    new_value: newV,
    inspection_month: month || "",
    changed_at: isoNow(),
    changed_by: auth.username,
  });
  if (error) console.error("ups history log failed", error.message);
}

export async function handleGetUpsChecks(body: Record<string, unknown>) {
  const month = monthKey(body.month);
  const data = await selectAllRows<Record<string, unknown>>("ups_checks", {
    filter: (q) => {
      if (body.group) q = q.eq("ups_group", String(body.group).trim().toLowerCase());
      return q;
    },
  });
  let byUnit: Record<string, Record<string, unknown>> = {};
  if (month) {
    try {
      const inspections = await selectAllRows<Record<string, unknown>>("ups_inspections", {
        filter: (q) => q.eq("month", month),
      });
      for (const row of inspections) {
        byUnit[String(row.unit_id)] = row;
      }
    } catch (_e) {
      byUnit = {};
    }
  }
  return data
    .map((r) => {
      const snap = month ? byUnit[String(r.id)] : null;
      return upsRowToApi(r, {
        inspectedThisMonth: month ? !!snap : undefined,
        monthSnapshot: snap ? inspectionToApi(snap) : undefined,
      });
    })
    .sort((a, b) => {
      const ga = String(a.group || "");
      const gb = String(b.group || "");
      if (ga !== gb) return ga.localeCompare(gb);
      return (Number(a.no) || 0) - (Number(b.no) || 0);
    });
}

export async function handleGetUpsCheckDetail(body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, error: "missing_id" };
  const { data: row } = await sb().from("ups_checks").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  const { data: hist, error: histErr } = await sb().from("ups_check_history").select("*").eq("check_id", id);
  const { data: inspections, error: inspErr } = await sb().from("ups_inspections").select("*").eq("unit_id", id);
  const history = histErr ? [] : (hist || [])
    .map((h) => historyToApi(h as Record<string, unknown>))
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));
  const months = inspErr ? [] : (inspections || [])
    .map((r) => inspectionToApi(r as Record<string, unknown>))
    .sort((a, b) => String(b.month).localeCompare(String(a.month)));
  return {
    ok: true,
    ...upsRowToApi(row as Record<string, unknown>),
    history,
    inspections: months,
  };
}

export async function handleGetUpsHistory(body: Record<string, unknown>) {
  const unitId = String(body.id || body.unitId || "").trim();
  const month = monthKey(body.month);
  let hist: Record<string, unknown>[] = [];
  try {
    hist = await selectAllRows<Record<string, unknown>>("ups_check_history", {
      filter: (q) => {
        if (unitId) q = q.eq("check_id", unitId);
        if (month) q = q.eq("inspection_month", month);
        return q;
      },
    });
  } catch (_e) {
    return [];
  }
  const units = await selectAllRows<Record<string, unknown>>("ups_checks", { columns: "id,apartment,kks,ups_group" });
  const unitMap: Record<string, Record<string, unknown>> = {};
  for (const u of units) unitMap[String(u.id)] = u;
  return hist
    .map((h) => {
      const unit = unitMap[String(h.check_id)] || {};
      return {
        ...historyToApi(h),
        apartment: unit.apartment || "",
        kks: unit.kks || "",
        group: unit.ups_group || "",
      };
    })
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)))
    .slice(0, 400);
}

export async function handleUpdateUpsCheck(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, error: "missing_id" };
  const { data: row } = await sb().from("ups_checks").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  const patch: Record<string, unknown> = {
    updated_at: isoNow(),
    updated_by: auth.username,
  };
  const fields: Array<[string, string, unknown]> = [
    ["apartment", "apartment", body.apartment],
    ["floor", "floor", body.floor],
    ["room", "room", body.room],
    ["kks", "kks", body.kks],
    ["brand", "brand", body.brand],
    ["capacity", "capacity", body.capacity],
    ["upsStatus", "ups_status", body.upsStatus],
    ["batteryStatus", "battery_status", body.batteryStatus],
    ["roomClean", "room_clean", body.roomClean],
    ["acStatus", "ac_status", body.acStatus],
    ["notes", "notes", body.notes],
  ];
  if (body.group != null) {
    const group = String(body.group || "").trim().toLowerCase();
    await logHistory(id, "group", String(row.ups_group || ""), group, auth, "");
    patch.ups_group = group;
  }
  if (body.no != null) {
    const no = String(Number(body.no || 0) || 0);
    await logHistory(id, "no", String(row.no || 0), no, auth, "");
    patch.no = Number(body.no || 0) || 0;
  }
  for (const [apiKey, col, val] of fields) {
    if (val == null) continue;
    const next = String(val).trim();
    await logHistory(id, apiKey, String(row[col] || ""), next, auth, "");
    patch[col] = next;
  }
  if (body.alarmFault != null) {
    const next = String(body.alarmFault || "").trim();
    await logHistory(id, "alarmFault", String(row.alarm_fault || ""), next, auth, "");
    patch.alarm_fault = next;
  }
  await sb().from("ups_checks").update(patch).eq("id", id);
  return handleGetUpsCheckDetail({ id });
}

export async function handleSaveUpsInspection(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || body.unitId || "").trim();
  const month = monthKey(body.month) || currentMonth();
  if (!id) return { ok: false, error: "missing_id" };
  const { data: row } = await sb().from("ups_checks").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };

  const snapshot = {
    ups_status: String(body.upsStatus ?? body.ups_status ?? row.ups_status ?? "").trim(),
    battery_status: String(body.batteryStatus ?? body.battery_status ?? row.battery_status ?? "").trim(),
    room_clean: String(body.roomClean ?? body.room_clean ?? row.room_clean ?? "").trim(),
    ac_status: String(body.acStatus ?? body.ac_status ?? row.ac_status ?? "").trim(),
    alarm_fault: String(body.alarmFault ?? body.alarm_fault ?? row.alarm_fault ?? "").trim(),
    notes: String(body.notes ?? row.notes ?? "").trim(),
  };
  const now = isoNow();
  const { data: existing } = await sb().from("ups_inspections").select("id").eq("unit_id", id).eq("month", month).maybeSingle();
  const inspectionRow = {
    id: existing?.id || crypto.randomUUID(),
    unit_id: id,
    month,
    ...snapshot,
    inspected_at: now,
    inspected_by: auth.username,
  };
  const { error: inspError } = await sb().from("ups_inspections").upsert(inspectionRow);
  if (inspError) console.error("ups inspection save failed", inspError.message);

  await logHistory(id, "upsStatus", String(row.ups_status || ""), snapshot.ups_status, auth, month);
  await logHistory(id, "batteryStatus", String(row.battery_status || ""), snapshot.battery_status, auth, month);
  await logHistory(id, "roomClean", String(row.room_clean || ""), snapshot.room_clean, auth, month);
  await logHistory(id, "acStatus", String(row.ac_status || ""), snapshot.ac_status, auth, month);
  await logHistory(id, "alarmFault", String(row.alarm_fault || ""), snapshot.alarm_fault, auth, month);
  await logHistory(id, "notes", String(row.notes || ""), snapshot.notes, auth, month);

  const identity: Array<[string, string, unknown]> = [
    ["apartment", "apartment", body.apartment],
    ["floor", "floor", body.floor],
    ["room", "room", body.room],
    ["kks", "kks", body.kks],
    ["brand", "brand", body.brand],
    ["capacity", "capacity", body.capacity],
  ];
  const patch: Record<string, unknown> = {
    ...snapshot,
    updated_at: now,
    updated_by: auth.username,
  };
  patch.last_inspected_month = month;
  patch.last_inspected_at = now;
  patch.last_inspected_by = auth.username;
  for (const [apiKey, col, val] of identity) {
    if (val == null) continue;
    const next = String(val).trim();
    await logHistory(id, apiKey, String(row[col] || ""), next, auth, month);
    patch[col] = next;
  }
  await sb().from("ups_checks").update(patch).eq("id", id);
  return handleGetUpsCheckDetail({ id });
}

export async function handleAddUpsCheck(body: Record<string, unknown>, auth: AuthOk) {
  const apartment = String(body.apartment || "").trim();
  const kks = String(body.kks || "E-A").trim();
  const group = String(body.group || body.ups_group || "").trim().toLowerCase();
  if (!apartment) return { ok: false, error: "missing_apartment" };
  if (!group) return { ok: false, error: "missing_group" };
  let id = String(body.id || "").trim();
  if (!id) id = "ups-" + slugPart(apartment) + "-" + slugPart(kks);
  const { data: ex } = await sb().from("ups_checks").select("id").eq("id", id).maybeSingle();
  if (ex) return { ok: false, error: "already_exists", message: "A UPS unit with this id already exists." };
  const siblings = await selectAllRows<{ no?: number }>("ups_checks", {
    columns: "no",
    filter: (q) => q.eq("ups_group", group),
  });
  const nextNo = Number(body.no || 0) || (Math.max(0, ...siblings.map((r) => Number(r.no || 0) || 0)) + 1);
  const row = upsRowFromBody({ ...body, id, group, kks, no: nextNo, apartment }, auth);
  await sb().from("ups_checks").insert(row);
  return handleGetUpsCheckDetail({ id });
}

export async function handleDeleteUpsCheck(body: Record<string, unknown>, auth: AuthOk) {
  if (!isAdmin(auth)) return { ok: false, success: false, error: "not_allowed" };
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, error: "missing_id" };
  await sb().from("ups_check_history").delete().eq("check_id", id);
  await sb().from("ups_inspections").delete().eq("unit_id", id);
  await sb().from("ups_checks").delete().eq("id", id);
  return { ok: true, success: true, id };
}

export async function handleImportUpsChecks(body: Record<string, unknown>, auth: AuthOk) {
  if (!isAdmin(auth)) return { ok: false, success: false, error: "not_allowed" };
  const items = (body.items || []) as Array<Record<string, unknown>>;
  const merge = String(body.mode || "").toLowerCase() === "merge";
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const it of items) {
    const row = upsRowFromBody(it, auth);
    if (!row.id) {
      skipped++;
      continue;
    }
    const { data: ex } = await sb().from("ups_checks").select("id").eq("id", row.id).maybeSingle();
    if (ex && merge) {
      skipped++;
      continue;
    }
    await sb().from("ups_checks").upsert(row);
    if (ex) updated++;
    else inserted++;
  }
  return { ok: true, success: true, inserted, updated, skipped, processed: inserted + updated + skipped };
}

export async function handleClearUpsChecks(body: Record<string, unknown>, auth: AuthOk) {
  if (!isAdmin(auth)) return { ok: false, success: false, error: "not_allowed" };
  await sb().from("ups_check_history").delete().gte("id", "");
  await sb().from("ups_inspections").delete().gte("id", "");
  const { count } = await sb().from("ups_checks").select("*", { count: "exact", head: true });
  await sb().from("ups_checks").delete().gte("id", "");
  return { ok: true, success: true, deleted: count || 0 };
}
