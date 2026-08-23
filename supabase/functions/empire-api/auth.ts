import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { TOKEN_TTL_MS } from "./config.ts";
import { sb, isoNow } from "./db.ts";
import {
  applyHideTokens,
  computePerms,
  deptListAllows,
  isCleaningSupervisorRole,
  normalizeDeptField,
  normalizeProjectsField,
  normalizeRole,
  normalizeTrade,
  normalizeWorkerId,
  tokenDeptAllows,
  parseWarehouseSigSections,
  isWarehouseSigner,
  resolveModuleAccessForUser,
  deriveAccountFromModuleAccess,
  moduleAccessToJson,
  type ModuleAccessMap,
} from "./helpers.ts";

export type AuthOk = {
  ok: true;
  username: string;
  dept: string;
  role: string;
  trade: string;
  perms?: Record<string, boolean>;
  warehouseSigSections?: string[];
  moduleAccess?: ModuleAccessMap;
};

export type AuthFail = { ok: false; error: string; message?: string; success?: false };

export async function getUser(username: string) {
  const u = normalizeWorkerId(username);
  const { data, error } = await sb().from("users").select("*").eq("username", u).maybeSingle();
  if (error) throw error;
  return data;
}

export function projectsForUser(user: Record<string, unknown> | null): string[] {
  if (!user) return [];
  return normalizeProjectsField(user.projects, user.dept);
}

export function tradeForUser(user: Record<string, unknown> | null): string {
  if (!user) return "";
  return normalizeTrade(user.trade);
}

export async function projectAllowedForUser(username: string, project: unknown): Promise<boolean> {
  const user = await getUser(username);
  const projects = projectsForUser(user);
  if (!projects.length) return true;
  return projects.indexOf(String(project || "").trim().toLowerCase()) !== -1;
}

export async function verifyPassword(body: Record<string, unknown>) {
  const username = normalizeWorkerId(body.username);
  const password = String(body.password || "").trim();
  const user = await getUser(username);
  if (!user) {
    return { ok: false, success: false, error: "bad_password", message: "Wrong password." };
  }
  const hash = String(user.password_hash || "");
  if (!hash || !bcrypt.compareSync(password, hash)) {
    return { ok: false, success: false, error: "bad_password", message: "Wrong password." };
  }
  return { ok: true, success: true };
}

export async function handleLogin(body: Record<string, unknown>) {
  const username = normalizeWorkerId(body.username);
  const password = String(body.password || "").trim();
  let requestedDept = normalizeDeptField(body.dept);
  const autoLogin = requestedDept === "auto" || requestedDept === "home";
  if (!requestedDept && !autoLogin) requestedDept = "cleaning";

  const user = await getUser(username);
  if (!user) {
    return {
      ok: false,
      success: false,
      message: "Invalid username or password",
      error: "Invalid username, password, or department",
    };
  }
  const hash = String(user.password_hash || "");
  const passOk = !!hash && bcrypt.compareSync(password, hash);
  if (!passOk) {
    return {
      ok: false,
      success: false,
      message: "Invalid username or password",
      error: "Invalid username, password, or department",
    };
  }

  const access = resolveModuleAccessForUser(user as Record<string, unknown>);
  const derived = deriveAccountFromModuleAccess(access, { hide: user.hide });
  const userDept = normalizeDeptField(derived.dept || user.dept);
  if (!userDept) {
    return {
      ok: false,
      success: false,
      message:
        'No module access set for this user. In Admin → Users, set Read or Read/Write on at least one module.',
      error: "department_not_set",
    };
  }
  if (!autoLogin && !deptListAllows(userDept, requestedDept)) {
    return {
      ok: false,
      success: false,
      message: "This login is not allowed for this section",
      error: "This login is not allowed for this section",
    };
  }

  const rp = { role: derived.role, perms: derived.perms };
  const projects = projectsForUser({ ...user, dept: userDept });
  const trade = tradeForUser(user);
  if (rp.role === "worker" && !trade) {
    if (!deptListAllows(userDept, "asaas") || String(userDept || "").replace(/\s/g, "") !== "asaas") {
      return {
        ok: false,
        success: false,
        message: "Worker account needs a trade (plumber, painting, tiles, wood, or electric).",
        error: "trade_not_set",
      };
    }
  }

  const token = crypto.randomUUID();
  const { error } = await sb().from("sessions").insert({
    token,
    username,
    dept: userDept,
    created_at: Date.now(),
    role: rp.role,
    pw_digest: "",
  });
  if (error) throw error;

  const electricalHide = String(user.hide_electrical || "");
  const electricalPerms = { ...rp.perms };
  applyHideTokens(electricalPerms, electricalHide);

  const loginFcm = String(body.fcmToken || body.pushToken || "").trim();
  if (loginFcm && (rp.role === "worker" || isCleaningSupervisorRole(rp.role))) {
    await sb().from("worker_push_tokens").upsert({
      username,
      fcm_token: loginFcm,
      platform: String(body.platform || "web-fcm"),
      updated_at: isoNow(),
    });
  }

  return {
    ok: true,
    success: true,
    token,
    username,
    dept: userDept,
    role: rp.role,
    perms: rp.perms,
    electricalHide,
    electricalPerms,
    projects,
    trade,
    warehouseSigSections: derived.warehouseSigSections.length
      ? derived.warehouseSigSections
      : parseWarehouseSigSections(user.warehouse_sig_sections, rp.role),
    moduleAccess: moduleAccessToJson(access),
    message: "Login successful",
  };
}

