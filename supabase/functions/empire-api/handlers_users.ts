import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { AuthOk } from "./auth.ts";
import { BCRYPT_ROUNDS } from "./config.ts";
import { sb, isoNow } from "./db.ts";
import {
  normalizeDeptField,
  normalizeRole,
  normalizeTrade,
  normalizeWorkerId,
  parseWarehouseSigSections,
  warehouseSigSectionsCsv,
  ensureWarehouseInDept,
  isWarehouseSigner,
  isWarehouseStaff,
  parseModuleAccess,
  resolveModuleAccessForUser,
  deriveAccountFromModuleAccess,
  moduleAccessToJson,
  moduleLevel,
  type ModuleAccessMap,
} from "./helpers.ts";

function moduleAccessHasDirector_(raw: unknown): boolean {
  return moduleLevel(raw, "hr_director") !== "none";
}

async function assertSingleHrDirector(access: ModuleAccessMap, exceptUsername?: string) {
  if (!moduleAccessHasDirector_(access)) return null;
  const { data, error } = await sb().from("users").select("username,module_access");
  if (error) throw error;
  const other = (data || []).find((u) => {
    const name = normalizeWorkerId(u.username);
    if (exceptUsername && name === exceptUsername) return false;
    return moduleAccessHasDirector_(u.module_access);
  });
  if (!other) return null;
  return {
    ok: false as const,
    success: false as const,
    error: "director_taken",
    message: "Only one user can have HR Pending Director. It is already on " + String(other.username) + ".",
  };
}

function isAdminAuth(auth: AuthOk) {
  if (normalizeRole(auth.role) === "admin") return true;
  return moduleLevel(auth.moduleAccess, "admin") === "write";
}

const SIG_MAX_CHARS = 280000;

export function parseUserSignature(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const s = String(raw || "").trim();
  if (!s) return { ok: true, value: "" };
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(s)) {
    return { ok: false, message: "E-signature must be a PNG or JPG image." };
  }
  if (s.length > SIG_MAX_CHARS) {
    return { ok: false, message: "E-signature image is too large." };
  }
  return { ok: true, value: s };
}

function publicUser(row: Record<string, unknown>) {
  const moduleAccess = resolveModuleAccessForUser(row);
  const derived = deriveAccountFromModuleAccess(moduleAccess, { hide: row.hide });
  const role = normalizeRole(row.role || derived.role);
  const warehouseSigSections = parseWarehouseSigSections(
    row.warehouse_sig_sections || derived.warehouseSigSections.join(","),
    role,
  );
  const signature = String(row.signature || "");
  return {
    username: String(row.username || ""),
    dept: String(row.dept || derived.dept || ""),
    role,
    hide: String(row.hide || ""),
    projects: String(row.projects || ""),
    trade: String(row.trade || ""),
    hideElectrical: String(row.hide_electrical || ""),
    warehouseSigSections,
    warehouseSigSectionsRaw: warehouseSigSections.join(","),
    moduleAccess: moduleAccessToJson(moduleAccess),
    hasSignature: !!signature,
    signature,
    updatedAt: String(row.updated_at || ""),
  };
}

function requireAdmin(auth: AuthOk) {
  if (!isAdminAuth(auth)) {
    return {
      ok: false as const,
      success: false as const,
      error: "not_allowed",
      message: "Only an admin can manage users.",
    };
  }
  return null;
}

function validateUsername(raw: unknown) {
  const u = normalizeWorkerId(raw);
  if (!u || u.length < 2) return { ok: false as const, message: "Username must be at least 2 characters." };
  if (!/^[a-z0-9._-]+$/.test(u)) {
    return { ok: false as const, message: "Username may only use letters, numbers, . _ -" };
  }
  return { ok: true as const, username: u };
}

function validateDept(raw: unknown) {
  const d = normalizeDeptField(raw);
  if (!d) return { ok: false as const, message: "Department is required (e.g. civil issue, cleaning, all)." };
  return { ok: true as const, dept: d };
}

