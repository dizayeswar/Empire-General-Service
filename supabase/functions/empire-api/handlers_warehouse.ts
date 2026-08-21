import { AuthOk, verifyPassword } from "./auth.ts";
import { isoNow, nextCounter, sb, selectAllRows, trashRows } from "./db.ts";
import { resetPasswordOk } from "./config.ts";
import {
  isWarehouseSigner,
  parseWarehouseSigSections,
  type WarehouseSigSlot,
} from "./helpers.ts";

type GinPayload = Record<string, unknown>;

function authSigSections(auth: AuthOk): WarehouseSigSlot[] {
  return parseWarehouseSigSections(auth.warehouseSigSections?.join(",") || "", auth.role);
}

function isWarehouseSignerAuth(auth: AuthOk): boolean {
  return isWarehouseSigner(auth.role, auth.warehouseSigSections?.join(",") || "", auth.dept);
}

function rowToApi(r: Record<string, unknown>) {
  const payload = (r.payload && typeof r.payload === "object") ? r.payload as GinPayload : {};
  const done = payload.done === true || payload.status === "done";
  const closed = payload.closed === true || payload.status === "closed";
  return {
    id: String(r.id || ""),
    num: Number(r.num || 0) || 0,
    requestNo: String(r.request_no || ""),
    requestDate: String(r.request_date || ""),
    requester: String(r.requester || ""),
    company: String(r.company || ""),
    issueType: String(r.issue_type || ""),
    propertyCode: String(r.property_code || ""),
    storeKeeper: String(r.store_keeper || ""),
    createdBy: String(r.created_by || ""),
    createdAt: String(r.created_at || ""),
    updatedAt: String(r.updated_at || ""),
    done,
    doneAt: String(payload.doneAt || ""),
    doneBy: String(payload.doneBy || ""),
    closed,
    closedAt: String(payload.closedAt || ""),
    closedBy: String(payload.closedBy || ""),
    assignedTo: String(payload.assignedTo || ""),
    assignedAt: String(payload.assignedAt || ""),
    payload,
  };
}

export async function handleGetWarehouseGins(_body: Record<string, unknown>, auth: AuthOk) {
  const data = await selectAllRows<Record<string, unknown>>("warehouse_goods_issues");
  let out = data.map(rowToApi);
  if (isWarehouseSignerAuth(auth)) {
    const me = String(auth.username || "").trim().toLowerCase();
    out = out.filter((it) => {
      if (!it.done) return false;
      return String(it.assignedTo || "").trim().toLowerCase() === me;
    });
  }
  out.sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
  );
  return { ok: true, success: true, items: out };
}

