const SITE = "https://zandani.co.ke";

function validEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (email.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": SITE,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function supabaseConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    const err = new Error(
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured on Cloudflare"
    );
    err.status = 503;
    throw err;
  }
  return { url, key };
}

function sbHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function deactivate(env, email) {
  const { url, key } = supabaseConfig(env);
  const now = new Date().toISOString();
  const res = await fetch(
    `${url}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: sbHeaders(key, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        active: false,
        unsubscribed_at: now,
        updated_at: now,
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
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed · Za Ndani</title>
<body style="margin:0;background:#050505;color:#f3ece2;font-family:Georgia,serif;">
  <table role="presentation" width="100%"><tr><td align="center" style="padding:64px 20px;">
    <div style="height:3px;background:#e85d04;max-width:420px;margin:0 auto 28px;"></div>
    <img src="${SITE}/logo.png" alt="Za Ndani" width="48" height="48" style="display:block;margin:0 auto 20px;border:0;">
    <h1 style="margin:0 0 12px;font-size:28px;">You're off the evening brief.</h1>
    <p style="color:#9a9388;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
      We will not mail this address again. <a href="${SITE}" style="color:#e85d04;">Back to Za Ndani</a>
    </p>
  </td></tr></table>
</body>
</html>`;
}

async function handle(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let email = validEmail(url.searchParams.get("email") || "");

  if (request.method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      email = validEmail(body?.email) || email;
    } catch {
      /* ignore */
    }
  }

  if (!email) {
    if (request.method === "GET") {
      return new Response(thanksPage(), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
      });
    }
    return json({ error: "Missing email." }, 400);
  }

  try {
    await deactivate(env, email);
  } catch (error) {
    console.error("unsubscribe", error);
    if (request.method === "GET") {
      return new Response(thanksPage(), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
      });
    }
    return json({ error: "Could not unsubscribe." }, 500);
  }

  if (request.method === "GET") {
    return new Response(thanksPage(), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() },
    });
  }
  return json({ ok: true, message: "Unsubscribed." });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestPost(context) {
  return handle(context);
}
