import { CIVIL_WORKER_TEAM, ELECTRIC_WORKER_TEAM } from "./config.ts";

export function normalizeRole(role: unknown): string {
  const r = String(role || "").trim().toLowerCase();
  if (r === "engineer") return "editor";
  if (r === "cleaning supervisor" || r === "cleaning-supervisor" || r === "supervisor") {
    return "cleaning_supervisor";
  }
  if (["admin", "viewer", "editor", "worker", "cleaning_supervisor"].includes(r)) return r;
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
  if (role === "viewer") {
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

export function summaryAllowedForToken(tokenDept: string, section: string): boolean {
  return deptListAllows(tokenDept, section) || normalizeDeptField(tokenDept) === "all";
}
