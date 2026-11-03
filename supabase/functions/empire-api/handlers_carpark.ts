import { AuthOk } from "./auth.ts";
import { nextCounter, sb, selectAllRows } from "./db.ts";
import { type AccessLevel, isAdminAccount, moduleLevel } from "./helpers.ts";

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

// Car Park: the portal keeps each apartment's WhatsApp phone and car plates; security reports a
// wrong parking from the phone and the apartment gets an automatic WhatsApp warning (Meta Cloud API).

const PROJECTS: Record<string, string> = { ra: "Royal Apartment", ww: "West Wing", wd: "West Diamond", es: "Empire Square" };
const VIOLATIONS: Record<string, string> = { two_spots: "Took two parking spots", blocking: "Blocking the road / entrance" };
const MAX_PLATES = 5;
const SECURITY_LIST_LIMIT = 50;

// Meta WhatsApp Cloud API. Set with: npx supabase secrets set WHATSAPP_TOKEN=... (see DEPLOY.md).
const WA_API = "https://graph.facebook.com/v21.0";

function fail(message: string, error = "not_allowed") {
  return { ok: false, success: false, error, message };
}

function str(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}

function portalLevel(auth: AuthOk): AccessLevel {
  return isAdminAccount(auth.role, auth.moduleAccess) ? "write" : moduleLevel(auth.moduleAccess, "car_park");
}

function securityLevel(auth: AuthOk): AccessLevel {
  return isAdminAccount(auth.role, auth.moduleAccess) ? "write" : moduleLevel(auth.moduleAccess, "car_park_security");
}

/** Arabic / Persian digits to 0-9, then keep letters and digits only: "٢٢ a-12345" → "22A12345". */
export function normPlate(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .toUpperCase()
    .replace(/[^0-9A-Z؀-ۿ]/g, "");
}

