import { CIVIL_WORKER_TEAM, ELECTRIC_WORKER_TEAM } from "./config.ts";

export function normalizeRole(role: unknown): string {
  const r = String(role || "").trim().toLowerCase();
  if (r === "engineer") return "editor";
  if (r === "cleaning supervisor" || r === "cleaning-supervisor" || r === "supervisor") {
    return "cleaning_supervisor";
  }
  if (r === "warehouse receiver" || r === "warehouse-receiver" || r === "receiver") {
    return "warehouse_receiver";
  }
  if (["admin", "viewer", "editor", "worker", "cleaning_supervisor", "warehouse_receiver"].includes(r)) return r;
  return "editor";
}

export function normalizeDeptField(d: unknown): string {
  return String(d || "").trim().toLowerCase();
}

export function deptListAllows(userDept: string, requestedDept: string): boolean {
  userDept = normalizeDeptField(userDept);
  requestedDept = normalizeDeptField(requestedDept);
  if (!userDept || !requestedDept) return false;
  if (userDept === "all") return true;
  if (userDept === requestedDept) return true;
  if (userDept.indexOf(",") === -1) return false;
  return userDept.split(",").map((x) => x.trim()).includes(requestedDept);
}

export const tokenDeptAllows = deptListAllows;

export function normalizeTrade(raw: unknown): string {
  let t = String(raw || "").trim().toLowerCase();
  if (t === "pipes" || t === "pipe" || t === "plumbing") return "plumber";
  if (t === "carpentry" || t === "carpenter" || t === "doors") return "wood";
  if (t === "electrician") return "electric";
  if (t === "electric") return "electric";
  if (["plumber", "painting", "tiles", "wood"].includes(t)) return t;
  return t;
}

export function normalizeWorkerId(raw: unknown): string {
  return String(raw || "").trim().toLowerCase();
}

const WAREHOUSE_SIG_SLOTS = ["auth", "issued", "received"] as const;
export type WarehouseSigSlot = (typeof WAREHOUSE_SIG_SLOTS)[number];

/** Parse admin-configured warehouse signature slots. warehouse_receiver defaults to received. */
export function parseWarehouseSigSections(raw: unknown, role?: unknown): WarehouseSigSlot[] {
  const allowed = new Set<string>(WAREHOUSE_SIG_SLOTS);
  const parts = String(raw || "")
    .toLowerCase()
    .split(/[,+|/\s]+/)
    .map((s) => s.trim())
    .filter((s) => allowed.has(s)) as WarehouseSigSlot[];
  const unique = [...new Set(parts)];
  if (unique.length) return unique;
  if (normalizeRole(role) === "warehouse_receiver") return ["received"];
  return [];
}

/** Editor/Admin with warehouse (or all) in Department = full GIN desk, not assigned-only signer. */
export function deptHasWarehouseAccess(dept: unknown): boolean {
  const d = normalizeDeptField(dept);
  if (!d) return false;
  if (d === "all") return true;
  return d.split(",").map((x) => x.trim()).filter(Boolean).includes("warehouse");
}

export function isWarehouseStaff(
  role: unknown,
  dept: unknown,
  moduleAccess?: unknown,
): boolean {
  const access = parseModuleAccess(moduleAccess);
  if (moduleAccessHasAny_(access)) {
    return warehouseGinWrite_(access);
  }
  const r = normalizeRole(role);
  if (r !== "admin" && r !== "editor") return false;
  return deptHasWarehouseAccess(dept);
}

export function isWarehouseSigner(
  role: unknown,
  warehouseSigSections: unknown,
  dept?: unknown,
  moduleAccess?: unknown,
): boolean {
  const access = parseModuleAccess(moduleAccess);
  if (moduleAccessHasAny_(access)) {
    if (warehouseStaffNav_(access)) return false;
    return (
      moduleLevel(access, "warehouse_assigned") !== "none" ||
      moduleLevel(access, "warehouse_done") !== "none" ||
      moduleLevel(access, "warehouse_sig_auth") !== "none" ||
      moduleLevel(access, "warehouse_sig_issued") !== "none" ||
      moduleLevel(access, "warehouse_sig_received") !== "none"
    );
  }
  const r = normalizeRole(role);
  if (r === "warehouse_receiver") return true;
  // Full warehouse desk users must never get the locked "Assigned to me" shell.
  if (dept != null && String(dept).trim() !== "" && isWarehouseStaff(r, dept)) return false;
  return parseWarehouseSigSections(warehouseSigSections, role).length > 0;
}