export async function handleGetPerms(body: Record<string, unknown>) {
  if (!body.token) return { ok: false, error: "No token" };
  const sess = await verifyTokenSession(String(body.token));
  if (!sess.ok) return sess;
  const user = await getUser(sess.username);
  if (!user) return { ok: false, error: "User not found" };
  const access = resolveModuleAccessForUser(user as Record<string, unknown>);
  const derived = deriveAccountFromModuleAccess(access, { hide: user.hide });
  const electricalHide = String(user.hide_electrical || "");
  const electricalPerms = { ...derived.perms };
  applyHideTokens(electricalPerms, electricalHide);
  return {
    ok: true,
    role: derived.role,
    dept: normalizeDeptField(derived.dept || user.dept),
    perms: derived.perms,
    electricalHide,
    electricalPerms,
    projects: projectsForUser({ ...user, dept: derived.dept }),
    trade: tradeForUser(user),
    warehouseSigSections: derived.warehouseSigSections.length
      ? derived.warehouseSigSections
      : parseWarehouseSigSections(user.warehouse_sig_sections, derived.role),
    moduleAccess: moduleAccessToJson(access),
  };
}

export async function verifyTokenSession(token: string): Promise<AuthOk | AuthFail> {
  if (!token) return { ok: false, error: "No token" };
  const { data, error } = await sb().from("sessions").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Invalid token" };
  if (Date.now() - Number(data.created_at) > TOKEN_TTL_MS) {
    return { ok: false, error: "Token expired" };
  }
  const user = await getUser(data.username);
  const access = user ? resolveModuleAccessForUser(user as Record<string, unknown>) : undefined;
  const derived = access
    ? deriveAccountFromModuleAccess(access, { hide: user?.hide })
    : null;
  return {
    ok: true,
    username: normalizeWorkerId(data.username),
    dept: normalizeDeptField(derived?.dept || data.dept),
    role: normalizeRole(derived?.role || data.role || user?.role),
    trade: tradeForUser(user),
    warehouseSigSections: derived?.warehouseSigSections?.length
      ? derived.warehouseSigSections
      : parseWarehouseSigSections(user?.warehouse_sig_sections, data.role || user?.role),
    moduleAccess: access,
    perms: derived?.perms,
  };
}

export async function verifyToken(
  token: string,
  requiredDept: string,
): Promise<AuthOk | AuthFail> {
  const sess = await verifyTokenSession(token);
  if (!sess.ok) return sess;
  if (
    requiredDept &&
    !tokenDeptAllows(sess.dept, requiredDept) &&
    normalizeRole(sess.role) !== "admin"
  ) {
    return { ok: false, error: "This login is not allowed for this section" };
  }
  return sess;
}

export async function enrichAuthRole(auth: AuthOk): Promise<AuthOk> {
  const user = await getUser(auth.username);
  if (user) {
    const access = resolveModuleAccessForUser(user as Record<string, unknown>);
    const derived = deriveAccountFromModuleAccess(access, { hide: user.hide });
    auth.role = derived.role;
    auth.dept = normalizeDeptField(derived.dept || auth.dept);
    auth.trade = tradeForUser(user);
    auth.warehouseSigSections = derived.warehouseSigSections.length
      ? derived.warehouseSigSections
      : parseWarehouseSigSections(user.warehouse_sig_sections, auth.role);
    auth.moduleAccess = access;
    auth.perms = derived.perms;
  }
  return auth;
}