/** Iraqi numbers as typed ("0750 123 4567", "+964…", "00964…") → "9647501234567". */
export function waPhone(raw: unknown): string {
  let d = String(raw ?? "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("07")) d = "964" + d.slice(1);
  else if (d.length === 10 && d.startsWith("7")) d = "964" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function iso(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function erbilTime(v: unknown): string {
  const d = new Date(String(v || Date.now()));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).format(d).replace(",", "");
}

/** Security (phone) accounts never see which apartment a plate belongs to — only the portal does. */
function canSeeApartment(auth: AuthOk): boolean {
  return portalLevel(auth) !== "none";
}

function reportToApi(r: Row, showApartment = true): Row {
  return {
    id: r.id,
    num: Number(r.num) || 0,
    project: r.project || "",
    plate: r.plate || "",
    apartmentCode: showApartment ? (r.apartment_code || "") : "",
    linked: !!r.apartment_code,
    violation: r.violation || "",
    violationLabel: VIOLATIONS[String(r.violation)] || String(r.violation || ""),
    photoUrl: r.photo_url || "",
    warningNo: Number(r.warning_no) || 0,
    reportedBy: r.reported_by || "",
    createdAt: iso(r.created_at),
    waStatus: r.wa_status || "pending",
    waError: r.wa_error || "",
    waSentAt: iso(r.wa_sent_at),
    waTries: Number(r.wa_tries) || 0,
  };
}

async function findCarByPlate(plateNorm: string): Promise<Row | null> {
  if (!plateNorm) return null;
  const { data, error } = await sb().from("carpark_cars").select("apartment_code,plate").eq("plate_norm", plateNorm)
    .maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

async function countWarnings(code: string): Promise<number> {
  const { count, error } = await sb().from("carpark_reports").select("id", { count: "exact", head: true })
    .eq("apartment_code", code).is("deleted_at", null).gt("warning_no", 0);
  if (error) throw error;
  return count || 0;
}

async function getApartment(code: string): Promise<Row | null> {
  const { data, error } = await sb().from("carpark_apartments").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

type WaResult = { status: string; error: string; messageId: string };

async function sendWarningWhatsApp(report: Row, apt: Row | null): Promise<WaResult> {
  if (!apt) return { status: "no_apartment", error: "", messageId: "" };
  const to = waPhone(apt.phone);
  if (!to) return { status: "no_phone", error: "", messageId: "" };
  const token = str(Deno.env.get("WHATSAPP_TOKEN"), 1000);
  const phoneId = str(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"), 60);
  if (!token || !phoneId) return { status: "not_configured", error: "WhatsApp keys are not set yet.", messageId: "" };

  const template = str(Deno.env.get("WHATSAPP_TEMPLATE")) || "car_park_warning";
  const lang = str(Deno.env.get("WHATSAPP_TEMPLATE_LANG")) || "en";
  const withImage = str(Deno.env.get("WHATSAPP_TEMPLATE_IMAGE")) !== "0";
  const text = (t: string) => ({ type: "text", text: t || "-" });
  const components: Row[] = [];
  if (withImage && report.photo_url) {
    components.push({ type: "header", parameters: [{ type: "image", image: { link: String(report.photo_url) } }] });
  }
  components.push({
    type: "body",
    parameters: [
      text(ordinal(Number(report.warning_no) || 1)),
      text(String(report.plate || "")),
      text(VIOLATIONS[String(report.violation)] || String(report.violation || "")),
      text(String(report.apartment_code || "") + " — " + (PROJECTS[String(report.project)] || String(report.project || "").toUpperCase())),
      text(erbilTime(report.created_at)),
    ],
  });

  try {
    const res = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template, language: { code: lang }, components },
      }),
    });
    const out = await res.json().catch(() => ({})) as Row;
    if (!res.ok) {
      const e = (out.error || {}) as Row;
      const msg = [e.message, (e.error_data as Row | undefined)?.details].map((v) => str(v)).filter(Boolean).join(" — ");
      return { status: "failed", error: msg || ("HTTP " + res.status), messageId: "" };
    }
    const msgs = (out.messages || []) as Row[];
    return { status: "sent", error: "", messageId: str(msgs[0]?.id, 200) };
  } catch (err) {
    return { status: "failed", error: str(err instanceof Error ? err.message : err), messageId: "" };
  }
}

async function sendAndSave(report: Row): Promise<Row> {
  const apt = report.apartment_code ? await getApartment(String(report.apartment_code)) : null;
  const wa = await sendWarningWhatsApp(report, apt);
  const patch: Row = {
    wa_status: wa.status,
    wa_error: wa.error.slice(0, 500),
    wa_message_id: wa.messageId,
    wa_tries: (Number(report.wa_tries) || 0) + (wa.status === "sent" || wa.status === "failed" ? 1 : 0),
  };
  if (wa.status === "sent") patch.wa_sent_at = new Date().toISOString();
  const { data, error } = await sb().from("carpark_reports").update(patch).eq("id", report.id).select("*").single();
  if (error) throw error;
  return data as Row;
}

// ---------------------------------------------------------------------------
// Apartments (portal)
// ---------------------------------------------------------------------------

export async function handleGetCarparkApartments(_body: Body, auth: AuthOk) {
  if (portalLevel(auth) === "none") return fail("No access to the Car Park portal.");
  const [apts, cars, reps] = await Promise.all([
    selectAllRows<Row>("carpark_apartments", { filter: (q) => q.order("code") }),
    selectAllRows<Row>("carpark_cars", { columns: "apartment_code,plate", filter: (q) => q.order("created_at") }),
    selectAllRows<Row>("carpark_reports", {
      columns: "apartment_code,created_at",
      filter: (q) => q.is("deleted_at", null).gt("warning_no", 0),
    }),
  ]);
  const plates: Record<string, string[]> = {};
  for (const c of cars) (plates[String(c.apartment_code)] ||= []).push(String(c.plate));
  const warn: Record<string, { n: number; last: string }> = {};
  for (const r of reps) {
    const k = String(r.apartment_code);
    const w = (warn[k] ||= { n: 0, last: "" });
    w.n++;
    const t = iso(r.created_at);
    if (t > w.last) w.last = t;
  }
  return {
    ok: true,
    success: true,
    canWrite: portalLevel(auth) === "write",
    apartments: apts.map((a) => ({
      code: a.code,
      project: a.project,
      phone: a.phone || "",
      ownerName: a.owner_name || "",
      note: a.note || "",
      plates: plates[String(a.code)] || [],
      warnings: warn[String(a.code)]?.n || 0,
      lastWarningAt: warn[String(a.code)]?.last || "",
    })),
  };
}

