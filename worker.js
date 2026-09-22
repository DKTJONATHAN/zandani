const GSC_HTML = "google-site-verification: google4a7d26b466f41330.html\n";
const GSC_TXT = "968a6d115d3240a3acbc3448c398978d\n";

const GITHUB_OWNER = "DKTJONATHAN";
const GITHUB_REPO = "zandani";
const GITHUB_BRANCH = "main";
// Newsletter subscribers are stored in Supabase; this worker no longer writes data/subscribers.json.

const PUSH_SUBS_PATH = "data/push_subscriptions.json";

function validPushSubscription(body) {
  const endpoint = String(body?.endpoint || "").trim();
  const p256dh = String(body?.keys?.p256dh || "").trim();
  const auth = String(body?.keys?.auth || "").trim();
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) return null;
  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 256) return null;
  return {
    endpoint,
    keys: { p256dh, auth },
    userAgent: String(body?.userAgent || "").slice(0, 240) || undefined,
    updatedAt: new Date().toISOString(),
  };
}

async function readPushSubscriptions(env) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PUSH_SUBS_PATH}?ref=${GITHUB_BRANCH}`;
  try {
    const data = await githubJson(url, { headers: ghHeaders(env) });
    const parsed = JSON.parse(fromBase64(data.content));
    return {
      sha: data.sha,
      subscriptions: Array.isArray(parsed?.subscriptions) ? parsed.subscriptions : [],
    };
  } catch (e) {
    if (e.status === 404) return { sha: null, subscriptions: [] };
    throw e;
  }
}

async function writePushSubscriptions(env, subscriptions, sha, message) {
  const payload = {
    message,
    branch: GITHUB_BRANCH,
    content: toBase64(JSON.stringify({
      updated: new Date().toISOString(),
      subscriptions,
    }, null, 2) + "\n"),
  };
  if (sha) payload.sha = sha;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PUSH_SUBS_PATH}`;
  return githubJson(url, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify(payload),
  });
}

async function handlePushSubscribe(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST" && request.method !== "DELETE") {
    return json({ error: "POST or DELETE only" }, 405);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const endpoint = String(body?.endpoint || "").trim();
    if (request.method === "DELETE") {
      if (!endpoint) return json({ error: "endpoint required" }, 400);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await readPushSubscriptions(env);
        const next = current.subscriptions.filter((s) => s?.endpoint !== endpoint);
        if (next.length === current.subscriptions.length) {
          return json({ ok: true, removed: false });
        }
        try {
          await writePushSubscriptions(env, next, current.sha, "push: remove subscription");
          return json({ ok: true, removed: true });
        } catch (e) {
          if (e.status === 409 || e.status === 422) continue;
          throw e;
        }
      }
      return json({ error: "Subscription changed elsewhere. Try again." }, 409);
    }

    const sub = validPushSubscription(body);
    if (!sub) return json({ error: "Invalid push subscription" }, 400);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await readPushSubscriptions(env);
      const index = current.subscriptions.findIndex((s) => s?.endpoint === sub.endpoint);
      const next = current.subscriptions.slice();

      if (index >= 0) {
        next[index] = { ...next[index], ...sub };
      } else {
        next.push({ ...sub, createdAt: new Date().toISOString() });
      }

      // Keep the file bounded while preserving the newest devices.
      const bounded = next.slice(-5000);

      try {
        await writePushSubscriptions(
          env,
          bounded,
          current.sha,
          index >= 0 ? "push: refresh subscription" : "push: new subscription"
        );
        return json({ ok: true, subscribed: true, count: bounded.length });
      } catch (e) {
        if (e.status === 409 || e.status === 422) continue;
        throw e;
      }
    }

    return json({ error: "Subscription changed elsewhere. Try again." }, 409);
  } catch (error) {
    console.error("push subscribe", error);
    const status = error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 403 : 500;
    return json({
      error: status === 503
        ? "Push service is not configured on Cloudflare."
        : "Could not save push subscription.",
      github_status: error.status || null,
    }, status);
  }
}

const SCHED_STATE_PATH = "data/scheduler-state.json";
const SCHED_LOG_PATH = "data/scheduler-log.json";
const RESEND = "https://api.resend.com";
const SITE = "https://zandani.co.ke";
const FROM_DEFAULT = "Za Ndani <brief@zandani.co.ke>";
const TZ = "Africa/Nairobi";

