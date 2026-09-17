const GSC_HTML = "google-site-verification: google4a7d26b466f41330.html\n";
const GSC_TXT = "968a6d115d3240a3acbc3448c398978d\n";

const GITHUB_OWNER = "DKTJONATHAN";
const GITHUB_REPO = "zandani";
const GITHUB_BRANCH = "main";
const SUBS_PATH = "data/subscribers.json";
const SCHED_STATE_PATH = "data/scheduler-state.json";
const SCHED_LOG_PATH = "data/scheduler-log.json";
const RESEND = "https://api.resend.com";
const SITE = "https://zandani.co.ke";
const FROM_DEFAULT = "Za Ndani <onboarding@resend.dev>";
const TZ = "Africa/Nairobi";

const DESKS = {
  // Hourly desks — staggered minutes (Africa/Nairobi)
  news: { label: "News", workflow: "za-news.yml", cron: "0 * * * *", cadence: "hourly at :00" },
  africa: { label: "East Africa", workflow: "za-africa.yml", cron: "12 * * * *", cadence: "hourly at :12" },
  agriculture: { label: "Agriculture", workflow: "za-agriculture.yml", cron: "24 * * * *", cadence: "hourly at :24" },
  diano: { label: "George Diano", workflow: "za-diano.yml", cron: "36 * * * *", cadence: "hourly at :36" },
  jaj: { label: "Jaj", workflow: "za-jaj.yml", cron: "48 * * * *", cadence: "hourly at :48" },
  // Every 2 hours — staggered away from news
  sports: { label: "Sports", workflow: "za-sports.yml", cron: "6 */2 * * *", cadence: "every 2h at :06" },
  business: { label: "Business", workflow: "za-business.yml", cron: "18 */2 * * *", cadence: "every 2h at :18" },
  technology: { label: "Technology", workflow: "za-technology.yml", cron: "30 */2 * * *", cadence: "every 2h at :30" },
  opinions: { label: "Opinions", workflow: "za-opinions.yml", cron: "42 */2 * * *", cadence: "every 2h at :42" },
  // Entertainment cluster — every 2 hours, different minutes
  entertainment: { label: "Entertainment", workflow: "za-entertainment.yml", cron: "8 */2 * * *", cadence: "every 2h at :08" },
  mpasho: { label: "Mpasho", workflow: "za-mpasho.yml", cron: "20 */2 * * *", cadence: "every 2h at :20" },
  lifestyle: { label: "Lifestyle", workflow: "za-lifestyle.yml", cron: "32 */2 * * *", cadence: "every 2h at :32" },
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
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: ghHeaders(env),
    body: JSON.stringify({ ref: GITHUB_BRANCH }),
  });
  if (res.status === 204 || res.ok) return { ok: true, status: res.status };
  const body = await res.json().catch(() => ({}));
  return { ok: false, status: res.status, error: body.message || `GitHub ${res.status}` };
}

async function appendLog(env, entry) {
  let sha = null;
  let logs = [];
  try {
    const cur = await readGithubJson(env, SCHED_LOG_PATH);
    sha = cur.sha;
    logs = Array.isArray(cur.data?.logs) ? cur.data.logs : [];
  } catch (e) {
    console.error("read log", e);
  }
  logs.unshift(entry);
  logs = logs.slice(0, 200);
  try {
    await writeGithubJson(env, SCHED_LOG_PATH, { updated: new Date().toISOString(), logs }, sha, "scheduler: append dispatch log");
  } catch (e) {
    if (e.status === 409 || e.status === 422) {
      const cur = await readGithubJson(env, SCHED_LOG_PATH);
      const merged = [entry, ...(Array.isArray(cur.data?.logs) ? cur.data.logs : [])].slice(0, 200);
      await writeGithubJson(env, SCHED_LOG_PATH, { updated: new Date().toISOString(), logs: merged }, cur.sha, "scheduler: append dispatch log (retry)");
    } else console.error("write log", e);
  }
}

async function updateDeskState(env, deskId, patch) {
  let sha = null;
  let state = { desks: {} };
  try {
    const cur = await readGithubJson(env, SCHED_STATE_PATH);
    sha = cur.sha;
    state = cur.data && typeof cur.data === "object" ? cur.data : { desks: {} };
    if (!state.desks) state.desks = {};
  } catch (e) {
    console.error("read state", e);
  }
  state.desks[deskId] = { ...(state.desks[deskId] || {}), ...patch };
  state.updated = new Date().toISOString();
  try {
    await writeGithubJson(env, SCHED_STATE_PATH, state, sha, `scheduler: state ${deskId}`);
  } catch (e) {
    console.error("write state", e);
  }
  return state;
}

