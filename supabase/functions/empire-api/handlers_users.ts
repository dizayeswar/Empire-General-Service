import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { AuthOk } from "./auth.ts";
import { sb, isoNow } from "./db.ts";
import {
  normalizeDeptField,
  normalizeRole,
  normalizeTrade,
  normalizeWorkerId,
} from "./helpers.ts";

const BCRYPT_ROUNDS = 10;

function publicUser(row: Record<string, unknown>) {
  return {
    username: String(row.username || ""),
    dept: String(row.dept || ""),
    role: normalizeRole(row.role),
    hide: String(row.hide || ""),
    projects: String(row.projects || ""),
    trade: String(row.trade || ""),
    hideElectrical: String(row.hide_electrical || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function requireAdmin(auth: AuthOk) {
  if (normalizeRole(auth.role) !== "admin") {
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
  if (!["admin", "editor", "viewer", "worker", "cleaning_supervisor"].includes(role)) {
    return { ok: false as const, message: "Invalid role." };
  }
  return { ok: true as const, role };
}

export async function handleListUsers(auth: AuthOk) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  const { data, error } = await sb()
    .from("users")
    .select("username,dept,role,hide,projects,trade,hide_electrical,updated_at")
    .order("username");
  if (error) throw error;
  return { ok: true, users: (data || []).map((r) => publicUser(r as Record<string, unknown>)) };
}

export async function handleCreateUser(body: Record<string, unknown>, auth: AuthOk) {
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const vu = validateUsername(body.username || body.targetUsername);
  if (!vu.ok) return { ok: false, success: false, error: "bad_username", message: vu.message };
  const vd = validateDept(body.dept);
  if (!vd.ok) return { ok: false, success: false, error: "bad_dept", message: vd.message };
  const vr = validateRole(body.role);
  if (!vr.ok) return { ok: false, success: false, error: "bad_role", message: vr.message };

  const password = String(body.password || "").trim();
  if (password.length < 4) {
    return { ok: false, success: false, error: "bad_password", message: "Password must be at least 4 characters." };
  }

  const role = vr.role;
  const trade = role === "worker" ? normalizeTrade(body.trade) : "";
  if (role === "worker" && !trade) {
    const dept = vd.dept.replace(/\s/g, "");
    if (dept !== "asaas") {
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

  const row = {
    username: vu.username,
    password_hash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
    dept: vd.dept,
    role,
    hide: String(body.hide || "").trim(),
    projects: String(body.projects || "").trim().toLowerCase(),
    trade,
    hide_electrical: String(body.hideElectrical || body.hide_electrical || "").trim(),
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
  if (body.hide != null) patch.hide = String(body.hide || "").trim();
  if (body.projects != null) patch.projects = String(body.projects || "").trim().toLowerCase();
  if (body.trade != null || body.role != null) {
    const nextRole = normalizeRole(patch.role != null ? patch.role : existing.role);
    patch.trade = nextRole === "worker" ? normalizeTrade(body.trade != null ? body.trade : existing.trade) : "";
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

  // Don't demote yourself out of admin (lock-out protection)
  if (vu.username === normalizeWorkerId(auth.username) && nextRole !== "admin") {
    return {
      ok: false,
      success: false,
      error: "not_allowed",
      message: "You cannot remove admin from your own account.",
    };
  }

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

  const { data: existing, error: findErr } = await sb().from("users").select("username,role").eq("username", vu.username).maybeSingle();
  if (findErr) throw findErr;
  if (!existing) return { ok: false, success: false, error: "not_found", message: "User not found." };

  if (normalizeRole(existing.role) === "admin") {
    const { data: admins, error: aErr } = await sb().from("users").select("username").eq("role", "admin");
    if (aErr) throw aErr;
    if ((admins || []).length <= 1) {
      return { ok: false, success: false, error: "not_allowed", message: "Cannot delete the last admin account." };
    }
  }

  await sb().from("sessions").delete().eq("username", vu.username);
  const { error } = await sb().from("users").delete().eq("username", vu.username);
  if (error) throw error;
  return { ok: true, success: true, message: "User deleted." };
}
