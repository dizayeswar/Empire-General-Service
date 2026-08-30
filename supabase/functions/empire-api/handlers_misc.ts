import { AuthOk, getUser, projectsForUser } from "./auth.ts";
import { SHEET_TO_TABLE } from "./config.ts";
import { dtIssue, fmtDate, isoNow, nextCounter, sb, selectAllRows } from "./db.ts";
import {
  isCleaningSupervisorRole,
  normalizeTrade,
  normalizeWorkerId,
  summaryAllowedForToken,
} from "./helpers.ts";

function isAsaasGuard(username: string): boolean {
  return normalizeWorkerId(username) === "asaas_guard1";
}

function asaasToApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    num: r.num,
    date: fmtDate(r.date),
    building: r.building,
    floor: r.floor,
    spot: r.spot,
    itemDescription: r.item_description,
    photo: r.photo,
    apartment: r.apartment,
    status: r.status,
    warehouseNote: r.warehouse_note,
    removedBy: r.removed_by,
    removedByName: r.removed_by_name,
    createdAt: r.created_at,
    returnedAt: r.returned_at,
    returnedTo: r.returned_to,
    returnApartment: r.return_apartment,
    returnPhoto: r.return_photo,
    returnNote: r.return_note,
    updatedAt: r.updated_at,
    photo2: r.photo2,
  };
}

export async function handleGetAsaasItems() {
  const { data, error } = await sb().from("asaas_items").select("*");
  if (error) throw error;
  const out = (data || []).map(asaasToApi);
  out.sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
  return out;
}

export async function handleAddAsaasItem(body: Record<string, unknown>, auth: AuthOk) {
  const building = String(body.building || "").trim();
  const floor = String(body.floor || "").trim();
  const spot = String(body.spot || "").trim();
  const itemDescription = String(body.itemDescription || body.item || "").trim();
  const photo = String(body.photo || "").trim();
  const apartment = String(body.apartment || "").trim();
  if (!itemDescription && !photo) {
    return { ok: false, success: false, error: "empty_item", message: "Add a description or photo before saving." };
  }
  if (!building || !floor) {
    return { ok: false, success: false, error: "missing_location", message: "Building and floor are required." };
  }
  if (!photo) {
    return { ok: false, success: false, error: "missing_photo", message: "A corridor photo is required." };
  }
  const id = String(body.id || "") || `asaas-${Date.now()}`;
  if (body.id) {
    const { data: ex } = await sb().from("asaas_items").select("id,num").eq("id", id).maybeSingle();
    if (ex) return { ok: true, success: true, id, num: ex.num || null, deduped: true };
  }
  const num = await nextCounter("asanum_AsaasItems");
  const now = isoNow();
  const { error } = await sb().from("asaas_items").insert({
    id,
    num,
    date: now.slice(0, 10),
    building,
    floor,
    spot,
    item_description: itemDescription,
    photo,
    apartment,
    status: "in_warehouse",
    warehouse_note: "",
    removed_by: normalizeWorkerId(auth.username),
    removed_by_name: String(body.removedByName || body.displayName || auth.username || "").trim(),
    created_at: now,
    returned_at: "",
    returned_to: "",
    return_apartment: "",
    return_photo: "",
    return_note: "",
    updated_at: now,
    photo2: "",
  });
  if (error) throw error;
  return { ok: true, success: true, id, num };
}

export async function handleUpdateAsaasItem(body: Record<string, unknown>, auth: AuthOk) {
  if (!isAsaasGuard(auth.username)) {
    return { ok: false, success: false, error: "not_allowed", message: "Only the mobile guard can update warehouse items." };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: row } = await sb().from("asaas_items").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, success: false, error: "not_found" };
  if (String(row.status).toLowerCase() === "returned") {
    return { ok: false, success: false, error: "already_returned" };
  }
  const sticker = String(body.photo2 || "").trim();
  if (!sticker) return { ok: false, success: false, error: "not_allowed", message: "Sticker photo is required." };
  if (body.apartment != null || body.warehouseNote != null || body.itemDescription != null) {
    return { ok: false, success: false, error: "not_allowed", message: "Mobile guard can only add the sticker photo." };
  }
  await sb().from("asaas_items").update({ photo2: sticker, updated_at: isoNow() }).eq("id", id);
  return { ok: true, success: true, id };
}