export async function handleSaveWarehouseGin(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return {
      ok: false,
      success: false,
      error: "forbidden",
      message: "Warehouse signer accounts can only upload their allowed signature on notes assigned to them.",
    };
  }
  const payload = (body.payload && typeof body.payload === "object")
    ? body.payload as GinPayload
    : {};
  const requestNo = String(body.requestNo || payload.requestNo || "").trim();
  const requestDate = String(body.requestDate || payload.requestDate || "").trim();
  const requester = String(body.requester || payload.requester || "").trim();
  const company = String(body.company || payload.company || "").trim();
  const issueType = String(body.issueType || payload.issueType || "").trim();
  const propertyCode = String(body.propertyCode || payload.property || "").trim();
  const storeKeeper = String(body.storeKeeper || payload.storeKeeper || "").trim();

  if (!requester && !requestNo) {
    return {
      ok: false,
      success: false,
      error: "empty",
      message: "Enter at least Requester or Request No. before saving.",
    };
  }

  const now = isoNow();
  let id = String(body.id || "").trim();
  if (id) {
    const { data: ex } = await sb().from("warehouse_goods_issues").select("id,num,payload").eq("id", id).maybeSingle();
    if (ex) {
      const existingPayload = (ex.payload && typeof ex.payload === "object")
        ? ex.payload as GinPayload
        : {};
      if (existingPayload.done === true || existingPayload.status === "done") {
        return {
          ok: false,
          success: false,
          error: "done",
          message: "This Goods Issue Note is marked Done and cannot be edited.",
        };
      }
      // Preserve done flags if client somehow sends them; new saves stay open.
      const nextPayload = { ...payload };
      delete nextPayload.done;
      delete nextPayload.doneAt;
      delete nextPayload.doneBy;
      delete nextPayload.status;
      const { error } = await sb().from("warehouse_goods_issues").update({
        request_no: requestNo,
        request_date: requestDate,
        requester,
        company,
        issue_type: issueType,
        property_code: propertyCode,
        store_keeper: storeKeeper,
        payload: nextPayload,
        updated_at: now,
      }).eq("id", id);
      if (error) throw error;
      return { ok: true, success: true, id, num: Number(ex.num || 0) || 0, updated: true };
    }
  }

  id = id || `whgin-${Date.now()}`;
  const num = await nextCounter("whgin_WarehouseGoodsIssues");
  const { error } = await sb().from("warehouse_goods_issues").insert({
    id,
    num,
    request_no: requestNo,
    request_date: requestDate,
    requester,
    company,
    issue_type: issueType,
    property_code: propertyCode,
    store_keeper: storeKeeper,
    payload,
    created_by: String(auth.username || ""),
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return { ok: true, success: true, id, num };
}

export async function handleDeleteWarehouseGin(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Receiver accounts cannot delete notes." };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: row } = await sb().from("warehouse_goods_issues").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, success: false, error: "not_found" };
  await trashRows("WarehouseGoodsIssues", [row], "delete", String(auth.username || body.username || ""));
  const { error } = await sb().from("warehouse_goods_issues").delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, trashed: true };
}

function warehouseTrashPreview_(rowJson: unknown): Record<string, unknown> {
  const r = (rowJson && typeof rowJson === "object" && !Array.isArray(rowJson))
    ? rowJson as Record<string, unknown>
    : {};
  const payload = (r.payload && typeof r.payload === "object") ? r.payload as GinPayload : {};
  const done = payload.done === true || payload.status === "done";
  const requestNo = String(r.request_no || payload.requestNo || "").trim();
  const requester = String(r.requester || payload.requester || "").trim();
  const company = String(r.company || payload.company || "").trim();
  const num = Number(r.num || 0) || 0;
  const parts: string[] = [];
  if (num) parts.push("#" + num);
  if (requestNo) parts.push(requestNo);
  if (requester) parts.push(requester);
  if (company) parts.push(company);
  return {
    preview: parts.join(" · ") || "Goods Issue Note",
    num,
    requestNo,
    requester,
    company,
    issueType: String(r.issue_type || payload.issueType || ""),
    requestDate: String(r.request_date || payload.requestDate || ""),
    done,
    status: done ? "done" : "open",
  };
}

export async function handleGetWarehouseTrash(_body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Not allowed." };
  }
  const role = String(auth.role || "").toLowerCase();
  if (role !== "admin") {
    return { ok: false, success: false, error: "not_allowed", message: "Only an admin can open the Recycle Bin." };
  }
  const data = await selectAllRows<Record<string, unknown>>("trash");
  const out = data
    .filter((row) => String(row.source_sheet || "") === "WarehouseGoodsIssues")
    .map((row) => {
      const meta = warehouseTrashPreview_(row.row_json);
      return {
        trashId: String(row.trash_id || ""),
        sourceSheet: "WarehouseGoodsIssues",
        deletedBy: String(row.deleted_by || ""),
        deletedAt: String(row.deleted_at || ""),
        reason: String(row.reason || "delete"),
        batchId: String(row.batch_id || ""),
        ...meta,
      };
    });
  out.reverse();
  return { ok: true, success: true, items: out };
}