export function isAdminAccount(role: unknown, moduleAccess?: unknown): boolean {
  return normalizeRole(role) === "admin" || moduleLevel(moduleAccess, "admin") === "write";
}

/** Full GIN desk write (not viewer, not assigned-only signer). */
export function canWriteWarehouseDesk(
  role: unknown,
  dept: unknown,
  moduleAccess?: unknown,
  warehouseSigSections?: unknown,
): boolean {
  if (normalizeRole(role) === "viewer") return false;
  if (isWarehouseSigner(role, warehouseSigSections, dept, moduleAccess)) return false;
  if (isAdminAccount(role, moduleAccess)) return true;
  return isWarehouseStaff(role, dept, moduleAccess);
}

export function canWriteWarehouseInvoices(
  role: unknown,
  dept: unknown,
  moduleAccess?: unknown,
  warehouseSigSections?: unknown,
): boolean {
  if (normalizeRole(role) === "viewer") return false;
  if (isWarehouseSigner(role, warehouseSigSections, dept, moduleAccess)) return false;
  if (isAdminAccount(role, moduleAccess)) return true;
  const access = parseModuleAccess(moduleAccess);
  if (warehouseInvoiceWrite_(access)) return true;
  if (moduleAccessHasAny_(access)) return false;
  return isWarehouseStaff(role, dept, moduleAccess);
}

export type AccessLevel = "none" | "read" | "write";

export const MODULE_ACCESS_KEYS = [
  "admin",
  "cleaning",
  "cleaning_dash",
  "cleaning_analytics",
  "cleaning_monthly",
  "cleaning_ec",
  "cleaning_es",
  "cleaning_wd",
  "cleaning_ww",
  "cleaning_ww2",
  "cleaning_ra",
  "civil_department",
  "civil_jobs",
  "civil_field",
  "civil_add",
  "civil_report",
  "civil_analytics",
  "civil_issue",
  "civil_iss_list",
  "civil_iss_add",
  "civil_iss_analytics",
  "civil_iss_not",
  "civil_iss_delay",
  "civil_iss_gps",
  "electrical_department",
  "elec_jobs",
  "elec_field",
  "elec_add",
  "elec_report",
  "elec_analytics",
  "elec_minus",
  "electric_issue",
  "elec_iss_list",
  "elec_iss_add",
  "elec_iss_analytics",
  "elec_iss_not",
  "elec_iss_delay",
  "elec_iss_gps",
  "hse",
  "hse_log",
  "hse_add",
  "hse_monthly",
  "hse_analytics",
  "fire",
  "fire_list",
  "fire_add",
  "fire_analytics",
  "asaas",
  "asaas_list",
  "asaas_analytics",
  "application",
  "app_door",
  "app_summary",
  "app_issues",
  "ups",
  "ups_register",
  "ups_checklist",
  "ups_history",
  "ups_summary",
  "ups_add",
  "charging",
  "charging_dash",
  "charging_summary",
  "charging_waiting",
  "charging_charged",
  "charging_bin",
  "charging_bot",
  "charging_reset",
  "warehouse_desk",
  "warehouse_note",
  "warehouse_saved",
  "warehouse_assigned",
  "warehouse_done",
  "warehouse_sap",
  "warehouse_spusage",
  "warehouse_sigs",
  "warehouse_invoice",
  "warehouse_invoices",
  "warehouse_invsp",
  "warehouse_invamount",
  "warehouse_sig_auth",
  "warehouse_sig_issued",
  "warehouse_sig_received",
  "hr",
  "hr_director",
] as const;

export type ModuleAccessKey = (typeof MODULE_ACCESS_KEYS)[number];
export type ModuleAccessMap = Record<ModuleAccessKey, AccessLevel>;

