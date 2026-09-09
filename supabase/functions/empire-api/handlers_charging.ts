import { AuthOk } from "./auth.ts";
import { resetPasswordOk } from "./config.ts";
import { isoNow, sb, selectAllRows, trashRows } from "./db.ts";
import { moduleLevel, normalizeRole } from "./helpers.ts";

const TABLE = "charging_requests";
const BOT_TABLE = "charging_bot_state";
const BOT_ID = "default";

const STATUSES = [
  "charged",
  "cannot_charge",
  "no_row",
  "ambiguous",
  "phone_none",
  "phone_many",
  "stopped",
] as const;

type ChargeStatus = (typeof STATUSES)[number];

const STATUS_ALIASES: Record<string, ChargeStatus> = {
  charged: "charged",
  done: "charged",
  success: "charged",
  cannot_charge: "cannot_charge",
  cannotcharge: "cannot_charge",
  pending: "cannot_charge",
  not_green: "cannot_charge",
  grey: "cannot_charge",
  no_row: "no_row",
  norow: "no_row",
  no_row_found: "no_row",
  ambiguous: "ambiguous",
  multi: "ambiguous",
  more_than_one: "ambiguous",
  phone_none: "phone_none",
  phone_search_none: "phone_none",
  phone_many: "phone_many",
  phone_search_many: "phone_many",
  stopped: "stopped",
  stop: "stopped",
};

function isAdmin(auth: AuthOk): boolean {
  if (normalizeRole(auth.role) === "admin") return true;
  return moduleLevel(auth.moduleAccess, "admin") === "write";
}

function canRead(auth: AuthOk): boolean {
  if (normalizeRole(auth.role) === "admin") return true;
  return moduleLevel(auth.moduleAccess, "charging") !== "none";
}

function canWrite(auth: AuthOk): boolean {
  if (normalizeRole(auth.role) === "viewer") return false;
  if (normalizeRole(auth.role) === "admin") return true;
  return moduleLevel(auth.moduleAccess, "charging") === "write";
}

function deny(message: string) {
  return { ok: false, success: false, error: "not_allowed", message };
}

function bad(message: string) {
  return { ok: false, success: false, error: "bad_request", message };
}

function normRu(raw: unknown): string {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

function validRu(ru: string): boolean {
  return /^RU-\d+$/.test(ru);
}

function normUnit(raw: unknown): string {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

/** Website apartments later — never save these on the Nova charging desk. */
export function isOverseasUnit(raw: unknown): boolean {
  const u = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!u) return false;
  if (/^RV-/.test(u) || /^RA-/.test(u) || /^WD-/.test(u)) return true;
  const m = u.match(/^WW-(\d+)(?:-|$)/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 11) return true;
  }
  return false;
}

function normAmount(raw: unknown): string {
  const s = String(raw || "").trim().replace(/,/g, "");
  if (!s) return "";
  const beforeDot = s.split(".")[0];
  const digits = beforeDot.replace(/\D/g, "");
  return digits.slice(0, 12);
}

function normStatus(raw: unknown): ChargeStatus | "" {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((STATUSES as readonly string[]).includes(key)) return key as ChargeStatus;
  return STATUS_ALIASES[key] || "";
}

function normElectric(body: Record<string, unknown>): { electricType: string; tariff: string } {
  const typeRaw = String(body.electricType || body.electric_type || body.type || "").trim().toLowerCase();
  const tariffRaw = String(body.tariff || "").trim().toUpperCase();
  if (typeRaw === "generator" || typeRaw === "t2" || tariffRaw === "T2") {
    return { electricType: "generator", tariff: "T2" };
  }
  if (typeRaw === "national" || typeRaw === "t1" || tariffRaw === "T1") {
    return { electricType: "national", tariff: "T1" };
  }
  return { electricType: "", tariff: "" };
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function bool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function rowToApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    ru: r.ru,
    unitId: r.unit_id,
    novaSearch: r.nova_search,
    electricType: r.electric_type,
    tariff: r.tariff,
    amount: r.amount,
    status: r.status,
    note: r.note || "",
    invoiceUrl: r.invoice_url || "",
    retryRequested: !!r.retry_requested,
    source: r.source || "nova",
    createdBy: r.created_by || "",
    updatedBy: r.updated_by || "",
    chargedAt: r.charged_at || "",
    createdAt: r.created_at || "",
    updatedAt: r.updated_at || "",
  };
}