/** Replace one apartment's plates; refuses a plate that already belongs to another apartment. */
async function savePlates(code: string, platesRaw: unknown): Promise<string> {
  const list = (Array.isArray(platesRaw) ? platesRaw : []).map((p) => str(p, 30)).filter(Boolean);
  const seen = new Set<string>();
  const plates: { plate: string; plate_norm: string }[] = [];
  for (const p of list) {
    const n = normPlate(p);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    plates.push({ plate: p, plate_norm: n });
  }
  if (plates.length > MAX_PLATES) return `An apartment can have at most ${MAX_PLATES} cars.`;
  if (plates.length) {
    const { data, error } = await sb().from("carpark_cars").select("apartment_code,plate,plate_norm")
      .in("plate_norm", plates.map((p) => p.plate_norm)).neq("apartment_code", code);
    if (error) throw error;
    if (data && data.length) {
      const c = data[0] as Row;
      return `Plate ${c.plate} is already on apartment ${c.apartment_code}. Remove it there first.`;
    }
  }
  const del = await sb().from("carpark_cars").delete().eq("apartment_code", code);
  if (del.error) throw del.error;
  if (plates.length) {
    const ins = await sb().from("carpark_cars").insert(plates.map((p) => ({ ...p, apartment_code: code })));
    if (ins.error) throw ins.error;
  }
  return "";
}

export async function handleSaveCarparkApartment(body: Body, auth: AuthOk) {
  if (portalLevel(auth) !== "write") return fail("This account cannot edit Car Park apartments.");
  const code = str(body.code, 40).toUpperCase();
  const apt = await getApartment(code);
  if (!apt) return fail("Apartment not found.", "not_found");
  const phone = str(body.phone, 40);
  if (phone && !waPhone(phone)) return fail("That phone number does not look right. Example: 0750 123 4567", "bad_input");
  const plateErr = await savePlates(code, body.plates);
  if (plateErr) return fail(plateErr, "bad_input");
  const { error } = await sb().from("carpark_apartments").update({
    phone,
    owner_name: str(body.ownerName, 120),
    note: str(body.note, 500),
    updated_by: auth.username,
    updated_at: new Date().toISOString(),
  }).eq("code", code);
  if (error) throw error;
  return { ok: true, success: true };
}