function validateRole(raw: unknown) {
  const role = normalizeRole(raw);
  if (!["admin", "editor", "viewer", "worker", "cleaning_supervisor", "warehouse_receiver"].includes(role)) {
    return { ok: false as const, message: "Invalid role." };
  }
  return { ok: true as const, role };
}

function bodyHasModuleAccess(body: Record<string, unknown>) {
  return body.moduleAccess != null || body.module_access != null;
}

function moduleAccessFromBody(body: Record<string, unknown>): ModuleAccessMap {
  return parseModuleAccess(body.moduleAccess != null ? body.moduleAccess : body.module_access);
}

export async function handleListUsers(auth: AuthOk) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  const { data, error } = await sb()
    .from("users")
    .select("username,dept,role,hide,projects,trade,hide_electrical,warehouse_sig_sections,module_access,signature,updated_at")
    .order("username");
  if (error) throw error;
  return { ok: true, users: (data || []).map((r) => publicUser(r as Record<string, unknown>)) };
}

export async function handleCreateUser(body: Record<string, unknown>, auth: AuthOk) {
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const vu = validateUsername(body.username || body.targetUsername);
  if (!vu.ok) return { ok: false, success: false, error: "bad_username", message: vu.message };

  const password = String(body.password || "").trim();
  if (password.length < 4) {
    return { ok: false, success: false, error: "bad_password", message: "Password must be at least 4 characters." };
  }

  let role: string;
  let dept: string;
  let sections: string[];
  let moduleAccessJson: Record<string, string>;

  if (bodyHasModuleAccess(body)) {
    const access = moduleAccessFromBody(body);
    const derived = deriveAccountFromModuleAccess(access, { hide: body.hide });
    role = derived.role;
    dept = derived.dept;
    sections = derived.warehouseSigSections;
    moduleAccessJson = moduleAccessToJson(access);
    if (!dept && role !== "admin") {
      return {
        ok: false,
        success: false,
        error: "bad_access",
        message: "Pick at least one module with Read or Read/Write.",
      };
    }
    if (role === "admin" && !dept) dept = "all";
  } else {
    const vd = validateDept(body.dept);
    if (!vd.ok) return { ok: false, success: false, error: "bad_dept", message: vd.message };
    const vr = validateRole(body.role);
    if (!vr.ok) return { ok: false, success: false, error: "bad_role", message: vr.message };
    role = vr.role;
    dept = vd.dept;
    sections = parseWarehouseSigSections(
      body.warehouseSigSections != null ? body.warehouseSigSections : body.warehouse_sig_sections,
      role,
    );
    if (isWarehouseStaff(role, dept)) sections = [];
    const signer = isWarehouseSigner(role, sections.join(","), dept);
    dept = ensureWarehouseInDept(dept, signer);
    const synthesized = resolveModuleAccessForUser({
      role,
      dept,
      warehouse_sig_sections: warehouseSigSectionsCsv(sections),
      module_access: {},
    });
    moduleAccessJson = moduleAccessToJson(synthesized);
  }

  const directorLock = await assertSingleHrDirector(parseModuleAccess(moduleAccessJson));
  if (directorLock) return directorLock;

  const trade = role === "worker" ? normalizeTrade(body.trade) : "";
  if (role === "worker" && !trade) {
    const d = dept.replace(/\s/g, "");
    if (d !== "asaas") {
      return {
        ok: false,
        success: false,
        error: "trade_required",
        message: "Worker accounts need a trade (plumber, painting, tiles, wood, or electric).",
      };
    }
  }

  const existing = await sb().from("users").select("username").eq("username", vu.username).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    return { ok: false, success: false, error: "exists", message: "That username already exists." };
  }

  const sigIn = parseUserSignature(body.signature);
  if (!sigIn.ok) return { ok: false, success: false, error: "bad_signature", message: sigIn.message };

  const row = {
    username: vu.username,
    password_hash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
    dept,
    role,
    hide: String(body.hide || "").trim(),
    projects: String(body.projects || "").trim().toLowerCase(),
    trade,
    hide_electrical: String(body.hideElectrical || body.hide_electrical || "").trim(),
    warehouse_sig_sections: warehouseSigSectionsCsv(sections),
    module_access: moduleAccessJson,
    signature: sigIn.value,
    updated_at: isoNow(),
  };
  const { error } = await sb().from("users").insert(row);
  if (error) throw error;
  return { ok: true, success: true, user: publicUser(row), message: "User created." };
}