const DESKS = {
  news: { label: "News", workflow: "za-news.yml", cron: "0 * * * *", cadence: "hourly at :00" },
  africa: { label: "East Africa", workflow: "za-africa.yml", cron: "15 6,18 * * *", cadence: "twice daily (06:15/18:15)" },
  agriculture: { label: "Agriculture", workflow: "za-agriculture.yml", cron: "15 7 * * 2,5", cadence: "twice weekly (Tue/Fri 07:15)" },
  diano: { label: "George Diano", workflow: "za-diano.yml", cron: "15 13,20 * * *", cadence: "twice daily (13:15/20:15)" },
  jaj: { label: "Jaj", workflow: "za-jaj.yml", cron: "0 10 * * 1,4", cadence: "twice weekly (Mon/Thu 10:00)" },
  sports: { label: "Sports", workflow: "za-sports.yml", cron: "15 11,19 * * *", cadence: "twice daily (11:15/19:15)" },
  business: { label: "Business", workflow: "za-business.yml", cron: "15 8,16 * * *", cadence: "twice daily (08:15/16:15)" },
  technology: { label: "Technology", workflow: "za-technology.yml", cron: "15 12,18 * * *", cadence: "twice daily (12:15/18:15)" },
  opinions: { label: "Opinions", workflow: "za-opinions.yml", cron: "15 16 * * 2,5", cadence: "twice weekly (Tue/Fri 16:15)" },
  entertainment: { label: "Entertainment", workflow: "za-entertainment.yml", cron: "8 */2 * * *", cadence: "every 2h at :08" },
  mpasho: { label: "Mpasho", workflow: "za-mpasho.yml", cron: "20 */2 * * *", cadence: "every 2h at :20" },
  lifestyle: { label: "Lifestyle", workflow: "za-lifestyle.yml", cron: "15 12 * * 2,5", cadence: "twice weekly (Tue/Fri 12:15)" },
  ghafla: { label: "Ghafla", workflow: "za-ghafla.yml", cron: "44 */2 * * *", cadence: "every 2h at :44" },
};

function validEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (email.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": SITE,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    ...extra,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json" }),
  });
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(String(b64 || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function ghHeaders(env) {
  let token = String(env.PERSONAL_GITHUB_TOKEN || "").trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  if (!token) {
    const err = new Error("PERSONAL_GITHUB_TOKEN is not configured");
    err.status = 503;
    throw err;
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "zandani-worker",
  };
}

async function githubJson(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      body.message ||
      (Array.isArray(body.errors) && body.errors.map((e) => e.message).join("; ")) ||
      `GitHub ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function nairobiParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute,
    second: Number(map.second),
    dow: dowMap[map.weekday] ?? 0,
    display: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`,
    slotKey: `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`,
  };
}

function cronMatches(expr, parts) {
  const fields = String(expr || "").trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minF, hourF] = fields;
  const matchField = (field, value) => {
    if (field === "*") return true;
    if (field.startsWith("*/")) {
      const step = Number(field.slice(2));
      return Number.isFinite(step) && step > 0 && value % step === 0;
    }
    return field.split(",").some((tok) => Number(tok) === value);
  };
  return matchField(minF, parts.minute) && matchField(hourF, parts.hour);
}

function nextRunIso(cron, from = new Date()) {
  for (let i = 1; i <= 48 * 60; i += 1) {
    const d = new Date(from.getTime() + i * 60_000);
    if (cronMatches(cron, nairobiParts(d))) return d.toISOString();
  }
  return null;
}

async function readGithubJson(env, path) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  try {
    const data = await githubJson(url, { headers: ghHeaders(env) });
    return { sha: data.sha, data: JSON.parse(fromBase64(data.content)) };
  } catch (e) {
    if (e.status === 404) return { sha: null, data: null };
    throw e;
  }
}

async function writeGithubJson(env, path, obj, sha, message) {
  const payload = {
    message,
    branch: GITHUB_BRANCH,
    content: toBase64(JSON.stringify(obj, null, 2) + "\n"),
  };
  if (sha) payload.sha = sha;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  return githubJson(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(payload) });
}

