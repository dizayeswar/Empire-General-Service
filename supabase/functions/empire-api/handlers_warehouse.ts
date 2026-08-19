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
    payload,
  };
}

export async function handleGetWarehouseGins(_body: Record<string, unknown>) {
  const data = await selectAllRows<Record<string, unknown>>("warehouse_goods_issues");
  const out = data.map(rowToApi);
  out.sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
  );
  return { ok: true, success: true, items: out };
}

export async function handleSaveWarehouseGin(body: Record<string, unknown>, auth: AuthOk) {
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

export async function handleDeleteWarehouseGin(body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data } = await sb().from("warehouse_goods_issues").delete().eq("id", id).select("id");
  if (!data?.length) return { ok: false, success: false, error: "not_found" };
  return { ok: true, success: true, id };
}

export async function handleMarkWarehouseGinDone(body: Record<string, unknown>, auth: AuthOk) {
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, success: false, error: "missing_id" };
  const { data: ex } = await sb().from("warehouse_goods_issues").select("id,payload").eq("id", id).maybeSingle();
  if (!ex) return { ok: false, success: false, error: "not_found" };
  const existingPayload = (ex.payload && typeof ex.payload === "object")
    ? ex.payload as GinPayload
    : {};
  if (existingPayload.done === true || existingPayload.status === "done") {
    return { ok: true, success: true, id, alreadyDone: true };
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

const LAYOUT_KEY = "warehouse_gin_layout";

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