export async function handleMarkAsaasReturned(body: Record<string, unknown>, auth: AuthOk) {
  if (!isAsaasGuard(auth.username)) {
    return { ok: false, success: false, error: "not_allowed", message: "Only the mobile guard can mark items returned." };
  }
  const id = String(body.id || "").trim();
  const returnedTo = String(body.returnedTo || "").trim();
  const returnPhoto = String(body.returnPhoto || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  if (!returnedTo) return { ok: false, success: false, error: "missing_name" };
  if (!returnPhoto) return { ok: false, success: false, error: "missing_photo" };
  const { data: row } = await sb().from("asaas_items").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, success: false, error: "not_found" };
  if (String(row.status).toLowerCase() === "returned") {
    return { ok: false, success: false, error: "already_returned" };
  }
  const now = isoNow();
  await sb().from("asaas_items").update({
    status: "returned",
    returned_at: now,
    returned_to: returnedTo,
    return_apartment: String(body.returnApartment || body.apartment || "").trim(),
    return_photo: returnPhoto,
    return_note: String(body.returnNote || "").trim(),
    updated_at: now,
  }).eq("id", id);
  return { ok: true, success: true, id };
}

export async function handleDeleteAsaasItem(body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data } = await sb().from("asaas_items").delete().eq("id", id).select("id");
  if (!data?.length) return { ok: false, success: false, error: "not_found" };
  return { ok: true, success: true, id };
}

export async function handleClearAsaasItems() {
  const { count } = await sb().from("asaas_items").select("*", { count: "exact", head: true });
  await sb().from("asaas_items").delete().gte("id", "");
  return { ok: true, success: true, deleted: count || 0 };
}

export async function handleGetApplicationCheckMeta() {
  const data = await selectAllRows<{ project?: string; status?: string }>("application_checks", {
    columns: "project,status",
  });
  const projects = new Set<string>();
  const statuses = new Set<string>();
  for (const r of data) {
    if (r.project) projects.add(String(r.project));
    if (r.status) statuses.add(String(r.status));
  }
  return { ok: true, projects: [...projects].sort(), statuses: [...statuses].sort() };
}

export async function handleGetApplicationChecks(body: Record<string, unknown>) {
  const data = await selectAllRows<Record<string, unknown>>("application_checks", {
    filter: (q) => {
      if (body.project) q = q.eq("project", String(body.project));
      if (body.status) q = q.eq("status", String(body.status));
      return q;
    },
  });
  return data.map((r) => ({
    id: r.id,
    project: r.project,
    propertyId: r.property_id,
    phone: r.phone,
    status: r.status,
    note: r.note,
    updatedAt: dtIssue(r.updated_at),
    updatedBy: r.updated_by,
  }));
}

export async function handleGetApplicationCheckDetail(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const { data: row } = await sb().from("application_checks").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  const { data: hist } = await sb().from("application_check_history").select("*").eq("check_id", id);
  const history = (hist || [])
    .map((h) => ({
      id: h.id,
      checkId: h.check_id,
      field: h.field,
      oldValue: h.old_value,
      newValue: h.new_value,
      changedAt: dtIssue(h.changed_at),
      changedBy: h.changed_by,
    }))
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));
  return {
    ok: true,
    id: row.id,
    project: row.project,
    propertyId: row.property_id,
    phone: row.phone,
    status: row.status,
    note: row.note,
    updatedAt: dtIssue(row.updated_at),
    updatedBy: row.updated_by,
    history,
  };
}

export async function handleUpdateApplicationCheck(body: Record<string, unknown>, auth: AuthOk) {
  let id = String(body.id || "").trim();
  if (!id) {
    const project = String(body.project || "").trim().toUpperCase();
    const propertyId = String(body.propertyId || "").trim().toUpperCase();
    id = `${project}|${propertyId}`;
  }
  const { data: row } = await sb().from("application_checks").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  const patch: Record<string, unknown> = {
    updated_at: isoNow(),
    updated_by: auth.username,
  };
  const hist: unknown[] = [];
  const log = async (field: string, oldV: string, newV: string) => {
    if (oldV === newV) return;
    const hid = crypto.randomUUID();
    await sb().from("application_check_history").insert({
      id: hid,
      check_id: id,
      field,
      old_value: oldV,
      new_value: newV,
      changed_at: isoNow(),
      changed_by: auth.username,
    });
    hist.push({ id: hid, field, oldValue: oldV, newValue: newV });
  };
  if (body.phone != null) {
    const phone = String(body.phone).replace(/\D/g, "");
    await log("phone", String(row.phone || ""), phone);
    patch.phone = phone;
  }
  if (body.status != null) {
    const status = String(body.status || "").trim().toUpperCase().replace(/\s+/g, " ");
    await log("status", String(row.status || ""), status);
    patch.status = status;
  }
  if (body.note != null) patch.note = String(body.note || "");
  await sb().from("application_checks").update(patch).eq("id", id);
  const detail = await handleGetApplicationCheckDetail({ id });
  return { ok: true, success: true, ...detail };
}