async function dispatchWorkflow(env, workflowFile) {
  const headers = ghHeaders(env);
  const listUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows?per_page=100`;
  const list = await githubJson(listUrl, { headers });
  const expectedPath = `.github/workflows/${workflowFile}`;
  const workflows = Array.isArray(list.workflows) ? list.workflows : [];
  const workflow = workflows.find((item) => String(item.path || "") === expectedPath);
  if (!workflow?.id) {
    return {
      ok: false,
      status: 404,
      error: `Canonical workflow not found: ${expectedPath}`,
    };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflow.id}/dispatches`;
  const dispatch = async () => fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ref: GITHUB_BRANCH }),
  });

  // GitHub can briefly lag while a newly edited workflow is re-indexed. If it
  // reports the old "missing workflow_dispatch" error, verify the current
  // workflow file and retry once instead of persisting a false failure.
  let res = await dispatch();
  let body = {};
  if (res.status !== 204 && !res.ok) {
    body = await res.json().catch(() => ({}));
    if (
      res.status === 422 &&
      /workflow_dispatch/i.test(String(body.message || "")) &&
      /does not have/i.test(String(body.message || ""))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      res = await dispatch();
      if (res.status !== 204 && !res.ok) body = await res.json().catch(() => ({}));
    }
  }

  if (res.status === 204 || res.ok) {
    return { ok: true, status: res.status, workflowId: workflow.id };
  }
  return {
    ok: false,
    status: res.status,
    error: body.message || `GitHub ${res.status}`,
    workflowId: workflow.id,
  };
}