const MODULE_DEPTS: Record<ModuleAccessKey, string[]> = {
  admin: [],
  cleaning: ["cleaning"],
  cleaning_dash: ["cleaning"],
  cleaning_analytics: ["cleaning"],
  cleaning_monthly: ["cleaning"],
  cleaning_ec: ["cleaning"],
  cleaning_es: ["cleaning"],
  cleaning_wd: ["cleaning"],
  cleaning_ww: ["cleaning"],
  cleaning_ww2: ["cleaning"],
  cleaning_ra: ["cleaning"],
  civil_department: ["civil department"],
  civil_jobs: ["civil department"],
  civil_field: ["civil department"],
  civil_add: ["civil department"],
  civil_report: ["civil department"],
  civil_analytics: ["civil department"],
  civil_issue: ["civil issue"],
  civil_iss_list: ["civil issue"],
  civil_iss_add: ["civil issue"],
  civil_iss_analytics: ["civil issue"],
  civil_iss_not: ["civil issue"],
  civil_iss_delay: ["civil issue"],
  civil_iss_gps: ["civil issue"],
  electrical_department: ["electrical department"],
  elec_jobs: ["electrical department"],
  elec_field: ["electrical department"],
  elec_add: ["electrical department"],
  elec_report: ["electrical department"],
  elec_analytics: ["electrical department"],
  elec_minus: ["electrical department"],
  electric_issue: ["electric issue"],
  elec_iss_list: ["electric issue"],
  elec_iss_add: ["electric issue"],
  elec_iss_analytics: ["electric issue"],
  elec_iss_not: ["electric issue"],
  elec_iss_delay: ["electric issue"],
  elec_iss_gps: ["electric issue"],
  hse: ["hse"],
  hse_log: ["hse"],
  hse_add: ["hse"],
  hse_monthly: ["hse"],
  hse_analytics: ["hse"],
  fire: ["fire"],
  fire_list: ["fire"],
  fire_add: ["fire"],
  fire_analytics: ["fire"],
  asaas: ["asaas"],
  asaas_list: ["asaas"],
  asaas_analytics: ["asaas"],
  application: ["application"],
  app_door: ["application"],
  app_summary: ["application"],
  app_issues: ["application"],
  ups: ["ups"],
  ups_register: ["ups"],
  ups_checklist: ["ups"],
  ups_history: ["ups"],
  ups_summary: ["ups"],
  ups_add: ["ups"],
  charging: ["charging"],
  charging_dash: ["charging"],
  charging_summary: ["charging"],
  charging_waiting: ["charging"],
  charging_charged: ["charging"],
  charging_bin: ["charging"],
  charging_bot: ["charging"],
  charging_reset: ["charging"],
  warehouse_desk: ["warehouse"],
  warehouse_note: ["warehouse"],
  warehouse_saved: ["warehouse"],
  warehouse_assigned: ["warehouse"],
  warehouse_done: ["warehouse"],
  warehouse_sap: ["warehouse"],
  warehouse_spusage: ["warehouse"],
  warehouse_sigs: ["warehouse"],
  warehouse_invoice: ["warehouse"],
  warehouse_invoices: ["warehouse"],
  warehouse_invsp: ["warehouse"],
  warehouse_invamount: ["warehouse"],
  warehouse_sig_auth: ["warehouse"],
  warehouse_sig_issued: ["warehouse"],
  warehouse_sig_received: ["warehouse"],
  hr: ["hr"],
  hr_director: ["hr"],
};

export function emptyModuleAccess(): ModuleAccessMap {
  const out = {} as ModuleAccessMap;
  for (const k of MODULE_ACCESS_KEYS) out[k] = "none";
  return out;
}

export function normalizeAccessLevel(raw: unknown): AccessLevel {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "read" || s === "r" || s === "view" || s === "viewer") return "read";
  if (s === "write" || s === "rw" || s === "edit" || s === "editor" || s === "full") return "write";
  return "none";
}

export const CHARGING_SECTION_KEYS = [
  "charging_dash",
  "charging_summary",
  "charging_waiting",
  "charging_charged",
  "charging_bin",
  "charging_bot",
  "charging_reset",
] as const;

type SectionFoldGroup = {
  parent: ModuleAccessKey;
  children: ModuleAccessKey[];
  skipOnLegacy?: ModuleAccessKey[];
  writeOnlyOnLegacy?: ModuleAccessKey[];
  stickyParent?: boolean;
};

