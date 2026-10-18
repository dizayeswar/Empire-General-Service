import webpush from "npm:web-push@3.6.7";
import { sb } from "./db.ts";
import { normalizeWorkerId } from "./helpers.ts";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

let _access = "";
let _accessExp = 0;

function bytesToB64Url(bytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToB64Url(text: string): string {
  return bytesToB64Url(new TextEncoder().encode(text));
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = String(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "").trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

async function fcmAccessToken(sa: ServiceAccount): Promise<{ token: string; projectId: string }> {
  const now = Math.floor(Date.now() / 1000);
  const projectId = String(sa.project_id || Deno.env.get("FCM_PROJECT_ID") || "").trim();
  if (_access && _accessExp > now + 60) return { token: _access, projectId };
  const pem = String(sa.private_key).replace(/\\n/g, "\n");
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const header = textToB64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = textToB64Url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const sig = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  ));
  const jwt = unsigned + "." + bytesToB64Url(sig);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error("FCM auth failed");
  const parsed = JSON.parse(text) as { access_token?: string };
  _access = String(parsed.access_token || "");
  _accessExp = now + 3300;
  if (!_access) throw new Error("FCM auth missing token");
  return { token: _access, projectId };
}

function vapidKeys_(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = String(Deno.env.get("VAPID_PUBLIC_KEY") || "").trim();
  const privateKey = String(Deno.env.get("VAPID_PRIVATE_KEY") || "").trim();
  const subject = String(Deno.env.get("VAPID_SUBJECT") || "mailto:hr@empireworld.com").trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

async function sendWebPush_(raw: string, payload: string): Promise<boolean> {
  const vapid = vapidKeys_();
  if (!vapid) return false;
  let sub: { endpoint?: string };
  try {
    sub = JSON.parse(raw) as { endpoint?: string };
  } catch {
    return false;
  }
  if (!sub.endpoint) return false;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: "high" });
  return true;
}

export async function notifyUsers_(
  usernames: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<number> {
  const want = [...new Set(usernames.map((u) => normalizeWorkerId(u)).filter(Boolean))];
  if (!want.length) return 0;
  const { data: rows, error } = await sb()
    .from("worker_push_tokens")
    .select("username,fcm_token")
    .in("username", want);
  if (error || !rows || !rows.length) return 0;
  const page = String(data.deptPage || "hr-leave.html");
  const id = String(data.issueId || data.jobId || "");
  const link = "https://dizayeswar.github.io/Empire-General-Service/" + page +
    (id ? "?job=" + encodeURIComponent(id) : "");
  const fcmData: Record<string, string> = {};
  Object.keys(data).forEach((k) => { fcmData[k] = String(data[k] ?? ""); });
  fcmData.title = title;
  fcmData.body = body;
  fcmData.deptPage = page;
  const payload = JSON.stringify(fcmData);
  const sa = loadServiceAccount();
  let auth: { token: string; projectId: string } | null = null;
  if (sa) {
    try {
      auth = await fcmAccessToken(sa);
    } catch {
      auth = null;
    }
  }
  let sent = 0;
  for (const row of rows) {
    const fcm = String(row.fcm_token || "").trim();
    if (!fcm) continue;
    if (fcm.startsWith("{")) {
      try {
        if (await sendWebPush_(fcm, payload)) sent++;
      } catch {
        /* one phone failing must not stop the assignment */
      }
      continue;
    }
    if (!auth || !auth.projectId || !auth.token) continue;
    try {
      const resp = await fetch(
        "https://fcm.googleapis.com/v1/projects/" + auth.projectId + "/messages:send",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + auth.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: fcm,
              data: fcmData,
              webpush: {
                headers: { Urgency: "high", TTL: "86400" },
                fcm_options: { link },
              },
            },
          }),
        },
      );
      if (resp.ok) sent++;
    } catch {
      /* one phone failing must not stop the assignment */
    }
  }
  return sent;
}