function countsFrom(rows: Record<string, unknown>[]) {
  const waiting = rows.filter((r) => String(r.status) !== "charged");
  const by = (s: string) => rows.filter((r) => String(r.status) === s).length;
  return {
    total: rows.length,
    charged: by("charged"),
    waiting: waiting.length,
    retryQueued: waiting.filter((r) => !!r.retry_requested).length,
    cannotCharge: by("cannot_charge"),
    noRow: by("no_row"),
    ambiguous: by("ambiguous"),
    phoneNone: by("phone_none"),
    phoneMany: by("phone_many"),
    stopped: by("stopped"),
  };
}

function botToApi(r: Record<string, unknown> | null) {
  return {
    enabled: !!(r && r.enabled),
    updatedBy: r ? String(r.updated_by || "") : "",
    updatedAt: r ? String(r.updated_at || "") : "",
  };
}

async function readBotRow(): Promise<Record<string, unknown>> {
  const { data, error } = await sb().from(BOT_TABLE).select("*").eq("id", BOT_ID).maybeSingle();
  if (error) throw error;
  if (data) return data as Record<string, unknown>;
  const ins = await sb()
    .from(BOT_TABLE)
    .insert({ id: BOT_ID, enabled: false, updated_by: "", updated_at: isoNow() })
    .select("*")
    .single();
  if (ins.error) throw ins.error;
  return ins.data as Record<string, unknown>;
}

async function botEnabled(): Promise<boolean> {
  const row = await readBotRow();
  return !!row.enabled;
}

export async function handleGetChargingRequests(_body: Record<string, unknown>, auth: AuthOk) {
  if (!canRead(auth)) return deny("Charging Electricity access required.");
  const rows = await selectAllRows<Record<string, unknown>>(TABLE);
  rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const bot = await readBotRow();
  return {
    ok: true,
    success: true,
    rows: rows.map(rowToApi),
    counts: countsFrom(rows),
    bot: botToApi(bot),
  };
}

export async function handleGetChargingBotStatus(_body: Record<string, unknown>, auth: AuthOk) {
  if (!canRead(auth)) return deny("Charging Electricity access required.");
  const bot = await readBotRow();
  return { ok: true, success: true, bot: botToApi(bot) };
}

export async function handleSetChargingBotEnabled(body: Record<string, unknown>, auth: AuthOk) {
  if (!isAdmin(auth)) return deny("Only an admin can turn the charging bot on or off.");
  const enabled = body.enabled === true || String(body.enabled || "").toLowerCase() === "true" || body.enabled === 1;
  const now = isoNow();
  const username = String(auth.username || "").trim();
  const payload = {
    id: BOT_ID,
    enabled,
    updated_by: username,
    updated_at: now,
  };
  const { data, error } = await sb().from(BOT_TABLE).upsert(payload).select("*").single();
  if (error) throw error;
  return { ok: true, success: true, bot: botToApi(data as Record<string, unknown>) };
}

export async function handleGetChargingRetryQueue(_body: Record<string, unknown>, auth: AuthOk) {
  if (!canRead(auth)) return deny("Charging Electricity access required.");
  const rows = await selectAllRows<Record<string, unknown>>(TABLE, {
    filter: (q) => q.eq("retry_requested", true).neq("status", "charged"),
  });
  rows.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const bot = await readBotRow();
  return {
    ok: true,
    success: true,
    rows: rows.map(rowToApi),
    count: rows.length,
    bot: botToApi(bot),
    enabled: !!bot.enabled,
  };
}