const SECTION_FOLD_GROUPS: SectionFoldGroup[] = [
  {
    parent: "cleaning",
    children: [
      "cleaning_dash", "cleaning_analytics", "cleaning_monthly",
      "cleaning_ec", "cleaning_es", "cleaning_wd", "cleaning_ww", "cleaning_ww2", "cleaning_ra",
    ],
  },
  {
    parent: "civil_department",
    children: ["civil_jobs", "civil_field", "civil_add", "civil_report", "civil_analytics"],
  },
  {
    parent: "civil_issue",
    children: [
      "civil_iss_list", "civil_iss_add", "civil_iss_analytics",
      "civil_iss_not", "civil_iss_delay", "civil_iss_gps",
    ],
  },
  {
    parent: "electrical_department",
    children: ["elec_jobs", "elec_field", "elec_add", "elec_report", "elec_analytics", "elec_minus"],
  },
  {
    parent: "electric_issue",
    children: [
      "elec_iss_list", "elec_iss_add", "elec_iss_analytics",
      "elec_iss_not", "elec_iss_delay", "elec_iss_gps",
    ],
  },
  { parent: "hse", children: ["hse_log", "hse_add", "hse_monthly", "hse_analytics"] },
  { parent: "fire", children: ["fire_list", "fire_add", "fire_analytics"] },
  { parent: "asaas", children: ["asaas_list", "asaas_analytics"] },
  { parent: "application", children: ["app_door", "app_summary", "app_issues"] },
  { parent: "ups", children: ["ups_register", "ups_checklist", "ups_history", "ups_summary", "ups_add"] },
  {
    parent: "charging",
    children: [
      "charging_dash", "charging_summary", "charging_waiting", "charging_charged",
      "charging_bin", "charging_bot", "charging_reset",
    ],
    skipOnLegacy: ["charging_bot"],
    writeOnlyOnLegacy: ["charging_bin", "charging_reset"],
  },
  {
    parent: "warehouse_desk",
    children: [
      "warehouse_note", "warehouse_saved", "warehouse_sap", "warehouse_spusage",
      "warehouse_sigs",
    ],
  },
  {
    parent: "warehouse_invoices",
    children: ["warehouse_invoice", "warehouse_invsp", "warehouse_invamount"],
    stickyParent: true,
  },
];

const WAREHOUSE_GIN_KEYS: ModuleAccessKey[] = [
  "warehouse_note", "warehouse_saved", "warehouse_sap", "warehouse_spusage", "warehouse_sigs",
];
const WAREHOUSE_INV_KEYS: ModuleAccessKey[] = [
  "warehouse_invoice", "warehouse_invoices", "warehouse_invsp", "warehouse_invamount",
];

function warehouseAnyWrite_(a: ModuleAccessMap, keys: ModuleAccessKey[]): boolean {
  return keys.some((k) => a[k] === "write");
}
function warehouseAnyAccess_(a: ModuleAccessMap, keys: ModuleAccessKey[]): boolean {
  return keys.some((k) => a[k] !== "none");
}
function warehouseGinWrite_(a: ModuleAccessMap): boolean {
  return warehouseAnyWrite_(a, WAREHOUSE_GIN_KEYS);
}
function warehouseInvoiceWrite_(a: ModuleAccessMap): boolean {
  return warehouseAnyWrite_(a, WAREHOUSE_INV_KEYS);
}
function warehouseStaffNav_(a: ModuleAccessMap): boolean {
  return warehouseAnyAccess_(a, WAREHOUSE_GIN_KEYS) || warehouseAnyAccess_(a, WAREHOUSE_INV_KEYS);
}

const CLEANING_PROJECT_KEYS: Record<string, ModuleAccessKey> = {
  ec: "cleaning_ec",
  es: "cleaning_es",
  wd: "cleaning_wd",
  ww: "cleaning_ww",
  ww2: "cleaning_ww2",
  ra: "cleaning_ra",
};

export function maxAccessLevel(...levels: AccessLevel[]): AccessLevel {
  if (levels.some((l) => l === "write")) return "write";
  if (levels.some((l) => l === "read")) return "read";
  return "none";
}

/** Expand legacy parent keys into sections, and keep each parent as the max of its children. */
export function foldModuleSectionAccess(a: ModuleAccessMap): ModuleAccessMap {
  for (const g of SECTION_FOLD_GROUPS) {
    const anyChild = g.children.some((k) => a[k] !== "none");
    if (!anyChild && a[g.parent] !== "none") {
      const lvl = a[g.parent];
      for (const k of g.children) {
        if (g.skipOnLegacy && g.skipOnLegacy.indexOf(k) !== -1) continue;
        if (g.writeOnlyOnLegacy && g.writeOnlyOnLegacy.indexOf(k) !== -1) {
          if (lvl === "write") a[k] = "write";
          continue;
        }
        a[k] = lvl;
      }
    }
    if (!g.stickyParent) {
      a[g.parent] = maxAccessLevel(a[g.parent], ...g.children.map((k) => a[k]));
    }
  }
  return a;
}

export function foldChargingAccess(a: ModuleAccessMap): ModuleAccessMap {
  return foldModuleSectionAccess(a);
}

/** If the user is scoped to some cleaning projects, drop the other project sections. */
export function applyCleaningProjectScopeToAccess(
  a: ModuleAccessMap,
  projectsField: unknown,
): ModuleAccessMap {
  const scoped = normalizeProjectsField(projectsField, "cleaning");
  if (!scoped.length) return a;
  const anyProj = Object.keys(CLEANING_PROJECT_KEYS).some((code) => a[CLEANING_PROJECT_KEYS[code]] !== "none");
  if (!anyProj) return a;
  for (const code of Object.keys(CLEANING_PROJECT_KEYS)) {
    if (scoped.indexOf(code) === -1) a[CLEANING_PROJECT_KEYS[code]] = "none";
  }
  a.cleaning = maxAccessLevel(
    a.cleaning_dash,
    a.cleaning_analytics,
    a.cleaning_monthly,
    a.cleaning_ec,
    a.cleaning_es,
    a.cleaning_wd,
    a.cleaning_ww,
    a.cleaning_ww2,
    a.cleaning_ra,
  );
  return a;
}

