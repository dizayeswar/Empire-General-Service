import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let _sb: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (_sb) return _sb;
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _sb;
}

export async function nextCounter(key: string): Promise<number> {
  const client = sb();
  const { data, error } = await client.rpc("next_id_counter", { p_key: key });
  if (error) throw error;
  return Number(data) || 0;
}

export async function trashRows(
  sourceSheet: string,
  rows: unknown[],
  reason: string,
  username: string,
): Promise<string> {
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = rows.map((row) => ({
    trash_id: crypto.randomUUID(),
    source_sheet: sourceSheet,
    row_json: row,
    deleted_by: username || "",
    deleted_at: now,
    reason: reason || "delete",
    batch_id: batchId,
  }));
  if (!payload.length) return batchId;
  const { error } = await sb().from("trash").insert(payload);
  if (error) throw error;
  return batchId;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function fmtDate(v: unknown): string {
  const t = String(v ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

export function dtIssue(v: unknown): string {
  const t = String(v ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      const z = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
    }
  }
  return t;
}