export async function handleSaveChargingRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) return deny("Write access required to save charging rows.");

  const ru = normRu(body.ru || body.requestId || body.request_id);
  if (!validRu(ru)) {
    return bad("Request ID must look like RU-12345.");
  }

  const unitId = normUnit(body.unitId || body.unit_id || body.unit);
  if (!unitId) return bad("Unit ID is required.");
  if (isOverseasUnit(unitId)) {
    return bad("Overseas units are not listed on this desk (RV, RA, WD, WW-1 to WW-11).");
  }

  const status = normStatus(body.status);
  if (!status) {
    return bad(
      "Status must be charged, cannot_charge, no_row, ambiguous, phone_none, phone_many, or stopped.",
    );
  }

  const { electricType, tariff } = normElectric(body);
  const amount = normAmount(body.amount || body.amountIqd || body.amount_iqd);
  const note = str(body.note || body.cause).slice(0, 500);
  const invoiceUrl = str(body.invoiceUrl || body.invoice_url).slice(0, 2000);
  const novaSearch = str(body.novaSearch || body.nova_search || unitId).slice(0, 80);
  const source = str(body.source || "nova").slice(0, 40) || "nova";

  if (status === "charged" && !invoiceUrl) {
    return bad("Charged rows need an invoice picture.");
  }
  if (status !== "charged" && !note) {
    return bad("Waiting rows need a cause / note.");
  }

  const now = isoNow();
  const username = String(auth.username || "").trim();

  const existing = await sb().from(TABLE).select("*").eq("ru", ru).maybeSingle();
  if (existing.error) throw existing.error;

  const prev = existing.data as Record<string, unknown> | null;
  const chargedAt =
    status === "charged"
      ? (prev && prev.charged_at ? prev.charged_at : now)
      : null;

  const payload: Record<string, unknown> = {
    ru,
    unit_id: unitId,
    nova_search: novaSearch,
    electric_type: electricType,
    tariff,
    amount,
    status,
    note: status === "charged" ? (note || str(prev?.note)) : note,
    invoice_url: status === "charged" ? invoiceUrl : "",
    retry_requested: false,
    source,
    updated_by: username,
    updated_at: now,
    charged_at: chargedAt,
  };

  if (!prev) {
    payload.id = crypto.randomUUID();
    payload.created_by = username;
    payload.created_at = now;
    const ins = await sb().from(TABLE).insert(payload).select("*").single();
    if (ins.error) {
      if (String(ins.error.code) === "23505") {
        const again = await sb().from(TABLE).select("*").eq("ru", ru).maybeSingle();
        if (again.error) throw again.error;
        if (again.data) {
          const updateOnly = { ...payload };
          delete updateOnly.id;
          delete updateOnly.created_at;
          delete updateOnly.created_by;
          const updDup = await sb().from(TABLE).update(updateOnly).eq("id", (again.data as { id: string }).id).select("*").single();
          if (updDup.error) throw updDup.error;
          return { ok: true, success: true, row: rowToApi(updDup.data as Record<string, unknown>) };
        }
      }
      throw ins.error;
    }
    return { ok: true, success: true, row: rowToApi(ins.data as Record<string, unknown>) };
  }

  const upd = await sb().from(TABLE).update(payload).eq("id", prev.id).select("*").single();
  if (upd.error) throw upd.error;
  return { ok: true, success: true, row: rowToApi(upd.data as Record<string, unknown>) };
}

export async function handleRequestChargingRetry(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) return deny("Write access required to queue retries.");
  if (!(await botEnabled())) {
    return deny("The bot is Off. Turn it On first. Try failed again does nothing while Off.");
  }

  const now = isoNow();
  const username = String(auth.username || "").trim();
  const oneRu = normRu(body.ru);
  if (oneRu) {
    if (!validRu(oneRu)) return bad("Request ID must look like RU-12345.");
    const { data, error } = await sb()
      .from(TABLE)
      .select("id,status,retry_requested")
      .eq("ru", oneRu)
      .maybeSingle();
    if (error) throw error;
    if (!data) return bad("That RU is not on the dashboard.");
    if (String(data.status) === "charged") return bad("That RU is already charged.");
    const upd = await sb()
      .from(TABLE)
      .update({ retry_requested: true, updated_at: now, updated_by: username })
      .eq("id", data.id)
      .select("*")
      .single();
    if (upd.error) throw upd.error;
    return {
      ok: true,
      success: true,
      queued: 1,
      row: rowToApi(upd.data as Record<string, unknown>),
    };
  }

  const { data, error } = await sb()
    .from(TABLE)
    .update({ retry_requested: true, updated_at: now, updated_by: username })
    .neq("status", "charged")
    .select("id");
  if (error) throw error;
  const queued = (data || []).length;
  return { ok: true, success: true, queued };
}

export async function handleDeleteChargingRequest(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) return deny("Write access required to delete charging rows.");
  const id = String(body.id || "").trim();
  if (!id) return bad("Request id is required.");
  const { data: ex, error: findErr } = await sb().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (findErr) throw findErr;
  if (!ex) return { ok: false, success: false, error: "not_found", message: "That RU is not on the dashboard." };
  await trashRows("ChargingRequests", [ex], "delete", String(auth.username || body.username || ""));
  const { error } = await sb().from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return { ok: true, success: true, id, trashed: true };
}

export async function handleClearChargingRequests(body: Record<string, unknown>, auth: AuthOk) {
  if (!canWrite(auth)) return deny("Write access required to reset charging data.");
  if (!resetPasswordOk(body)) {
    return { ok: false, success: false, error: "bad_password", message: "Wrong password." };
  }
  const rows = await selectAllRows<Record<string, unknown>>(TABLE);
  const count = rows.length;
  if (count) {
    await trashRows("ChargingRequests", rows, "reset", String(auth.username || body.username || ""));
    const { error } = await sb().from(TABLE).delete().gte("id", "");
    if (error) throw error;
  }
  return { ok: true, success: true, cleared: count };
}