export function parseModuleAccess(raw: unknown): ModuleAccessMap {
  const out = emptyModuleAccess();
  if (!raw) return foldModuleSectionAccess(out);
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw || "{}");
    } catch (_e) {
      return foldModuleSectionAccess(out);
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return foldModuleSectionAccess(out);
  }
  for (const k of MODULE_ACCESS_KEYS) {
    if (obj[k] != null) out[k] = normalizeAccessLevel(obj[k]);
  }
  return foldModuleSectionAccess(out);
}

function moduleAccessHasAny_(access: ModuleAccessMap): boolean {
  return MODULE_ACCESS_KEYS.some((k) => access[k] !== "none");
}

export function moduleLevel(access: unknown, key: ModuleAccessKey): AccessLevel {
  return parseModuleAccess(access)[key] || "none";
}

export function moduleAccessToJson(access: ModuleAccessMap): Record<string, AccessLevel> {
  const a = parseModuleAccess(access);
  const out: Record<string, AccessLevel> = {};
  for (const k of MODULE_ACCESS_KEYS) {
    if (a[k] !== "none") out[k] = a[k];
  }
  return out;
}

/** Build matrix from legacy role + dept + signer slots (for users not yet migrated). */
export function synthesizeModuleAccessFromLegacy(
  role: unknown,
  dept: unknown,
  warehouseSigSections: unknown,
): ModuleAccessMap {
  const a = emptyModuleAccess();
  const r = normalizeRole(role);
  const d = normalizeDeptField(dept);
  const sections = parseWarehouseSigSections(warehouseSigSections, role);
  const writeLevel: AccessLevel = (r === "viewer") ? "read" : "write";

  const grantDeptToken = (token: string, level: AccessLevel) => {
    const t = token.trim().toLowerCase();
    if (!t) return;
    if (t === "all") {
      for (const k of MODULE_ACCESS_KEYS) {
        if (k === "admin") continue;
        if (a[k] === "none") a[k] = level;
      }
      return;
    }
    if (t === "cleaning") a.cleaning = level;
    else if (t === "civil department") a.civil_department = level;
    else if (t === "civil issue") a.civil_issue = level;
    else if (t === "electrical department" || t === "electrical") a.electrical_department = level;
    else if (t === "electric issue") a.electric_issue = level;
    else if (t === "hse") a.hse = level;
    else if (t === "fire") a.fire = level;
    else if (t === "asaas") a.asaas = level;
    else if (t === "application") a.application = level;
    else if (t === "ups") a.ups = level;
    else if (t === "charging" || t === "charging electricity") {
      a.charging = level;
      a.charging_dash = level;
      a.charging_summary = level;
      a.charging_waiting = level;
      a.charging_charged = level;
      if (level === "write") {
        a.charging_bin = "write";
        a.charging_reset = "write";
      }
    }
    else if (t === "hr" || t === "hr department") a.hr = level;
    else if (t === "warehouse") {
      /* handled below for desk vs signer */
    }
  };

  if (r === "admin") a.admin = "write";

  if (d === "all") {
    grantDeptToken("all", writeLevel);
  } else if (d) {
    for (const part of d.split(",")) grantDeptToken(part, writeLevel);
  }

  const deskByLegacy = (r === "admin" || r === "editor") && deptHasWarehouseAccess(d);
  if (deskByLegacy) {
    a.warehouse_desk = "write";
    a.warehouse_assigned = "write";
    a.warehouse_done = "write";
    a.warehouse_invoices = "write";
  } else if (r === "warehouse_receiver" || sections.length) {
    a.warehouse_assigned = "write";
    a.warehouse_done = "write";
    const slots = sections.length ? sections : (["received"] as WarehouseSigSlot[]);
    for (const s of slots) {
      if (s === "auth") a.warehouse_sig_auth = "write";
      if (s === "issued") a.warehouse_sig_issued = "write";
      if (s === "received") a.warehouse_sig_received = "write";
    }
  }

  if (r === "worker") {
    if (deptListAllows(d, "civil issue") || d.includes("civil issue")) a.civil_issue = "write";
    if (deptListAllows(d, "electric issue") || d.includes("electric issue")) a.electric_issue = "write";
  }
  if (r === "cleaning_supervisor") a.cleaning = "write";

  return foldChargingAccess(a);
}