async function requireWarehouseRestorePassword_(body: Record<string, unknown>, auth: AuthOk) {
  const password = String(body.password || body.resetPassword || "").trim();
  if (!password) {
    return { ok: false as const, success: false as const, error: "bad_password", message: "Password required to restore." };
  }
  const check = await verifyPassword({ username: auth.username, password });
  if (!check.ok) {
    return { ok: false as const, success: false as const, error: "bad_password", message: "Wrong password." };
  }
  return { ok: true as const };
}

export async function handleRestoreWarehouseTrash(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Not allowed." };
  }
  if (String(auth.role || "").toLowerCase() !== "admin") {
    return { ok: false, success: false, error: "not_allowed", message: "Only an admin can restore from the Recycle Bin." };
  }
  const pw = await requireWarehouseRestorePassword_(body, auth);
  if (!pw.ok) return pw;

  const ids = (body.trashIds as string[]) || (body.trashId ? [String(body.trashId)] : null);
  const restoreAll = !ids || !ids.length;
  const data = await selectAllRows<Record<string, unknown>>("trash");
  let restored = 0;
  const toDelete: string[] = [];
  for (const row of data) {
    if (String(row.source_sheet || "") !== "WarehouseGoodsIssues") continue;
    const tid = String(row.trash_id || "");
    if (!restoreAll && ids!.indexOf(tid) === -1) continue;
    const arr = row.row_json;
    if (!arr || typeof arr !== "object" || Array.isArray(arr)) continue;
    try {
      await sb().from("warehouse_goods_issues").upsert(arr as Record<string, unknown>);
      restored++;
      toDelete.push(tid);
    } catch { /* skip bad rows */ }
  }
  if (toDelete.length) await sb().from("trash").delete().in("trash_id", toDelete);
  return { ok: true, success: true, restored };
}

export async function handlePurgeWarehouseTrash(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Not allowed." };
  }
  if (String(auth.role || "").toLowerCase() !== "admin") {
    return { ok: false, success: false, error: "not_allowed", message: "Only an admin can empty the Recycle Bin." };
  }
  const ids = (body.trashIds as string[]) || (body.trashId ? [String(body.trashId)] : null);
  const purgeAll = !ids || !ids.length;
  const data = await selectAllRows<Record<string, unknown>>("trash");
  const toDelete: string[] = [];
  for (const row of data) {
    if (String(row.source_sheet || "") !== "WarehouseGoodsIssues") continue;
    const tid = String(row.trash_id || "");
    if (!purgeAll && ids!.indexOf(tid) === -1) continue;
    toDelete.push(tid);
  }
  if (toDelete.length) await sb().from("trash").delete().in("trash_id", toDelete);
  return { ok: true, success: true, purged: toDelete.length };
}

/** Wipe all GINs into recycle bin. Does NOT touch form layout or saved signatures. */
export async function handleClearWarehouseGins(body: Record<string, unknown>, auth: AuthOk) {
  if (String(auth.role || "").toLowerCase() !== "admin") {
    return { ok: false, success: false, error: "not_allowed", message: "Only an admin can reset warehouse data." };
  }
  if (!resetPasswordOk(body)) {
    return { ok: false, success: false, error: "bad_password", message: "Wrong password." };
  }
  const { data } = await sb().from("warehouse_goods_issues").select("*");
  const count = data?.length || 0;
  if (count) {
    await trashRows("WarehouseGoodsIssues", data!, "reset", String(auth.username || body.username || ""));
    await sb().from("warehouse_goods_issues").delete().gte("id", "");
  }
  await sb().from("id_counters").upsert({ key: "whgin_WarehouseGoodsIssues", value: 0 });
  // Intentionally leave warehouse_gin_layout + signatures untouched.
  return { ok: true, success: true, cleared: count };
}

