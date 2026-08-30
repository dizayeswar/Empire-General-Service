import { AuthOk } from "./auth.ts";
import { fmtDate, isoNow, sb, selectAllRows } from "./db.ts";

/** Highest # from the imported Electric minus.xlsx seed. New rows continue after this. */
const SEED_MAX_NO = 1280;

function rowToApi(r: Record<string, unknown>) {
  return {
    id: String(r.id || ""),
    no: String(r.num || ""),
    num: Number(r.num || 0) || 0,
    unit: String(r.unit || ""),
    date: fmtDate(r.date),
    time: String(r.time || ""),
    agent: String(r.agent || ""),
    phone: String(r.phone || ""),
    notes: String(r.notes || ""),
    extra: true,
    createdBy: String(r.created_by || ""),
    createdAt: r.created_at,
  };
}

async function nextMinusNo(): Promise<number> {
  const rows = await selectAllRows<Record<string, unknown>>("electrical_minus", {
    columns: "num",
  });
  let max = SEED_MAX_NO;
  for (const r of rows) {
    const n = Number(r.num || 0);
    if (n > max) max = n;
  }
  return max + 1;
}

export async function handleGetElectricalMinus() {
  const data = await selectAllRows<Record<string, unknown>>("electrical_minus");
  const out = data.map(rowToApi);
  out.sort((a, b) => (a.num || 0) - (b.num || 0));
  return out;
}

export async function handleAddElectricalMinus(body: Record<string, unknown>, auth: AuthOk) {
  const unit = String(body.unit || "").trim();
  if (!unit) {
    return { ok: false, success: false, error: "missing_unit", message: "Unit is required." };
  }
  const id = String(body.id || "") || `em-${crypto.randomUUID()}`;
  if (body.id) {
    const { data: ex } = await sb().from("electrical_minus").select("*").eq("id", id).maybeSingle();
    if (ex) return { ok: true, success: true, id, num: ex.num, row: rowToApi(ex), deduped: true };
  }
  const num = await nextMinusNo();
  const row = {
    id,
    num,
    unit,
    date: fmtDate(body.date) || isoNow().slice(0, 10),
    time: String(body.time || "").trim(),
    agent: String(body.agent || "").trim(),
    phone: String(body.phone || "").trim(),
    notes: String(body.notes || "").trim(),
    created_by: String(auth.username || body.username || ""),
    created_at: isoNow(),
  };
  const { error } = await sb().from("electrical_minus").insert(row);
  if (error) throw error;
  return { ok: true, success: true, id, num, row: rowToApi(row) };
}

export async function handleDeleteElectricalMinus(body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id || id.indexOf("em-") !== 0) {
    return { ok: false, success: false, error: "not_allowed", message: "Imported rows cannot be deleted here." };
  }
  const { error } = await sb().from("electrical_minus").delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id };
}