export async function handleImportApplicationChecks(body: Record<string, unknown>, auth: AuthOk) {
  if (String(auth.role).toLowerCase() !== "admin") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  const items = (body.items || []) as Array<Record<string, unknown>>;
  let inserted = 0, updated = 0, skipped = 0;
  for (const it of items) {
    const project = String(it.project || "").trim().toUpperCase();
    const propertyId = String(it.propertyId || "").trim().toUpperCase();
    if (!project || !propertyId) { skipped++; continue; }
    const id = `${project}|${propertyId}`;
    const { data: ex } = await sb().from("application_checks").select("id").eq("id", id).maybeSingle();
    const row = {
      id,
      project,
      property_id: propertyId,
      phone: String(it.phone || "").replace(/\D/g, ""),
      status: String(it.status || "").trim().toUpperCase().replace(/\s+/g, " "),
      note: String(it.note || ""),
      updated_at: isoNow(),
      updated_by: auth.username,
    };
    await sb().from("application_checks").upsert(row);
    if (ex) updated++;
    else inserted++;
  }
  return { ok: true, success: true, inserted, updated, skipped, processed: inserted + updated + skipped };
}

export async function handleClearApplicationChecks(body: Record<string, unknown>, auth: AuthOk) {
  if (String(auth.role).toLowerCase() !== "admin") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  await sb().from("application_check_history").delete().gte("id", "");
  await sb().from("application_checks").delete().gte("id", "");
  return { ok: true, success: true };
}

export async function handleGetTrash(body: Record<string, unknown>) {
  const filter = body.sheets as string[] | null;
  const data = await selectAllRows("trash");
  const out = [];
  for (const row of data) {
    const src = String(row.source_sheet);
    if (filter && filter.indexOf(src) === -1) continue;
    let preview = "";
    let meta: Record<string, unknown> = {};
    try {
      const arr = row.row_json;
      if (Array.isArray(arr) && (src === "CivilIssues" || src === "ElectricIssues" || src === "FireIssues")) {
        meta = {
          num: Number(arr[15] || 0) || 0,
          issueType: String(arr[5] || ""),
          building: String(arr[2] || ""),
          floor: String(arr[3] || ""),
          spot: String(arr[4] || ""),
          project: String(arr[1] || ""),
          photo: String(arr[8] || ""),
          fixedPhoto: String(arr[9] || ""),
          status: String(arr[10] || ""),
        };
        const parts = [];
        if (meta.num) parts.push("#" + meta.num);
        if (meta.issueType) parts.push(String(meta.issueType));
        if (meta.building || meta.floor) parts.push(`${meta.building || ""}-${meta.floor || ""}`);
        preview = parts.join("  ·  ");
      } else if (arr && typeof arr === "object") {
        if (src === "WarehouseGoodsIssues") {
          const r = arr as Record<string, unknown>;
          const payload = (r.payload && typeof r.payload === "object") ? r.payload as Record<string, unknown> : {};
          const requestNo = String(r.request_no || payload.requestNo || "").trim();
          const requester = String(r.requester || payload.requester || "").trim();
          const company = String(r.company || payload.company || "").trim();
          const num = Number(r.num || 0) || 0;
          const parts = [];
          if (num) parts.push("#" + num);
          if (requestNo) parts.push(requestNo);
          if (requester) parts.push(requester);
          if (company) parts.push(company);
          preview = parts.join(" · ") || "Goods Issue Note";
          meta = {
            num,
            requestNo,
            requester,
            company,
            issueType: String(r.issue_type || payload.issueType || ""),
            done: payload.done === true || payload.status === "done",
          };
        } else {
          preview = JSON.stringify(arr).slice(0, 120);
        }
      }
    } catch { /* ignore */ }
    const item: Record<string, unknown> = {
      trashId: row.trash_id,
      sourceSheet: src,
      preview,
      deletedBy: row.deleted_by,
      deletedAt: row.deleted_at,
      reason: row.reason,
      batchId: row.batch_id,
    };
    Object.assign(item, meta);
    out.push(item);
  }
  out.reverse();
  return out;
}