export async function handleMarkWarehouseGinDone(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Receiver accounts cannot mark notes Done." };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: ex } = await sb().from("warehouse_goods_issues").select("id,payload").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found" };
  const existingPayload = (ex.payload && typeof ex.payload === "object")
    ? ex.payload as GinPayload
    : {};
  if (existingPayload.done === true || existingPayload.status === "done") {
    return {
      ok: true,
      success: true,
      id,
      alreadyDone: true,
      assignedTo: String(existingPayload.assignedTo || ""),
    };
  }
  const now = isoNow();
  const payload = {
    ...existingPayload,
    done: true,
    status: "done",
    doneAt: now,
    doneBy: String(auth.username || ""),
  };
  const { error } = await sb().from("warehouse_goods_issues").update({
    payload,
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, done: true, doneAt: now };
}

/** Move an assigned note into Done (view-only). Only the assigned signer can do this after signing. */
export async function handleCloseWarehouseGin(body: Record<string, unknown>, auth: AuthOk) {
  if (!isWarehouseSignerAuth(auth)) {
    return {
      ok: false,
      success: false,
      error: "forbidden",
      message: "Only the assigned signer can click Done after signing.",
    };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: ex } = await sb().from("warehouse_goods_issues").select("id,payload").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found" };
  const existingPayload = (ex.payload && typeof ex.payload === "object")
    ? ex.payload as GinPayload
    : {};
  if (!(existingPayload.done === true || existingPayload.status === "done")) {
    return {
      ok: false,
      success: false,
      error: "not_done",
      message: "This note is not ready yet.",
    };
  }
  if (existingPayload.closed === true || existingPayload.status === "closed") {
    return { ok: true, success: true, id, alreadyClosed: true };
  }
  const assignedTo = String(existingPayload.assignedTo || "").trim().toLowerCase();
  const me = String(auth.username || "").trim().toLowerCase();
  if (!assignedTo || assignedTo !== me) {
    return {
      ok: false,
      success: false,
      error: "forbidden",
      message: "This note is not assigned to you.",
    };
  }
  const sections = authSigSections(auth);
  if (!sections.length) {
    return {
      ok: false,
      success: false,
      error: "missing_sig_slots",
      message: "Your account has no signature section configured. Ask an admin to set Authorized / Issued / Received.",
    };
  }
  const sigs = (existingPayload.sigs && typeof existingPayload.sigs === "object")
    ? existingPayload.sigs as Record<string, unknown>
    : {};
  const isRealSig = (v: unknown) => {
    const s = String(v || "").trim();
    if (!s || s.length < 80) return false;
    return true;
  };
  const missing = sections.filter((slot) => !isRealSig(sigs[slot]));
  if (missing.length) {
    return {
      ok: false,
      success: false,
      error: "missing_sig",
      message: "Upload your signature (" + missing.join(", ") + ") before clicking Done.",
    };
  }
  const now = isoNow();
  const payload = {
    ...existingPayload,
    closed: true,
    status: "closed",
    closedAt: now,
    closedBy: String(auth.username || ""),
  };
  const { error } = await sb().from("warehouse_goods_issues").update({
    payload,
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, closed: true, closedAt: now };
}

export async function handleAssignWarehouseGin(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Receiver accounts cannot assign notes." };
  }
  const id = String(body.id || "").trim();
  const assignedTo = String(body.assignedTo || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  if (!assignedTo) {
    return {
      ok: false,
      success: false,
      error: "missing_assignee",
      message: "Choose an account to assign this Done note to (Received by).",
    };
  }
  const { data: ex } = await sb().from("warehouse_goods_issues").select("id,payload").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found" };
  const existingPayload = (ex.payload && typeof ex.payload === "object")
    ? ex.payload as GinPayload
    : {};
  if (!(existingPayload.done === true || existingPayload.status === "done")) {
    return {
      ok: false,
      success: false,
      error: "not_done",
      message: "Mark the note Done in Saved Notes before assigning.",
    };
  }
  if (existingPayload.closed === true || existingPayload.status === "closed") {
    return {
      ok: false,
      success: false,
      error: "closed",
      message: "This note is already in Done (view only). It cannot be reassigned.",
    };
  }
  const now = isoNow();
  const payload = {
    ...existingPayload,
    assignedTo,
    assignedAt: now,
  };
  const { error } = await sb().from("warehouse_goods_issues").update({
    payload,
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, assignedTo, assignedAt: now };
}

export async function handleListWarehouseAssignees(_body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseSignerAuth(auth)) {
    return { ok: true, success: true, users: [] };
  }
  const { data, error } = await sb()
    .from("users")
    .select("username,dept,role,warehouse_sig_sections")
    .order("username");
  if (error) throw error;
  const users = (data || [])
    .map((u) => {
      const role = String(u.role || "").trim().toLowerCase();
      const dept = String(u.dept || "").trim().toLowerCase();
      const sections = parseWarehouseSigSections(u.warehouse_sig_sections, role);
      const signer = isWarehouseSigner(role, sections.join(","), dept);
      if (!signer) return null;
      if (!dept) return null;
      const deptOk = dept === "all" || dept === "warehouse" ||
        dept.split(",").map((x) => x.trim()).includes("warehouse");
      if (!deptOk) return null;
      return {
        username: String(u.username || ""),
        role: String(u.role || ""),
        dept: String(u.dept || ""),
        warehouseSigSections: sections,
      };
    })
    .filter((u): u is NonNullable<typeof u> => !!u && !!u.username);
  return { ok: true, success: true, users };
}

export async function handleSaveWarehouseGinReceivedSig(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  const slotRaw = String(body.slot || body.which || "received").trim().toLowerCase();
  const slot = (["auth", "issued", "received"].includes(slotRaw) ? slotRaw : "received") as WarehouseSigSlot;
  const image = String(
    body[slot] || body.image || body.received || body.auth || body.issued || "",
  ).trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  if (!image) {
    return {
      ok: false,
      success: false,
      error: "missing_sig",
      message: "Choose a signature image first.",
    };
  }
  if (image.length > 900000) {
    return { ok: false, success: false, error: "too_large", message: "Signature image is too large." };
  }
  const { data: ex } = await sb().from("warehouse_goods_issues").select("id,payload").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found" };
  const existingPayload = (ex.payload && typeof ex.payload === "object")
    ? ex.payload as GinPayload
    : {};
  const done = existingPayload.done === true || existingPayload.status === "done";
  if (!done) {
    return { ok: false, success: false, error: "not_done", message: "Only Done notes can receive a signature." };
  }
  if (existingPayload.closed === true || existingPayload.status === "closed") {
    return {
      ok: false,
      success: false,
      error: "closed",
      message: "This note is already in Done (view only). Signatures cannot be changed.",
    };
  }
  const assignedTo = String(existingPayload.assignedTo || "").trim().toLowerCase();
  const me = String(auth.username || "").trim().toLowerCase();
  const role = String(auth.role || "").toLowerCase();
  const sections = authSigSections(auth);
  const signer = isWarehouseSignerAuth(auth);
  const canStaff = (role === "admin" || role === "editor") && !signer;
  if (signer) {
    if (!assignedTo || assignedTo !== me) {
      return { ok: false, success: false, error: "forbidden", message: "This note is not assigned to you." };
    }
    if (!sections.includes(slot)) {
      return {
        ok: false,
        success: false,
        error: "forbidden",
        message: "Your account is not allowed to sign \"" + slot + "\".",
      };
    }
  } else if (!canStaff) {
    return { ok: false, success: false, error: "forbidden", message: "Not allowed." };
  }
  const prevSigs = (existingPayload.sigs && typeof existingPayload.sigs === "object")
    ? existingPayload.sigs as Record<string, unknown>
    : {};
  const now = isoNow();
  const nextSigs = {
    auth: String(prevSigs.auth || ""),
    issued: String(prevSigs.issued || ""),
    received: String(prevSigs.received || ""),
  };
  nextSigs[slot] = image;
  const payload: GinPayload = {
    ...existingPayload,
    sigs: nextSigs,
  };
  if (slot === "received") {
    payload.receivedSignedAt = now;
    payload.receivedSignedBy = String(auth.username || "");
  } else if (slot === "auth") {
    payload.authSignedAt = now;
    payload.authSignedBy = String(auth.username || "");
  } else if (slot === "issued") {
    payload.issuedSignedAt = now;
    payload.issuedSignedBy = String(auth.username || "");
  }
  const { error } = await sb().from("warehouse_goods_issues").update({
    payload,
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, slot, signedAt: now };
}

const LAYOUT_KEY = "warehouse_gin_layout";
const SIGS_KEY = "warehouse_signatures";

export async function handleGetWarehouseLayout(_body: Record<string, unknown>) {
  const { data } = await sb().from("ui_settings").select("settings,updated_at").eq("key", LAYOUT_KEY).maybeSingle();
  const layout = (data?.settings && typeof data.settings === "object")
    ? data.settings as Record<string, unknown>
    : {};
  return {
    ok: true,
    success: true,
    layout,
    updatedAt: String(data?.updated_at || ""),
  };
}

export async function handleSaveWarehouseLayout(body: Record<string, unknown>, auth: AuthOk) {
  const layout = (body.layout && typeof body.layout === "object")
    ? body.layout as Record<string, unknown>
    : {};
  const now = isoNow();
  const { error } = await sb().from("ui_settings").upsert({
    key: LAYOUT_KEY,
    settings: layout,
    updated_at: now,
  });
  if (error) throw error;
  return {
    ok: true,
    success: true,
    updatedAt: now,
    savedBy: String(auth.username || ""),
  };
}

type WhSig = {
  id: string;
  name: string;
  image: string;
  createdBy: string;
  createdAt: string;
  passSalt?: string;
  passHash?: string;
};

function normalizeSigList(raw: unknown): WhSig[] {
  const settings = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
  const items = Array.isArray(settings.items) ? settings.items : (Array.isArray(raw) ? raw : []);
  return items.map((it, i) => {
    const row = (it && typeof it === "object") ? it as Record<string, unknown> : {};
    const out: WhSig = {
      id: String(row.id || `whsig-${i}`),
      name: String(row.name || "Signature"),
      image: String(row.image || ""),
      createdBy: String(row.createdBy || ""),
      createdAt: String(row.createdAt || ""),
    };
    const salt = String(row.passSalt || "").trim();
    const hash = String(row.passHash || "").trim();
    if (salt && hash) {
      out.passSalt = salt;
      out.passHash = hash;
    }
    return out;
  }).filter((s) => !!s.image);
}

export async function handleGetWarehouseSignatures(_body: Record<string, unknown>) {
  const { data } = await sb().from("ui_settings").select("settings,updated_at").eq("key", SIGS_KEY).maybeSingle();
  const items = normalizeSigList(data?.settings);
  return {
    ok: true,
    success: true,
    items,
    updatedAt: String(data?.updated_at || ""),
  };
}

export async function handleSaveWarehouseSignatures(body: Record<string, unknown>, auth: AuthOk) {
  const items = normalizeSigList({ items: body.items });
  // Cap size / count to protect ui_settings row
  if (items.length > 40) {
    return { ok: false, success: false, error: "too_many", message: "Maximum 40 saved signatures." };
  }
  for (const it of items) {
    if (it.image.length > 900000) {
      return {
        ok: false,
        success: false,
        error: "too_large",
        message: "One signature image is too large. Use a smaller PNG/JPG.",
      };
    }
  }
  const now = isoNow();
  const { error } = await sb().from("ui_settings").upsert({
    key: SIGS_KEY,
    settings: {
      items,
      updatedBy: String(auth.username || ""),
    },
    updated_at: now,
  });
  if (error) throw error;
  return { ok: true, success: true, items, updatedAt: now };
}