async function recordAutomationRun(env, deskId, source, scheduledFor, result) {
  const { url, key } = supabaseConfig(env);
  const now = new Date().toISOString();
  const payload = { desk_id: deskId, source, status: result.ok ? "dispatched" : "failed",
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : now,
    started_at: now, finished_at: result.ok ? now : null, error: result.error || null,
    metadata: { workflow_id: result.workflowId || null } };
  const res = await fetch(url + "/rest/v1/automation_runs", { method: "POST",
    headers: sbHeaders(key, { Prefer: "return=minimal" }), body: JSON.stringify(payload) });
  if (!res.ok) console.error("automation run record", await res.text().catch(() => ""));
}
async function updateAutomationDesk(env, deskId, patch) {
  const { url, key } = supabaseConfig(env);
  const res = await fetch(url + "/rest/v1/automation_desks?id=eq." + encodeURIComponent(deskId), {
    method: "PATCH", headers: sbHeaders(key, { Prefer: "return=minimal" }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  if (!res.ok) console.error("automation desk update", await res.text().catch(() => ""));
}
async function triggerDesk(env, deskId, source = "cron", scheduledFor = null) {
  const desk = DESKS[deskId];
  if (!desk) return { ok: false, error: "Unknown desk" };
  const dispatchedAt = new Date().toISOString();
  const result = await dispatchWorkflow(env, desk.workflow);
  await recordAutomationRun(env, deskId, source, scheduledFor || dispatchedAt, result);
  await updateAutomationDesk(env, deskId, { last_triggered_at: dispatchedAt,
    last_status: result.ok ? "ok" : "failed", last_error: result.error || null, last_source: source });
  return { ...result, desk: deskId };
}

function useAdminScheduler(env) {
  const flag = String(env.USE_ADMIN_SCHEDULER ?? "true").toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "off";
}

async function runDueDesks(env) {
  if (!useAdminScheduler(env)) return { triggered: [], skipped: true };
  const parts = nairobiParts();
  let stateRows = [];
  try { stateRows = await readAutomationDesks(env); } catch (_) {}
  const state = new Map(stateRows.map((r) => [String(r.id), r]));
  const triggered = [];
  for (const [id, desk] of Object.entries(DESKS)) {
    if (state.get(id)?.enabled === false) continue;
    if (!cronMatches(desk.cron, parts)) continue;
    const slot = parts.slotKey;
    if (state.get(id)?.last_slot === slot) continue;
    const res = await triggerDesk(env, id, "cron", parts.display);
    await updateAutomationDesk(env, id, { last_slot: slot });
    if (res.ok) triggered.push(id);
  }
  return { triggered, now: parts.display };
}

function supabaseConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    const err = new Error("SUPABASE_URL plus SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY is not configured on Cloudflare");
    err.status = 503;
    throw err;
  }
  return { url, key };
}

function sbHeaders(key, extra = {}) {
  // Supabase's new sb_secret_* keys are opaque API keys, not JWTs.
  // Send them via apikey only; never use Authorization: Bearer.
  return {
    apikey: key,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readSubscribers(env) {
  const { url, key } = supabaseConfig(env);
  const q = new URLSearchParams({
    select: "id,email,subscribed_at,unsubscribed_at,active,source,created_at,updated_at",
    active: "eq.true",
    order: "subscribed_at.asc",
  });
  const res = await fetch(`${url}/rest/v1/newsletter_subscribers?${q}`, {
    headers: sbHeaders(key),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Supabase read failed: ${res.status} ${body}`);
    err.status = res.status;
    throw err;
  }
  const rows = await res.json();
  return {
    subscribers: Array.isArray(rows)
      ? rows.map((row) => ({
          email: row.email,
          subscribed_at: row.subscribed_at,
          active: row.active === true,
        }))
      : [],
  };
}

async function upsertSubscriber(env, email) {
  const { url, key } = supabaseConfig(env);
  const now = new Date().toISOString();
  const q = new URLSearchParams({
    email: `eq.${email}`,
    select: "id,email,subscribed_at,unsubscribed_at,active,source",
    limit: "1",
  });
  const existingRes = await fetch(`${url}/rest/v1/newsletter_subscribers?${q}`, {
    headers: sbHeaders(key),
  });
  if (!existingRes.ok) {
    const body = await existingRes.text().catch(() => "");
    const err = new Error(`Supabase read failed: ${existingRes.status} ${body}`);
    err.status = existingRes.status;
    throw err;
  }

  const rows = await existingRes.json();
  const existing = Array.isArray(rows) && rows.length ? rows[0] : null;

  if (existing?.active === true) return { already: true };

  if (existing) {
    const patch = await fetch(
      `${url}/rest/v1/newsletter_subscribers?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        headers: sbHeaders(key, { Prefer: "return=minimal" }),
        body: JSON.stringify({
          active: true,
          unsubscribed_at: null,
          subscribed_at: existing.subscribed_at || now,
          source: existing.source || "website",
        }),
      }
    );
    if (!patch.ok) {
      const body = await patch.text().catch(() => "");
      const err = new Error(`Supabase reactivate failed: ${patch.status} ${body}`);
      err.status = patch.status;
      throw err;
    }
    return { already: false };
  }

  const res = await fetch(`${url}/rest/v1/newsletter_subscribers`, {
    method: "POST",
    headers: sbHeaders(key, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      email,
      subscribed_at: now,
      unsubscribed_at: null,
      active: true,
      source: "website",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Supabase insert failed: ${res.status} ${body}`);
    err.status = res.status;
    throw err;
  }
  return { already: false };
}


function subscriberDisplayName(email, suppliedName = "") {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const explicit = String(suppliedName || "").trim().replace(/\s+/g, " ");
  if (explicit && explicit.length <= 120) return explicit;
  const local = cleanEmail.split("@")[0] || "";
  const candidate = local.replace(/[._+-]+/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  if (!candidate) return cleanEmail;
  const words = candidate.split(" ").filter(Boolean);
  const looksLikeName = words.length <= 4 && words.every((word) => /^[a-zA-Z]{2,20}$/.test(word));
  if (!looksLikeName) return cleanEmail;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function welcomeHtml(email, suppliedName = "") {
  const name = subscriberDisplayName(email, suppliedName);
  const greeting = `Hi ${name},`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Za Ndani</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#f5f0e8;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#141414;border:1px solid #262626;">
<tr><td style="height:4px;background:#e85d04;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:34px 30px 30px;">
<img src="${SITE}/logo.png" alt="Za Ndani" width="52" height="52" style="display:block;border:0;border-radius:8px;">
<p style="margin:20px 0 8px;font:700 11px Arial,sans-serif;letter-spacing:.2em;color:#e85d04;text-transform:uppercase;">WELCOME TO ZA NDANI</p>
<h1 style="margin:0 0 18px;font:700 28px/1.2 Georgia,serif;color:#f5f0e8;">${greeting}</h1>
<p style="margin:0 0 16px;font:15px/1.7 Arial,sans-serif;color:#9a9388;">Thank you for subscribing to Za Ndani. We are glad to have you with us.</p>
<p style="margin:0 0 16px;font:15px/1.7 Arial,sans-serif;color:#9a9388;">Za Ndani is a Kenya-focused digital news platform bringing you timely stories across news, politics, business, society, culture, entertainment, lifestyle and sports. We focus on stories that matter to Kenyan readers while also keeping you connected to important developments beyond Kenya.</p>
<p style="margin:0 0 24px;font:15px/1.7 Arial,sans-serif;color:#9a9388;">As a subscriber, you will receive selected Za Ndani stories and updates in your inbox, with links back to the full articles on our website.</p>
<a href="${SITE}" style="display:inline-block;background:#e85d04;color:#0a0a0a;text-decoration:none;padding:13px 20px;font:700 12px Arial,sans-serif;letter-spacing:.08em;">VISIT ZA NDANI</a>
</td></tr>
<tr><td style="padding:22px 30px;border-top:1px solid #262626;font:12px/1.6 Arial,sans-serif;color:#6a655c;">Za Ndani · zandani.co.ke</td></tr>
</table></td></tr></table></body></html>`;
}
async function sendWelcome(env, email, suppliedName = "") {
  const key = String(env.RESEND_API_KEY || "").trim();
  if (!key) return { skipped: true };
  // Welcome mail uses the verified Za Ndani production sender; do not fall back to resend.dev.\n  const from = FROM_DEFAULT;
  const res = await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Welcome to Za Ndani", html: welcomeHtml(email, suppliedName) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Resend ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function handleSubscribe(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Enter a valid email." }, 400); }
    const email = validEmail(body?.email);
    if (!email) return json({ error: "Enter a valid email." }, 400);

    const { already } = await upsertSubscriber(env, email);

    if (!already) {
      try { await sendWelcome(env, email, body?.name); }
      catch (mailErr) { console.error("welcome mail", mailErr); }
    }

    return json({
      ok: true,
      already,
      message: already ? "Already subscribed." : "Subscribed. Watch your inbox tonight at 19:00 EAT.",
    });
  } catch (error) {
    console.error("subscribe", error);
    const status = error.status === 503 ? 503 : 500;
    return json({
      error: status === 503
        ? "Newsletter storage is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to Cloudflare."
        : "Could not subscribe. Try again.",
    }, status);
  }
}


async function deactivate(env, email) {
  const { url, key } = supabaseConfig(env);
  const res = await fetch(
    `${url}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: sbHeaders(key, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        active: false,
        unsubscribed_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Supabase unsubscribe failed: ${res.status} ${body}`);
    err.status = res.status;
    throw err;
  }
}