export async function handleRestoreTrash(body: Record<string, unknown>) {
  const ids = (body.trashIds as string[]) || (body.trashId ? [String(body.trashId)] : null);
  const batchId = body.batchId ? String(body.batchId) : null;
  const sheets = body.sheets as string[] | null;
  const data = await selectAllRows("trash");
  let restored = 0;
  const toDelete: string[] = [];
  for (const row of data) {
    const src = String(row.source_sheet);
    let match = false;
    if (ids) match = ids.indexOf(String(row.trash_id)) !== -1;
    else if (batchId) match = String(row.batch_id) === batchId;
    else if (sheets) match = sheets.indexOf(src) !== -1;
    if (!match) continue;
    const table = SHEET_TO_TABLE[src];
    if (!table || table === "trash") continue;
    const arr = row.row_json;
    try {
      if (Array.isArray(arr) && (src === "CivilIssues" || src === "ElectricIssues" || src === "FireIssues" || src === "HseInspections")) {
        // restore from sheet column array into object
        const obj: Record<string, unknown> = {
          id: String(arr[0] || ""),
          project: String(arr[1] || ""),
          building: String(arr[2] || ""),
          floor: String(arr[3] || ""),
          spot: String(arr[4] || ""),
          issue_type: String(arr[5] || ""),
          note: String(arr[6] || ""),
          date: String(arr[7] || ""),
          photo: String(arr[8] || ""),
          fixed_photo: String(arr[9] || ""),
          status: String(arr[10] || "open"),
          created_by: String(arr[11] || ""),
          created_at: String(arr[12] || ""),
          fixed_by: String(arr[13] || ""),
          fixed_at: String(arr[14] || ""),
          num: Number(arr[15] || 0) || null,
        };
        if (src === "CivilIssues" || src === "ElectricIssues") {
          Object.assign(obj, {
            assigned_group: String(arr[16] || ""),
            workers_required: Number(arr[17] || 1) || 1,
            worker_completions: typeof arr[18] === "string" ? JSON.parse(arr[18] || "[]") : (arr[18] || []),
            assigned_workers: typeof arr[19] === "string" ? JSON.parse(arr[19] || "[]") : (arr[19] || []),
            disposition: String(arr[20] || ""),
            fix_delay: String(arr[21] || ""),
            assign_voice_note: arr[22] || null,
            monthly_transfer_status: String(arr[23] || ""),
            transferred_job_id: String(arr[24] || ""),
            edited_job_note: String(arr[25] || ""),
            transferred_at: String(arr[26] || ""),
            transferred_by: String(arr[27] || ""),
          });
        }
        await sb().from(table).upsert(obj);
      } else if (arr && typeof arr === "object" && !Array.isArray(arr)) {
        await sb().from(table).upsert(arr as Record<string, unknown>);
      }
      restored++;
      toDelete.push(row.trash_id);
    } catch { /* skip bad rows */ }
  }
  if (toDelete.length) await sb().from("trash").delete().in("trash_id", toDelete);
  return { ok: true, success: true, restored };
}

export async function handlePurgeTrash(body: Record<string, unknown>) {
  const ids = (body.trashIds as string[]) || (body.trashId ? [String(body.trashId)] : null);
  const batchId = body.batchId ? String(body.batchId) : null;
  const sheets = body.sheets as string[] | null;
  const data = await selectAllRows("trash");
  const toDelete: string[] = [];
  const liveIdsByTable: Record<string, string[]> = {};
  for (const row of data) {
    const src = String(row.source_sheet);
    let match = false;
    if (ids) match = ids.indexOf(String(row.trash_id)) !== -1;
    else if (batchId) match = String(row.batch_id) === batchId;
    else if (sheets) match = sheets.indexOf(src) !== -1;
    if (!match) continue;
    toDelete.push(row.trash_id);
    // If a "deleted" row somehow still exists in the live table, remove it too.
    const table = SHEET_TO_TABLE[src];
    if (!table || table === "trash") continue;
    const rj = row.row_json;
    let liveId = "";
    if (Array.isArray(rj) && rj[0]) liveId = String(rj[0]);
    else if (rj && typeof rj === "object" && !Array.isArray(rj)) {
      liveId = String((rj as Record<string, unknown>).id || "");
    }
    if (liveId) {
      if (!liveIdsByTable[table]) liveIdsByTable[table] = [];
      liveIdsByTable[table].push(liveId);
    }
  }
  for (const table of Object.keys(liveIdsByTable)) {
    const liveIds = [...new Set(liveIdsByTable[table])];
    for (let i = 0; i < liveIds.length; i += 100) {
      const chunk = liveIds.slice(i, i + 100);
      await sb().from(table).delete().in("id", chunk);
    }
  }
  if (toDelete.length) await sb().from("trash").delete().in("trash_id", toDelete);
  return { ok: true, success: true, purged: toDelete.length };
}