export async function handleUpdateUser(body: Record<string, unknown>, auth: AuthOk) {
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const vu = validateUsername(body.username || body.targetUsername);
  if (!vu.ok) return { ok: false, success: false, error: "bad_username", message: vu.message };

  const { data: existing, error: findErr } = await sb().from("users").select("*").eq("username", vu.username).maybeSingle();
  if (findErr) throw findErr;
  if (!existing) return { ok: false, success: false, error: "not_found", message: "User not found." };

  const patch: Record<string, unknown> = { updated_at: isoNow() };

  if (bodyHasModuleAccess(body)) {
    const access = moduleAccessFromBody(body);
    const derived = deriveAccountFromModuleAccess(access, {
      hide: body.hide != null ? body.hide : existing.hide,
    });
    if (!derived.dept && derived.role !== "admin") {
      return {
        ok: false,
        success: false,
        error: "bad_access",
        message: "Pick at least one module with Read or Read/Write.",
      };
    }
    patch.module_access = moduleAccessToJson(access);
    patch.role = derived.role;
    patch.dept = derived.role === "admin" && !derived.dept ? "all" : derived.dept;
    patch.warehouse_sig_sections = warehouseSigSectionsCsv(derived.warehouseSigSections);
  } else {
    if (body.dept != null) {
      const vd = validateDept(body.dept);
      if (!vd.ok) return { ok: false, success: false, error: "bad_dept", message: vd.message };
      patch.dept = vd.dept;
    }
    if (body.role != null) {
      const vr = validateRole(body.role);
      if (!vr.ok) return { ok: false, success: false, error: "bad_role", message: vr.message };
      patch.role = vr.role;
    }
    if (body.warehouseSigSections != null || body.warehouse_sig_sections != null) {
      const nextRole = normalizeRole(patch.role != null ? patch.role : existing.role);
      const sections = parseWarehouseSigSections(
        body.warehouseSigSections != null ? body.warehouseSigSections : body.warehouse_sig_sections,
        nextRole,
      );
      patch.warehouse_sig_sections = warehouseSigSectionsCsv(sections);
    }
  }

  if (body.hide != null) patch.hide = String(body.hide || "").trim();
  if (body.projects != null) patch.projects = String(body.projects || "").trim().toLowerCase();
  if (body.trade != null || body.role != null || bodyHasModuleAccess(body)) {
    const nextRole = normalizeRole(patch.role != null ? patch.role : existing.role);
    patch.trade = nextRole === "worker"
      ? normalizeTrade(body.trade != null ? body.trade : existing.trade)
      : "";
  }
  if (body.hideElectrical != null || body.hide_electrical != null) {
    patch.hide_electrical = String(body.hideElectrical || body.hide_electrical || "").trim();
  }

  const password = String(body.password || "").trim();
  if (password) {
    if (password.length < 4) {
      return { ok: false, success: false, error: "bad_password", message: "Password must be at least 4 characters." };
    }
    patch.password_hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  }

  if (body.signature !== undefined) {
    const sigIn = parseUserSignature(body.signature);
    if (!sigIn.ok) return { ok: false, success: false, error: "bad_signature", message: sigIn.message };
    patch.signature = sigIn.value;
  }

  const nextRole = normalizeRole(patch.role != null ? patch.role : existing.role);
  if (nextRole === "worker") {
    const trade = String(patch.trade != null ? patch.trade : existing.trade || "");
    const dept = normalizeDeptField(patch.dept != null ? patch.dept : existing.dept).replace(/\s/g, "");
    if (!trade && dept !== "asaas") {
      return {
        ok: false,
        success: false,
        error: "trade_required",
        message: "Worker accounts need a trade (plumber, painting, tiles, wood, or electric).",
      };
    }
  }

  if (!bodyHasModuleAccess(body)) {
    let sections = parseWarehouseSigSections(
      patch.warehouse_sig_sections != null ? patch.warehouse_sig_sections : existing.warehouse_sig_sections,
      nextRole,
    );
    const baseDept = String(patch.dept != null ? patch.dept : existing.dept || "");
    const nextAccess = resolveModuleAccessForUser({
      ...existing,
      ...patch,
      warehouse_sig_sections: warehouseSigSectionsCsv(sections),
    });
    if (isWarehouseStaff(nextRole, baseDept, nextAccess)) {
      sections = [];
      patch.warehouse_sig_sections = "";
    }
    const signer = isWarehouseSigner(nextRole, sections.join(","), baseDept, nextAccess);
    patch.dept = ensureWarehouseInDept(baseDept, signer);
    patch.module_access = moduleAccessToJson(nextAccess);
  }

  // Don't demote yourself out of admin (lock-out protection)
  const selfAdmin =
    moduleLevel(auth.moduleAccess, "admin") === "write" || normalizeRole(auth.role) === "admin";
  if (vu.username === normalizeWorkerId(auth.username) && selfAdmin) {
    const nextAccess = parseModuleAccess(patch.module_access != null ? patch.module_access : existing.module_access);
    const nextIsAdmin = nextRole === "admin" || moduleLevel(nextAccess, "admin") === "write";
    if (!nextIsAdmin) {
      return {
        ok: false,
        success: false,
        error: "not_allowed",
        message: "You cannot remove admin from your own account.",
      };
    }
  }

  const nextAccessForDirector = parseModuleAccess(
    patch.module_access != null ? patch.module_access : existing.module_access,
  );
  const directorLock = await assertSingleHrDirector(nextAccessForDirector, vu.username);
  if (directorLock) return directorLock;

  const { error } = await sb().from("users").update(patch).eq("username", vu.username);
  if (error) throw error;

  if (password) {
    await sb().from("sessions").delete().eq("username", vu.username);
  }

  const { data: updated } = await sb().from("users").select("*").eq("username", vu.username).maybeSingle();
  return {
    ok: true,
    success: true,
    user: publicUser((updated || { ...existing, ...patch }) as Record<string, unknown>),
    message: password ? "User updated. Their sessions were signed out." : "User updated.",
  };
}