function thanksPage() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Unsubscribed · Za Ndani</title>\n<body style="margin:0;background:#050505;color:#f3ece2;font-family:Georgia,serif;">\n<div style="max-width:420px;margin:64px auto;text-align:center;">\n<div style="height:3px;background:#e85d04;margin-bottom:28px;"></div>\n<h1>You're off the evening brief.</h1>\n<p style="color:#9a9388;font-family:Arial,sans-serif;font-size:14px;"><a href="${SITE}" style="color:#e85d04;">Back to Za Ndani</a></p>\n</div></body></html>`;
}

async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  let email = validEmail(url.searchParams.get("email"));
  if (!email && request.method === "POST") {
    try { const body = await request.json(); email = validEmail(body?.email); } catch { /* */ }
  }
  if (!email) return json({ error: "Missing email" }, 400);
  try { await deactivate(env, email); } catch (e) { console.error("unsubscribe", e); }
  if (request.method === "GET") {
    return new Response(thanksPage(), { status: 200, headers: corsHeaders({ "Content-Type": "text/html; charset=utf-8" }) });
  }
  return json({ ok: true });
}

async function handleGithubApi(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await request.json();
    const action = body.action;
    const path = body.path;
    const base = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
    if (action === "GET_SHA" || action === "GET_CONTENT") {
      const data = await githubJson(`${base}?ref=${GITHUB_BRANCH}`, { headers: ghHeaders(env) });
      return json({ sha: data.sha, content: data.content });
    }
    if (action === "PUSH") {
      const payload = { message: body.message || "admin update", branch: GITHUB_BRANCH, content: body.content };
      if (body.sha) payload.sha = body.sha;
      const data = await githubJson(base, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(payload) });
      return json({ ok: true, content: data.content });
    }
    if (action === "DELETE") {
      const payload = { message: body.message || "admin delete", branch: GITHUB_BRANCH, sha: body.sha };
      await githubJson(base, { method: "DELETE", headers: ghHeaders(env), body: JSON.stringify(payload) });
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("github api", error);
    const status = error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 403 : 500;
    return json({ error: String(error.message || "GitHub error"), github_status: error.status || null }, status);
  }
}