export async function handleReportWorkerLocation(body: Record<string, unknown>, auth: AuthOk) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "bad_coords" };
  }
  let trade = normalizeTrade(auth.trade);
  if (isCleaningSupervisorRole(auth.role)) trade = "cleaning";
  const updatedAt = isoNow();
  await sb().from("worker_locations").upsert({
    username: normalizeWorkerId(auth.username),
    trade,
    lat,
    lng,
    accuracy: body.accuracy != null ? Number(body.accuracy) : null,
    updated_at: updatedAt,
  });
  return { ok: true, success: true, updatedAt };
}

export async function handleGetWorkerLocations(body: Record<string, unknown>, auth: AuthOk) {
  if (String(auth.role).toLowerCase() === "worker") {
    return { ok: false, success: false, error: "not_allowed" };
  }
  const { data, error } = await sb().from("worker_locations").select("*");
  if (error) throw error;
  let workers = (data || []).map((r) => ({
    username: r.username,
    trade: r.trade,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    updatedAt: r.updated_at,
  }));
  const filter = body.tradeFilter as string[] | undefined;
  if (filter?.length) {
    const set = new Set(filter.map((t) => normalizeTrade(t)));
    workers = workers.filter((w) => set.has(normalizeTrade(w.trade)));
  }
  workers.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { ok: true, success: true, workers };
}

export async function handleSaveWorkerPushToken(body: Record<string, unknown>) {
  const username = normalizeWorkerId(body.username);
  const fcm = String(body.fcmToken || body.pushToken || "").trim();
  if (!username || !fcm) return { ok: false, error: "missing" };
  await sb().from("worker_push_tokens").upsert({
    username,
    fcm_token: fcm,
    platform: String(body.platform || "web-fcm"),
    updated_at: isoNow(),
  });
  return { ok: true, success: true };
}

export async function handleGetUiSettings() {
  const { data } = await sb().from("ui_settings").select("*").eq("key", "uiSettings_cleaning").maybeSingle();
  return { ok: true, success: true, settings: data?.settings || null };
}

export async function handleSaveUiSettings(body: Record<string, unknown>) {
  await sb().from("ui_settings").upsert({
    key: "uiSettings_cleaning",
    settings: body.settings || {},
    updated_at: isoNow(),
  });
  return { ok: true, success: true };
}

async function issueStats(table: string) {
  const openRes = await sb().from(table).select("*", { count: "exact", head: true }).neq("status", "fixed");
  const { data: recent } = await sb()
    .from(table)
    .select("created_at,fixed_at")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = recent && recent[0];
  const last = row ? String(row.fixed_at || row.created_at || "") : "";
  return { open: openRes.count || 0, total: 0, lastActivity: last };
}