async function triggerDesk(env, deskId, source = "cron", scheduledFor = null) {
  const desk = DESKS[deskId];
  if (!desk) return { ok: false, error: "Unknown desk" };
  const dispatchedAt = new Date().toISOString();
  const result = await dispatchWorkflow(env, desk.workflow);
  const logEntry = {
    id: `${deskId}-${Date.now()}`,
    desk: deskId,
    scheduledFor: scheduledFor || dispatchedAt,
    dispatchedAt,
    status: result.status ?? null,
    ok: !!result.ok,
    error: result.error || null,
    source,
  };
  await appendLog(env, logEntry);
  await updateDeskState(env, deskId, {
    lastTriggeredAt: dispatchedAt,
    lastStatus: result.ok ? "ok" : "failed",
    lastError: result.error || null,
    lastSource: source,
  });
  return { ...result, desk: deskId };
}

function useAdminScheduler(env) {
  const flag = String(env.USE_ADMIN_SCHEDULER ?? "true").toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "off";
}

async function runDueDesks(env) {
  if (!useAdminScheduler(env)) return { triggered: [], skipped: true };
  const parts = nairobiParts();
  // Staggered minutes — any minute can fire via cronMatches
  let state = { desks: {} };
  try {
    const cur = await readGithubJson(env, SCHED_STATE_PATH);
    state = cur.data || { desks: {} };
  } catch (_) {}
  const triggered = [];
  for (const [id, desk] of Object.entries(DESKS)) {
    if (!cronMatches(desk.cron, parts)) continue;
    const slot = parts.slotKey;
    const lastSlot = state.desks?.[id]?.lastSlot;
    if (lastSlot === slot) continue;
    const res = await triggerDesk(env, id, "cron", parts.display);
    await updateDeskState(env, id, { lastSlot: slot });
    if (res.ok) triggered.push(id);
  }
  return { triggered, now: parts.display };
}

async function readSubscribers(env) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SUBS_PATH}?ref=${GITHUB_BRANCH}`;
  try {
    const data = await githubJson(url, { headers: ghHeaders(env) });
    const decoded = fromBase64(data.content);
    const parsed = JSON.parse(decoded);
    const list = Array.isArray(parsed.subscribers) ? parsed.subscribers : [];
    return { sha: data.sha, subscribers: list };
  } catch (e) {
    if (e.status === 404) return { sha: null, subscribers: [] };
    throw e;
  }
}

async function writeSubscribers(env, subscribers, sha, message) {
  const payload = {
    message,
    branch: GITHUB_BRANCH,
    content: toBase64(JSON.stringify({ updated: new Date().toISOString(), subscribers }, null, 2) + "\n"),
  };
  if (sha) payload.sha = sha;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SUBS_PATH}`;
  return githubJson(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(payload) });
}

function welcomeHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Za Ndani</title></head>
<body style="margin:0;background:#050505;color:#f3ece2;font-family:Georgia,serif;">
<div style="max-width:520px;margin:40px auto;padding:28px;background:#111;">
<p style="color:#e85d04;font-size:11px;letter-spacing:.28em;font-weight:800;">YOU'RE ON THE LIST · EAT</p>
<h1 style="font-size:28px;">The evening brief, every night at 7.</h1>
<p style="color:#9a9388;font-family:Arial,sans-serif;font-size:14px;">Three Kenya-first stories. No Hollywood filler.</p>
<a href="${SITE}" style="display:inline-block;background:#e85d04;color:#050505;padding:12px 18px;text-decoration:none;font-weight:800;font-size:12px;">OPEN ZA NDANI</a>
</div></body></html>`;
}

async function sendWelcome(env, email) {
  const key = String(env.RESEND_API_KEY || "").trim();
  if (!key) return { skipped: true };
  const from = String(env.RESEND_FROM || "").trim() || FROM_DEFAULT;
  const res = await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "You're on the Za Ndani evening brief", html: welcomeHtml() }),
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
    let saved = false, already = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await readSubscribers(env);
      const existing = current.subscribers.find((row) => String(row.email || "").toLowerCase() === email);
      if (existing && existing.active !== false) { already = true; saved = true; break; }
      const next = existing
        ? current.subscribers.map((row) =>
            String(row.email || "").toLowerCase() === email
              ? { ...row, active: true, subscribed_at: row.subscribed_at || new Date().toISOString() }
              : row)
        : current.subscribers.concat([{ email, subscribed_at: new Date().toISOString(), active: true }]);
      try {
        await writeSubscribers(env, next, current.sha, existing ? "newsletter: reactivate subscriber" : "newsletter: new subscriber");
        saved = true; break;
      } catch (e) {
        if (e.status === 409 || e.status === 422) continue;
        throw e;
      }
    }
    if (!saved) return json({ error: "Could not save just then. Try once more." }, 409);
    if (!already) { try { await sendWelcome(env, email); } catch (mailErr) { console.error("welcome mail", mailErr); } }
    return json({ ok: true, already, message: already ? "Already subscribed." : "Subscribed. Watch your inbox tonight at 19:00 EAT." });
  } catch (error) {
    console.error("subscribe", error);
    const status = error.status === 503 ? 503 : error.status === 401 || error.status === 403 ? 403 : 500;
    return json({ error: String(error.message || "Could not subscribe."), github_status: error.status || null }, status);
  }
}

async function deactivate(env, email) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SUBS_PATH}?ref=${GITHUB_BRANCH}`;
  const getRes = await fetch(url, { headers: ghHeaders(env) });
  if (getRes.status === 404) return;
  const data = await getRes.json();
  if (!getRes.ok) throw new Error(data.message || "GitHub read failed");
  const parsed = JSON.parse(fromBase64(data.content));
  const list = Array.isArray(parsed.subscribers) ? parsed.subscribers : [];
  let changed = false;
  const next = list.map((row) => {
    if (String(row.email || "").toLowerCase() !== email) return row;
    if (row.active === false) return row;
    changed = true;
    return { ...row, active: false, unsubscribed_at: new Date().toISOString() };
  });
  if (!changed) return;
  const payload = {
    message: "newsletter: unsubscribe",
    branch: GITHUB_BRANCH,
    sha: data.sha,
    content: toBase64(JSON.stringify({ updated: new Date().toISOString(), subscribers: next }, null, 2) + "\n"),
  };
  const put = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SUBS_PATH}`, {
    method: "PUT", headers: ghHeaders(env), body: JSON.stringify(payload),
  });
  if (!put.ok) {
    const body = await put.json().catch(() => ({}));
    throw new Error(body.message || "GitHub write failed");
  }
}

function thanksPage() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Unsubscribed · Za Ndani</title>
<body style="margin:0;background:#050505;color:#f3ece2;font-family:Georgia,serif;">
<div style="max-width:420px;margin:64px auto;text-align:center;">
<div style="height:3px;background:#e85d04;margin-bottom:28px;"></div>
<h1>You're off the evening brief.</h1>
<p style="color:#9a9388;font-family:Arial,sans-serif;font-size:14px;"><a href="${SITE}" style="color:#e85d04;">Back to Za Ndani</a></p>
</div></body></html>`;
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

async function handleSchedulerStatus(env) {
  let state = { desks: {} };
  try {
    const cur = await readGithubJson(env, SCHED_STATE_PATH);
    state = cur.data || { desks: {} };
  } catch (_) {}
  const now = nairobiParts();
  const desks = Object.entries(DESKS).map(([id, desk]) => ({
    id,
    label: desk.label,
    workflow: desk.workflow,
    cron: desk.cron,
    cadence: desk.cadence,
    nextRun: nextRunIso(desk.cron),
    last: state.desks?.[id] || null,
  }));
  return json({
    ok: true,
    timezone: TZ,
    nairobiNow: now.display,
    adminScheduler: useAdminScheduler(env),
    desks,
  });
}

async function handleSchedulerLogs(env, url) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  try {
    const cur = await readGithubJson(env, SCHED_LOG_PATH);
    const logs = Array.isArray(cur.data?.logs) ? cur.data.logs.slice(0, limit) : [];
    return json({ ok: true, logs });
  } catch (e) {
    return json({ ok: true, logs: [], error: String(e.message || e) });
  }
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