async function readAutomationDesks(env) {
  const { url, key } = supabaseConfig(env);
  const res = await fetch(url + "/rest/v1/automation_desks?select=*&order=id.asc", { headers: sbHeaders(key) });
  if (!res.ok) throw new Error("Supabase automation desks read failed: " + res.status);
  return await res.json();
}
async function readAutomationLogs(env, limit = 50) {
  const { url, key } = supabaseConfig(env);
  const q = new URLSearchParams({ select: "id,desk_id,source,scheduled_for,started_at,finished_at,status,error,article_slug,candidate_count,image_count,created_at", order: "created_at.desc", limit: String(limit) });
  const res = await fetch(url + "/rest/v1/automation_runs?" + q, { headers: sbHeaders(key) });
  if (!res.ok) throw new Error("Supabase automation logs read failed: " + res.status);
  return await res.json();
}
async function handleSchedulerStatus(env) {
  try {
    const rows = await readAutomationDesks(env);
    const now = nairobiParts();
    const enabled = useAdminScheduler(env);
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const desks = Object.entries(DESKS).map(([id, desk]) => {
      const row = byId.get(id) || {};
      return { id, label: desk.label, workflow: "server automation", cron: desk.cron, cadence: desk.cadence,
        nextRun: nextRunIso(desk.cron), nextRunAt: nextRunIso(desk.cron), workflowFound: true,
        workflowState: "managed", lastTriggeredAt: row.last_triggered_at || null,
        lastStatus: row.last_status || "never", lastError: row.last_error || null,
        lastSource: row.last_source || null, last: row };
    });
    return json({ ok: true, timezone: TZ, nairobiNow: now.display, nowNairobi: now.display,
      adminScheduler: enabled, useAdminScheduler: enabled, desks });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
async function handleSchedulerLogs(env, url) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  try {
    const logs = await readAutomationLogs(env, limit);
    return json({ ok: true, logs: logs.map((r) => ({
      id: r.id, desk: r.desk_id, scheduledFor: r.scheduled_for, dispatchedAt: r.started_at || r.created_at,
      status: r.status === "published" || r.status === "dispatched" ? 204 : (r.status === "failed" ? 500 : null),
      ok: r.status !== "failed", error: r.error || null, source: r.source === "manual" ? "manual" : "cron"
    })) });
  } catch (e) { return json({ ok: true, logs: [], error: String(e.message || e) }); }
}

async function handleSchedulerTrigger(request, env, deskId) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const result = await triggerDesk(env, deskId, "manual");
    return json(result, result.ok ? 200 : 502);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, e.status || 500);
  }
}

async function handleSchedulerTick(env) {
  try {
    const result = await runDueDesks(env);
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/google4a7d26b466f41330.html" || path === "/google4a7d26b466f41330") {
      return new Response(GSC_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (path === "/968a6d115d3240a3acbc3448c398978d.txt") {
      return new Response(GSC_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    if (path === "/api/push-subscribe") return handlePushSubscribe(request, env);
    if (path === "/api/subscribe") return handleSubscribe(request, env);
    if (path === "/api/unsubscribe") return handleUnsubscribe(request, env);
    if (path === "/api/github") return handleGithubApi(request, env);

    if (path === "/api/scheduler/status") return handleSchedulerStatus(env);
    if (path === "/api/scheduler/logs") return handleSchedulerLogs(env, url);
    if (path === "/api/scheduler/tick") return handleSchedulerTick(env);
    const triggerMatch = path.match(/^\/api\/scheduler\/trigger\/([a-z0-9-]+)$/i);
    if (triggerMatch) return handleSchedulerTrigger(request, env, triggerMatch[1].toLowerCase());

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runDueDesks(env).then((r) => console.log("scheduler tick", JSON.stringify(r))).catch((e) => console.error("scheduler", e))
    );
  },
};