export async function handleGetSummary(body: Record<string, unknown>) {
  const { verifyTokenSession } = await import("./auth.ts");
  const sess = await verifyTokenSession(String(body.token || ""));
  if (!sess.ok) return sess;
  const summary: Record<string, unknown> = {};
  const allow = (section: string) => summaryAllowedForToken(sess.dept, section, sess.role);

  if (allow("cleaning")) {
    const allowed = projectsForUser(await getUser(sess.username));
    let n = 0;
    let last = "";
    if (!allowed.length) {
      const countRes = await sb().from("cleaning_reports").select("*", { count: "exact", head: true });
      n = countRes.count || 0;
      const { data } = await sb().from("cleaning_reports").select("created_at").order("created_at", { ascending: false }).limit(1);
      if (data && data[0] && data[0].created_at) last = String(data[0].created_at);
    } else {
      const { data } = await sb().from("cleaning_reports").select("created_at,project").order("created_at", { ascending: false });
      for (const r of data || []) {
        const proj = String(r.project || "").toLowerCase();
        if (allowed.indexOf(proj) === -1) continue;
        n++;
        if (!last && r.created_at) last = String(r.created_at);
      }
    }
    summary.cleaning = { open: n, level: n ? "ok" : "muted", label: n + " reports", lastActivity: last };
  }
  if (allow("civil issue")) {
    const s = await issueStats("civil_issues");
    summary.civilIssue = { open: s.open, level: s.open ? "warn" : "muted", label: s.open + " open", lastActivity: s.lastActivity };
  }
  if (allow("electric issue")) {
    const s = await issueStats("electric_issues");
    summary.electricIssue = { open: s.open, level: s.open ? "warn" : "muted", label: s.open + " open", lastActivity: s.lastActivity };
  }
  if (allow("fire")) {
    const s = await issueStats("fire_issues");
    summary.fire = { open: s.open, level: s.open ? "warn" : "muted", label: s.open + " open", lastActivity: s.lastActivity };
  }
  if (allow("hse")) {
    const s = await issueStats("hse_inspections");
    summary.hse = { open: s.open, level: s.open ? "warn" : "muted", label: s.open + " open", lastActivity: s.lastActivity };
  }
  if (allow("asaas")) {
    const { count } = await sb().from("asaas_items").select("*", { count: "exact", head: true }).neq("status", "returned");
    const { data } = await sb().from("asaas_items").select("created_at").order("created_at", { ascending: false }).limit(1);
    const last = data && data[0] && data[0].created_at ? String(data[0].created_at) : "";
    const inWarehouse = count || 0;
    summary.asaas = { open: inWarehouse, level: inWarehouse ? "warn" : "muted", label: inWarehouse + " in warehouse", lastActivity: last };
  }
  if (allow("application")) {
    const { count } = await sb().from("application_checks").select("*", { count: "exact", head: true });
    summary.application = { open: count || 0, level: "muted", label: (count || 0) + " properties", lastActivity: "" };
  }
  if (allow("ups")) {
    const rows = await selectAllRows<{ ups_status?: string; battery_status?: string; updated_at?: string }>("ups_checks", {
      columns: "ups_status,battery_status,updated_at",
    });
    const faulty = rows.filter((r) => {
      const u = String(r.ups_status || "").toLowerCase();
      const b = String(r.battery_status || "").toLowerCase();
      return u === "faulty" || b === "faulty";
    }).length;
    const last = rows.reduce((acc, r) => {
      const t = String(r.updated_at || "");
      return t > acc ? t : acc;
    }, "");
    summary.ups = {
      open: faulty,
      level: faulty ? "warn" : "muted",
      label: faulty ? faulty + " faulty" : rows.length + " UPS units",
      lastActivity: last,
    };
  }
  if (allow("hr")) {
    const rows = await selectAllRows<{ status?: string; updated_at?: string; created_at?: string }>("hr_leave_requests", {
      columns: "status,updated_at,created_at",
    });
    const pending = rows.filter((r) => {
      const st = String(r.status || "").toLowerCase();
      return st !== "processed" && st !== "rejected";
    }).length;
    const last = rows.reduce((acc, r) => {
      const t = String(r.updated_at || r.created_at || "");
      return t > acc ? t : acc;
    }, "");
    summary.hr = {
      open: pending,
      level: pending ? "warn" : "muted",
      label: pending ? pending + " pending" : rows.length + " leave requests",
      lastActivity: last,
    };
  }
  return { ok: true, summary, generatedAt: isoNow() };
}

// stubs for push (v1)
export async function handleSendCleaningReminder(body: Record<string, unknown>) {
  const targets = (body.usernames as string[]) || (body.username ? [String(body.username)] : []);
  return { ok: true, success: true, sent: 0, targets: targets.length };
}
export async function handleNotifyCleaningWeekUnlock() {
  return { ok: true, success: true, sent: 0 };
}
export async function handleTestWorkerPush() {
  return { ok: true, success: true, sent: 0 };
}
export async function handleDebugWorkerPush() {
  return { ok: true, success: true, debug: { fcmConfigured: false } };
}