/** Excel import: rows [{code, phone?, ownerName?, plates?: string[]}]. Phone/name overwrite when given; plates are added. */
export async function handleImportCarparkApartments(body: Body, auth: AuthOk) {
  if (portalLevel(auth) !== "write") return fail("This account cannot edit Car Park apartments.");
  const rows = Array.isArray(body.rows) ? body.rows as Row[] : [];
  if (!rows.length) return fail("No rows to import.", "bad_input");
  if (rows.length > 6000) return fail("Too many rows (max 6000).", "bad_input");

  const known = new Set((await selectAllRows<Row>("carpark_apartments", { columns: "code" })).map((r) => String(r.code)));
  const cars = await selectAllRows<Row>("carpark_cars", { columns: "apartment_code,plate_norm" });
  const plateOwner: Record<string, string> = {};
  for (const c of cars) plateOwner[String(c.plate_norm)] = String(c.apartment_code);
  const perApt: Record<string, number> = {};
  for (const c of cars) perApt[String(c.apartment_code)] = (perApt[String(c.apartment_code)] || 0) + 1;

  const problems: string[] = [];
  const updates: Row[] = [];
  const newCars: Row[] = [];
  const now = new Date().toISOString();
  for (const r of rows) {
    const code = str(r.code, 40).toUpperCase();
    if (!code) continue;
    if (!known.has(code)) { problems.push(`${code}: apartment not found`); continue; }
    const phone = str(r.phone, 40);
    if (phone && !waPhone(phone)) problems.push(`${code}: phone "${phone}" looks wrong (kept anyway)`);
    const patch: Row = { code, updated_by: auth.username, updated_at: now };
    if (phone) patch.phone = phone;
    if (str(r.ownerName)) patch.owner_name = str(r.ownerName, 120);
    if (phone || patch.owner_name) updates.push(patch);
    for (const p of (Array.isArray(r.plates) ? r.plates : [])) {
      const plate = str(p, 30);
      const n = normPlate(plate);
      if (!n) continue;
      if (plateOwner[n]) {
        if (plateOwner[n] !== code) problems.push(`${code}: plate ${plate} is already on ${plateOwner[n]}`);
        continue;
      }
      if ((perApt[code] || 0) >= MAX_PLATES) { problems.push(`${code}: more than ${MAX_PLATES} cars, ${plate} skipped`); continue; }
      plateOwner[n] = code;
      perApt[code] = (perApt[code] || 0) + 1;
      newCars.push({ apartment_code: code, plate, plate_norm: n });
    }
  }
  for (let i = 0; i < updates.length; i++) {
    const { code, ...patch } = updates[i];
    const { error } = await sb().from("carpark_apartments").update(patch).eq("code", code);
    if (error) throw error;
  }
  for (let i = 0; i < newCars.length; i += 500) {
    const { error } = await sb().from("carpark_cars").insert(newCars.slice(i, i + 500));
    if (error) throw error;
  }
  return { ok: true, success: true, updated: updates.length, platesAdded: newCars.length, problems: problems.slice(0, 200) };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function handleLookupCarparkPlate(body: Body, auth: AuthOk) {
  if (securityLevel(auth) === "none" && portalLevel(auth) === "none") return fail("No access to Car Park.");
  const car = await findCarByPlate(normPlate(body.plate));
  if (!car) return { ok: true, success: true, found: false };
  const code = String(car.apartment_code);
  const nextWarning = (await countWarnings(code)) + 1;
  return { ok: true, success: true, found: true, apartmentCode: canSeeApartment(auth) ? code : "", nextWarning };
}

export async function handleAddCarparkReport(body: Body, auth: AuthOk) {
  if (securityLevel(auth) !== "write" && portalLevel(auth) !== "write") return fail("This account cannot report cars.");
  const project = str(body.project).toLowerCase();
  if (!PROJECTS[project]) return fail("Pick the project.", "bad_input");
  const violation = str(body.violation);
  if (!VIOLATIONS[violation]) return fail("Pick what the car did.", "bad_input");
  const plate = str(body.plate, 30);
  const plateNorm = normPlate(plate);
  if (plateNorm.length < 2) return fail("Write the car plate number.", "bad_input");
  const photoUrl = str(body.photoUrl, 1000);
  if (!/^https:\/\//i.test(photoUrl)) return fail("Take a photo of the car first.", "bad_input");

  const car = await findCarByPlate(plateNorm);
  const code = car ? String(car.apartment_code) : "";
  const warningNo = code ? (await countWarnings(code)) + 1 : 0;
  const num = await nextCounter("carpark_reports");
  const { data, error } = await sb().from("carpark_reports").insert({
    num,
    project,
    plate,
    plate_norm: plateNorm,
    apartment_code: code,
    violation,
    photo_url: photoUrl,
    warning_no: warningNo,
    reported_by: auth.username,
    wa_status: code ? "pending" : "no_apartment",
  }).select("*").single();
  if (error) throw error;
  const saved = code ? await sendAndSave(data as Row) : data as Row;
  return { ok: true, success: true, report: reportToApi(saved, canSeeApartment(auth)) };
}

export async function handleGetCarparkReports(body: Body, auth: AuthOk) {
  const portal = portalLevel(auth);
  if (portal === "none") {
    if (securityLevel(auth) === "none") return fail("No access to Car Park.");
    const { data, error } = await sb().from("carpark_reports").select("*").eq("reported_by", auth.username)
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(SECURITY_LIST_LIMIT);
    if (error) throw error;
    return { ok: true, success: true, reports: (data || []).map((r: Row) => reportToApi(r, false)) };
  }
  const from = str(body.from, 10);
  const rows = await selectAllRows<Row>("carpark_reports", {
    filter: (q) => {
      q = q.is("deleted_at", null).order("created_at", { ascending: false });
      return /^\d{4}-\d{2}-\d{2}$/.test(from) ? q.gte("created_at", from) : q;
    },
  });
  return { ok: true, success: true, canWrite: portal === "write", reports: rows.map((r) => reportToApi(r)) };
}

async function getReport(id: unknown): Promise<Row | null> {
  const { data, error } = await sb().from("carpark_reports").select("*").eq("id", str(id, 80)).is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

export async function handleResendCarparkWhatsApp(body: Body, auth: AuthOk) {
  if (portalLevel(auth) !== "write") return fail("This account cannot send WhatsApp warnings.");
  const r = await getReport(body.id);
  if (!r) return fail("Report not found.", "not_found");
  if (!r.apartment_code) return fail("Link this report to an apartment first.", "bad_input");
  if (r.wa_status === "sent" && body.force !== true) return fail("This warning was already sent.", "bad_input");
  return { ok: true, success: true, report: reportToApi(await sendAndSave(r)) };
}

/** Plate was not on any apartment: link it, optionally save the plate on that apartment, then warn. */
export async function handleLinkCarparkReport(body: Body, auth: AuthOk) {
  if (portalLevel(auth) !== "write") return fail("This account cannot edit Car Park reports.");
  const r = await getReport(body.id);
  if (!r) return fail("Report not found.", "not_found");
  if (r.apartment_code) return fail("This report is already linked to " + r.apartment_code + ".", "bad_input");
  const code = str(body.apartmentCode, 40).toUpperCase();
  if (!(await getApartment(code))) return fail("Apartment not found.", "not_found");
  if (body.savePlate === true) {
    const owner = await findCarByPlate(String(r.plate_norm));
    if (owner && owner.apartment_code !== code) return fail(`Plate ${owner.plate} is already on ${owner.apartment_code}.`, "bad_input");
    if (!owner) {
      const { error } = await sb().from("carpark_cars").insert({ apartment_code: code, plate: r.plate, plate_norm: r.plate_norm });
      if (error) throw error;
    }
  }
  const warningNo = (await countWarnings(code)) + 1;
  const { data, error } = await sb().from("carpark_reports")
    .update({ apartment_code: code, warning_no: warningNo, wa_status: "pending" }).eq("id", r.id).select("*").single();
  if (error) throw error;
  return { ok: true, success: true, report: reportToApi(await sendAndSave(data as Row)) };
}

export async function handleDeleteCarparkReport(body: Body, auth: AuthOk) {
  if (portalLevel(auth) !== "write") return fail("This account cannot delete Car Park reports.");
  const r = await getReport(body.id);
  if (!r) return fail("Report not found.", "not_found");
  const { error } = await sb().from("carpark_reports")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.username }).eq("id", r.id);
  if (error) throw error;
  return { ok: true, success: true };
}
