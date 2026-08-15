import { AuthOk } from "./auth.ts";
import { sb } from "./db.ts";

const BUCKET = Deno.env.get("SUPABASE_BUCKET") || "empire-photos";

const ALLOWED_EXT = new Set([
  "jpg", "jpeg", "png", "webp", "gif",
  "webm", "ogg", "m4a", "mp3", "wav", "aac",
]);

function safeFolder(folder: unknown): string {
  return String(folder || "misc")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .slice(0, 120) || "misc";
}

function extFrom(body: Record<string, unknown>): string {
  let ext = String(body.ext || body.extension || "").trim().toLowerCase().replace(/^\./, "");
  if (!ext) {
    const ct = String(body.contentType || body.mime || "").toLowerCase();
    if (ct.includes("png")) ext = "png";
    else if (ct.includes("webp")) ext = "webp";
    else if (ct.includes("gif")) ext = "gif";
    else if (ct.includes("webm")) ext = "webm";
    else if (ct.includes("ogg")) ext = "ogg";
    else if (ct.includes("mp4") || ct.includes("m4a")) ext = "m4a";
    else if (ct.includes("mpeg") || ct.includes("mp3")) ext = "mp3";
    else if (ct.includes("wav")) ext = "wav";
    else ext = "jpg";
  }
  if (ext === "jpeg") ext = "jpg";
  return ext;
}

function publicUrlFor(path: string): string {
  const base = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${path.replace(/^\/+/, "")}`;
}

/**
 * Logged-in users get a short-lived signed upload URL (service role).
 * Client PUTs the file to signedUrl; anon INSERT policies can then be removed.
 */
export async function handleGetSignedUpload(body: Record<string, unknown>, auth: AuthOk) {
  if (!auth?.username) {
    return { ok: false, success: false, error: "not_allowed", message: "Login required to upload." };
  }
  const ext = extFrom(body);
  if (!ALLOWED_EXT.has(ext)) {
    return {
      ok: false,
      success: false,
      error: "bad_type",
      message: "File type not allowed.",
    };
  }
  const folder = safeFolder(body.folder);
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const id = crypto.randomUUID();
  const path = `${folder}/${ym}/${id}.${ext}`;

  const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(path, {
    upsert: true,
  });
  if (error || !data?.signedUrl) {
    return {
      ok: false,
      success: false,
      error: "upload_sign_failed",
      message: error?.message || "Could not create upload URL",
    };
  }

  return {
    ok: true,
    success: true,
    path: data.path || path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicUrlFor(data.path || path),
    bucket: BUCKET,
  };
}
