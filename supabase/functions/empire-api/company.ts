// E2 / E3: two companies in one system.
// Each request runs "inside" one company. HR code asks currentCompany() instead of
// passing the company through every function. Anything that is not HR stays E2.
import { AsyncLocalStorage } from "node:async_hooks";
import { isAdminAccount } from "./helpers.ts";

export type Company = "E2" | "E3";
export const ALL_COMPANIES: Company[] = ["E2", "E3"];

const store = new AsyncLocalStorage<Company>();

export function normCompany(raw: unknown): Company | "" {
  const s = String(raw ?? "").trim().toUpperCase();
  return s === "E2" || s === "E3" ? s : "";
}

/** Companies an account may open. Admins get both. Empty = E2 only (every old account). */
export function companiesForUser(
  rawCompanies: unknown,
  role: unknown,
  moduleAccess?: unknown,
): Company[] {
  if (isAdminAccount(role, moduleAccess)) return ALL_COMPANIES.slice();
  const out: Company[] = [];
  for (const part of String(rawCompanies ?? "").split(/[\s,;|]+/)) {
    const c = normCompany(part);
    if (c && out.indexOf(c) === -1) out.push(c);
  }
  if (!out.length) out.push("E2");
  return ALL_COMPANIES.filter((c) => out.indexOf(c) !== -1);
}

/** Saved form for users.companies: "E2", "E3" or "E2,E3". */
export function companiesToText(raw: unknown): string {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,;|]+/);
  const picked = ALL_COMPANIES.filter((c) => list.some((x) => normCompany(x) === c));
  return (picked.length ? picked : ["E2"]).join(",");
}

/** The company this request works in: the one asked for if allowed, else the account's first. */
export function pickCompany(requested: unknown, allowed: Company[] | undefined): Company {
  const list = allowed && allowed.length ? allowed : (["E2"] as Company[]);
  const want = normCompany(requested);
  if (want && list.indexOf(want) !== -1) return want;
  return list[0];
}

export function runWithCompany<T>(company: Company, fn: () => Promise<T>): Promise<T> {
  return store.run(company, fn);
}

export function currentCompany(): Company {
  return store.getStore() === "E3" ? "E3" : "E2";
}

/** ui_settings key for this company. E2 keeps the old key so nothing moves. */
export function companyKey(base: string): string {
  return currentCompany() === "E2" ? base : base + "_e3";
}