export function resolveModuleAccessForUser(user: Record<string, unknown>): ModuleAccessMap {
  const parsed = parseModuleAccess(user.module_access);
  if (moduleAccessHasAny_(parsed)) {
    return applyCleaningProjectScopeToAccess(parsed, user.projects);
  }
  const legacy = synthesizeModuleAccessFromLegacy(user.role, user.dept, user.warehouse_sig_sections);
  return applyCleaningProjectScopeToAccess(legacy, user.projects);
}

function accessHasDeskWrite_(a: ModuleAccessMap): boolean {
  return (
    a.cleaning === "write" ||
    a.civil_department === "write" ||
    a.electrical_department === "write" ||
    a.hse === "write" ||
    a.fire === "write" ||
    a.asaas === "write" ||
    a.application === "write" ||
    a.ups === "write" ||
    a.charging === "write" ||
    a.charging_dash === "write" ||
    a.charging_summary === "write" ||
    a.charging_waiting === "write" ||
    a.charging_charged === "write" ||
    a.charging_bin === "write" ||
    a.charging_bot === "write" ||
    a.charging_reset === "write" ||
    a.hr === "write" ||
    a.warehouse_desk === "write" ||
    warehouseGinWrite_(a) ||
    warehouseInvoiceWrite_(a)
  );
}

function accessWorkerOnly_(a: ModuleAccessMap): boolean {
  const mobile = a.civil_issue !== "none" || a.electric_issue !== "none";
  if (!mobile) return false;
  if (a.admin !== "none") return false;
  if (accessHasDeskWrite_(a)) return false;
  if (a.warehouse_assigned !== "none" || a.warehouse_done !== "none") return false;
  if (a.warehouse_sig_auth !== "none" || a.warehouse_sig_issued !== "none" || a.warehouse_sig_received !== "none") {
    return false;
  }
  // Allow read-only desks? treat as not worker-only
  const deskRead =
    a.cleaning !== "none" || a.civil_department !== "none" || a.electrical_department !== "none" ||
    a.hse !== "none" || a.fire !== "none" || a.asaas !== "none" || a.application !== "none" ||
    a.ups !== "none" || a.charging !== "none" || a.charging_dash !== "none" ||
    a.charging_summary !== "none" ||
    a.charging_waiting !== "none" || a.charging_charged !== "none" || a.charging_bin !== "none" ||
    a.charging_bot !== "none" || a.charging_reset !== "none" ||
    a.hr !== "none" || a.hr_director !== "none" ||
    a.warehouse_desk !== "none" || warehouseStaffNav_(a);
  return !deskRead;
}

export function deriveAccountFromModuleAccess(
  accessRaw: unknown,
  opts?: { hide?: unknown },
): {
  role: string;
  dept: string;
  warehouseSigSections: WarehouseSigSlot[];
  moduleAccess: ModuleAccessMap;
  perms: Record<string, boolean>;
} {
  const a = parseModuleAccess(accessRaw);
  const depts = new Set<string>();
  for (const k of MODULE_ACCESS_KEYS) {
    if (a[k] === "none") continue;
    for (const d of MODULE_DEPTS[k]) depts.add(d);
  }
  let dept = [...depts].join(",");

  const sections: WarehouseSigSlot[] = [];
  if (!warehouseGinWrite_(a)) {
    if (a.warehouse_sig_auth !== "none") sections.push("auth");
    if (a.warehouse_sig_issued !== "none") sections.push("issued");
    if (a.warehouse_sig_received !== "none") sections.push("received");
  }

  const anyWrite = MODULE_ACCESS_KEYS.some((k) => a[k] === "write");
  const anyAccess = MODULE_ACCESS_KEYS.some((k) => a[k] !== "none");

  let role = "viewer";
  if (a.admin === "write") {
    role = "admin";
    dept = "all";
  } else if (accessWorkerOnly_(a)) role = "worker";
  else if (
    a.cleaning === "write" &&
    !accessHasDeskWrite_(Object.assign(emptyModuleAccess(), a, { cleaning: "none" })) &&
    a.civil_issue === "none" &&
    a.electric_issue === "none" &&
    a.warehouse_desk === "none" &&
    !warehouseStaffNav_(a) &&
    a.warehouse_assigned === "none"
  ) {
    role = "cleaning_supervisor";
  } else if (
    a.warehouse_desk === "none" &&
    !warehouseStaffNav_(a) &&
    (a.warehouse_assigned !== "none" || a.warehouse_done !== "none" || sections.length) &&
    !accessHasDeskWrite_(a) &&
    a.civil_issue === "none" &&
    a.electric_issue === "none"
  ) {
    role = "warehouse_receiver";
  } else if (anyWrite) role = "editor";
  else if (anyAccess) role = "viewer";
  else role = "editor";

  const signer = !warehouseStaffNav_(a) && (
    sections.length > 0 ||
    role === "warehouse_receiver" ||
    a.warehouse_assigned !== "none" ||
    a.warehouse_done !== "none"
  );
  dept = ensureWarehouseInDept(dept, signer);

  const rp = computePerms(role, opts?.hide);
  if (anyAccess && !anyWrite && role !== "admin") {
    Object.assign(rp.perms, basePermsForRole("viewer"));
  }
  return {
    role,
    dept,
    warehouseSigSections: sections.length
      ? sections
      : (role === "warehouse_receiver" ? ["received"] as WarehouseSigSlot[] : []),
    moduleAccess: a,
    perms: rp.perms,
  };
}

