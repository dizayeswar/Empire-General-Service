import { AuthOk } from "./auth.ts";
import { isoNow, nextCounter, sb, selectAllRows } from "./db.ts";

type GinPayload = Record<string, unknown>;

function rowToApi(r: Record<string, unknown>) {
  const payload = (r.payload && typeof r.payload === "object") ? r.payload as GinPayload : {};
  const done = payload.done === true || payload.status === "done";
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
    assignedTo: String(payload.assignedTo || ""),
    assignedAt: String(payload.assignedAt || ""),
    payload,
  };
}

function isWarehouseReceiver(auth: AuthOk): boolean {
  return String(auth.role || "").toLowerCase() === "warehouse_receiver";
}

export async function handleGetWarehouseGins(_body: Record<string, unknown>, auth: AuthOk) {
  const data = await selectAllRows<Record<string, unknown>>("warehouse_goods_issues");
  let out = data.map(rowToApi);
  if (isWarehouseReceiver(auth)) {
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
  if (isWarehouseReceiver(auth)) {
    return {
      ok: false,
      success: false,
      error: "forbidden",
      message: "Receiver accounts can only add a Received by signature on notes assigned to them.",
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
  if (isWarehouseReceiver(auth)) {
    return { ok: false, success: false, error: "forbidden", message: "Receiver accounts cannot delete notes." };
  }
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data } = await sb().from("warehouse_goods_issues").delete().eq("id", id).select("id");
  if (!data?.length) return { ok: false, success: false, error: "not_found" };
  return { ok: true, success: true, id };
}

export async function handleMarkWarehouseGinDone(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseReceiver(auth)) {
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

export async function handleAssignWarehouseGin(body: Record<string, unknown>, auth: AuthOk) {
  if (isWarehouseReceiver(auth)) {
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
  if (isWarehouseReceiver(auth)) {
    return { ok: true, success: true, users: [] };
  }
  const { data, error } = await sb()
    .from("users")
    .select("username,dept,role")
    .order("username");
  if (error) throw error;
  const users = (data || [])
    .filter((u) => {
      const role = String(u.role || "").trim().toLowerCase();
      const dept = String(u.dept || "").trim().toLowerCase();
      if (role !== "warehouse_receiver") return false;
      if (!dept) return false;
      if (dept === "all" || dept === "warehouse") return true;
      return dept.split(",").map((x) => x.trim()).includes("warehouse");
    })
    .map((u) => ({
      username: String(u.username || ""),
      role: String(u.role || ""),
      dept: String(u.dept || ""),
    }))
    .filter((u) => !!u.username);
  return { ok: true, success: true, users };
}

export async function handleSaveWarehouseGinReceivedSig(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  const received = String(body.received || body.image || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  if (!received) {
    return { ok: false, success: false, error: "missing_sig", message: "Choose a Received by signature first." };
  }
  if (received.length > 900000) {
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
  const assignedTo = String(existingPayload.assignedTo || "").trim().toLowerCase();
  const me = String(auth.username || "").trim().toLowerCase();
  const role = String(auth.role || "").toLowerCase();
  const canStaff = role === "admin" || role === "editor";
  if (isWarehouseReceiver(auth)) {
    if (!assignedTo || assignedTo !== me) {
      return { ok: false, success: false, error: "forbidden", message: "This note is not assigned to you." };
    }
  } else if (!canStaff) {
    return { ok: false, success: false, error: "forbidden", message: "Not allowed." };
  }
  const prevSigs = (existingPayload.sigs && typeof existingPayload.sigs === "object")
    ? existingPayload.sigs as Record<string, unknown>
    : {};
  const now = isoNow();
  const payload = {
    ...existingPayload,
    sigs: {
      auth: String(prevSigs.auth || ""),
      issued: String(prevSigs.issued || ""),
      received,
    },
    receivedSignedAt: now,
    receivedSignedBy: String(auth.username || ""),
  };
  const { error } = await sb().from("warehouse_goods_issues").update({
    payload,
    updated_at: now,
  }).eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, receivedSignedAt: now };
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