export async function handleDeleteUser(body: Record<string, unknown>, auth: AuthOk) {
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const vu = validateUsername(body.username || body.targetUsername);
  if (!vu.ok) return { ok: false, success: false, error: "bad_username", message: vu.message };

  if (vu.username === normalizeWorkerId(auth.username)) {
    return { ok: false, success: false, error: "not_allowed", message: "You cannot delete your own account." };
  }

  const { data: existing, error: findErr } = await sb().from("users").select("username,role,module_access").eq("username", vu.username).maybeSingle();
  if (findErr) throw findErr;
  if (!existing) return { ok: false, success: false, error: "not_found", message: "User not found." };

  const targetIsAdmin =
    normalizeRole(existing.role) === "admin" ||
    moduleLevel(existing.module_access, "admin") === "write";
  if (targetIsAdmin) {
    const { data: users, error: aErr } = await sb().from("users").select("username,role,module_access");
    if (aErr) throw aErr;
    const admins = (users || []).filter((u) =>
      normalizeRole(u.role) === "admin" || moduleLevel(u.module_access, "admin") === "write"
    );
    if (admins.length <= 1) {
      return { ok: false, success: false, error: "not_allowed", message: "Cannot delete the last admin account." };
    }
  }

  await sb().from("sessions").delete().eq("username", vu.username);
  const { error } = await sb().from("users").delete().eq("username", vu.username);
  if (error) throw error;
  return { ok: true, success: true, message: "User deleted." };
}