export function warehouseSigSectionsCsv(sections: string[]): string {
  const allowed = new Set<string>(WAREHOUSE_SIG_SLOTS);
  return [...new Set(sections.map((s) => String(s || "").trim().toLowerCase()).filter((s) => allowed.has(s)))]
    .join(",");
}

export function ensureWarehouseInDept(dept: string, isSigner: boolean): string {
  const d = normalizeDeptField(dept);
  if (!isSigner || !d) return d;
  if (d === "all") return d;
  const parts = d.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.includes("warehouse")) return parts.join(",");
  parts.push("warehouse");
  return parts.join(",");
}

export function isCleaningSupervisorRole(role: unknown): boolean {
  return normalizeRole(role) === "cleaning_supervisor";
}

export function isElectricWorkerId(username: string): boolean {
  return !!ELECTRIC_WORKER_TEAM[normalizeWorkerId(username)];
}

export function isCivilWorkerId(username: string): boolean {
  return !!CIVIL_WORKER_TEAM[normalizeWorkerId(username)];
}

export function basePermsForRole(role: string) {
  role = normalizeRole(role);
  if (role === "admin") {
    return {
      view: true, add: true, edit: true, del: true, analytics: true, report: true,
      dashboard: true, reset: true, assign: true, fix: true, categories: true,
      liveLocation: true, jobsTab: true, fieldReports: true, issuesTab: true,
      notElectricTab: true, fixDelayTab: true,
    };
  }
  if (role === "worker") {
    return {
      view: true, add: false, edit: false, del: false, analytics: false, report: false,
      dashboard: true, reset: false, assign: false, fix: true, categories: true,
      liveLocation: false, jobsTab: true, fieldReports: true, issuesTab: true,
      notElectricTab: true, fixDelayTab: true,
    };
  }
  if (role === "viewer" || role === "warehouse_receiver") {
    return {
      view: true, add: false, edit: false, del: false, analytics: true, report: true,
      dashboard: true, reset: false, assign: false, fix: false, categories: true,
      liveLocation: true, jobsTab: true, fieldReports: true, issuesTab: true,
      notElectricTab: true, fixDelayTab: true,
    };
  }
  if (role === "cleaning_supervisor") {
    return {
      view: true, add: true, edit: true, del: false, analytics: true, report: true,
      dashboard: true, reset: false, assign: false, fix: true, categories: false,
      liveLocation: true, jobsTab: false, fieldReports: false, issuesTab: false,
      notElectricTab: false, fixDelayTab: false, mobileOnly: true,
    };
  }
  return {
    view: true, add: true, edit: true, del: true, analytics: true, report: true,
    dashboard: true, reset: false, assign: true, fix: true, categories: true,
    liveLocation: true, jobsTab: true, fieldReports: true, issuesTab: true,
    notElectricTab: true, fixDelayTab: true,
  };
}

export function applyHideTokens(p: Record<string, boolean>, hide: unknown) {
  const raw = String(hide || "").toLowerCase();
  if (!raw) return p;
  const tokens = raw.indexOf(",") === -1 ? [raw] : raw.split(",");
  for (let tok of tokens) {
    tok = String(tok || "").trim();
    if (!tok) continue;
    if (tok.indexOf("add") !== -1) p.add = false;
    if (tok.indexOf("edit") !== -1) p.edit = false;
    if (tok.indexOf("delete") !== -1 || tok.indexOf("del") !== -1) p.del = false;
    if (tok.indexOf("analytic") !== -1) p.analytics = false;
    if (tok.indexOf("report") !== -1 || tok.indexOf("monthly") !== -1) p.report = false;
    if (tok.indexOf("dashboard") !== -1 || tok === "dash") p.dashboard = false;
    if (tok.indexOf("categor") !== -1) p.categories = false;
    if (tok.indexOf("live") !== -1 && tok.indexOf("loc") !== -1) p.liveLocation = false;
    if (tok.indexOf("field report") !== -1) p.fieldReports = false;
    if (tok.indexOf("jobs") !== -1 || tok === "job") p.jobsTab = false;
    if (tok.indexOf("issues") !== -1 || tok === "issue") p.issuesTab = false;
    if (tok.indexOf("not electric") !== -1 || tok.indexOf("not civil") !== -1 || tok.indexOf("not dept") !== -1) {
      p.notElectricTab = false;
    }
    if (tok.indexOf("needs month") !== -1 || tok.indexOf("fix delay") !== -1) p.fixDelayTab = false;
  }
  return p;
}

export function computePerms(role: unknown, hide: unknown) {
  const r = normalizeRole(role);
  const p = applyHideTokens({ ...basePermsForRole(r) }, hide);
  return { role: r, perms: p };
}

export function normalizeProjectsField(raw: unknown, userDept: unknown): string[] {
  const dept = normalizeDeptField(userDept);
  if (dept === "all") return [];
  let s = String(raw || "").trim().toLowerCase();
  if (!s || s === "all") return [];
  const valid: Record<string, number> = { ec: 1, es: 1, wd: 1, ww: 1, ww2: 1, ra: 1 };
  if (s.indexOf(",") === -1) return valid[s] ? [s] : [];
  const out: string[] = [];
  for (const p of s.split(",")) {
    const x = p.trim();
    if (valid[x] && out.indexOf(x) === -1) out.push(x);
  }
  return out;
}

export function issueStatusFromCondition(body: Record<string, unknown>): string {
  const cond = String(body.condition || "").trim().toLowerCase();
  if (cond === "fine" || cond === "okay") return "okay";
  if (cond === "not found" || cond === "missing") return "missing";
  if (cond === "resolved" || cond === "fixed") return "fixed";
  if (
    cond === "need maintenance" || cond === "needs fix" || cond === "needs_fix" ||
    cond === "needsfix"
  ) return "open";
  return String(body.status || "open");
}

export function parseFixedPhotosFromCell(fp: string): string[] {
  fp = String(fp || "").trim();
  if (!fp) return [];
  if (fp.charAt(0) === "[") {
    try {
      const arr = JSON.parse(fp);
      if (Array.isArray(arr)) return arr.map(String).filter((u) => u.indexOf("http") === 0);
    } catch { /* ignore */ }
  }
  if (fp.indexOf("http") === 0) return [fp];
  return [];
}

export function formatFixedPhotosForStorage(urls: string[]): string {
  if (!urls.length) return "";
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}

export function parseAssignVoiceNote(raw: unknown) {
  if (raw && typeof raw === "object" && (raw as { url?: string }).url) return raw;
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.charAt(0) === "{") {
    try {
      const o = JSON.parse(s);
      if (o && o.url) {
        return {
          url: String(o.url || ""),
          by: String(o.by || ""),
          at: String(o.at || ""),
          durationSec: Number(o.durationSec) || 0,
          mimeType: String(o.mimeType || ""),
        };
      }
    } catch { /* ignore */ }
  }
  if (s.indexOf("http") === 0) return { url: s, by: "", at: "", durationSec: 0 };
  return null;
}

export function mergeWorkerCompletionPhotos(completions: Array<{ photos?: string[] }>): string[] {
  const out: string[] = [];
  for (const c of completions || []) {
    for (const p of c.photos || []) {
      if (p && out.indexOf(p) === -1) out.push(p);
    }
  }
  return out;
}

export function workerAssignedToIssue(assignedWorkers: string[], workerUser: string): boolean {
  workerUser = normalizeWorkerId(workerUser);
  return (assignedWorkers || []).map(normalizeWorkerId).includes(workerUser);
}

export function workerAlreadyCompleted(
  completions: Array<{ user?: string }>,
  username: string,
): boolean {
  const u = normalizeWorkerId(username);
  return (completions || []).some((c) => normalizeWorkerId(c.user) === u);
}

export function summaryAllowedForToken(tokenDept: string, section: string, role?: unknown): boolean {
  if (normalizeRole(role) === "admin") return true;
  return deptListAllows(tokenDept, section) || normalizeDeptField(tokenDept) === "all";
}
