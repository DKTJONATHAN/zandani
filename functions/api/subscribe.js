const RESEND = "https://api.resend.com";
const SITE = "https://zandani.co.ke";
const FROM_DEFAULT = "Za Ndani <onboarding@resend.dev>";

function validEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (email.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": SITE,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const key = String(env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) {
    const err = new Error(
      "SUPABASE_URL or SUPABASE_SECRET_KEY is not configured on Cloudflare"
    );
    err.status = 503;
    throw err;
  }
  return { url, key };
}

function sbHeaders(key, extra = {}) {
  // Supabase sb_secret_* keys are opaque API keys, not JWTs.
  return {
    apikey: key,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function findSubscriber(env, email) {
  const { url, key } = supabaseConfig(env);
  const q = new URLSearchParams({
    email: `eq.${email}`,
    select: "id,email,active,subscribed_at,unsubscribed_at,source",
    limit: "1",
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
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertSubscriber(env, email) {
  const existing = await findSubscriber(env, email);
  if (existing && existing.active !== false) {
    return { already: true };
  }

  const { url, key } = supabaseConfig(env);
  const now = new Date().toISOString();
  const row = {
    email,
    subscribed_at: existing?.subscribed_at || now,
    active: true,
  };

  const res = await fetch(`${url}/rest/v1/newsletter_subscribers`, {
    method: "POST",
    headers: sbHeaders(key, {
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    if (res.status === 409 && existing) {
      const patch = await fetch(
        `${url}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: sbHeaders(key, { Prefer: "return=minimal" }),
          body: JSON.stringify({
            active: true,
            unsubscribed_at: null,
            subscribed_at: existing.subscribed_at || now,
          }),
        }
      );
      if (!patch.ok) {
        const body = await patch.text().catch(() => "");
        const err = new Error(`Supabase patch failed: ${patch.status} ${body}`);
        err.status = patch.status;
        throw err;
      }
      return { already: false };
    }
    const body = await res.text().catch(() => "");
    const err = new Error(`Supabase upsert failed: ${res.status} ${body}`);
    err.status = res.status;
    throw err;
  }

  return { already: false };
}

function welcomeHtml() {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome · Za Ndani</title>
<body style="margin:0;background:#050505;color:#f3ece2;font-family:Georgia,serif;">
  <table role="presentation" width="100%"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" style="max-width:520px;background:#111;border:1px solid #262626;">
      <tr><td style="padding:28px 28px 8px;text-align:center;">
        <div style="height:3px;background:#e85d04;margin:0 auto 20px;max-width:120px;"></div>
        <img src="${SITE}/logo.png" alt="Za Ndani" width="48" height="48" style="display:block;margin:0 auto 16px;border:0;">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">You're on the evening brief</h1>
        <p style="margin:0 0 20px;color:#9a9388;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">
          Fresh Kenyan news and entertainment, straight to your inbox. Stories land around 19:00 EAT.
        </p>
        <a href="${SITE}" style="display:inline-block;background:#e85d04;color:#050505;text-decoration:none;padding:13px 20px;font-weight:800;font-size:12px;letter-spacing:0.14em;font-family:Arial,Helvetica,sans-serif;">OPEN ZA NDANI</a>
      </td></tr>
      <tr><td style="padding:28px;border-top:1px solid #262626;">
        <p style="margin:0;font-size:11px;color:#6a655c;font-family:Arial,Helvetica,sans-serif;">
          Za Ndani · Nairobi newsroom · <a href="${SITE}" style="color:#6a655c;">zandani.co.ke</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

async function sendWelcome(env, email) {
  const key = env.RESEND_API_KEY;
  if (!key) return { skipped: true };
  const from = env.RESEND_FROM || FROM_DEFAULT;
  const res = await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "You're on the Za Ndani evening brief",
      html: welcomeHtml(),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Resend ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Enter a valid email." }, 400);
    }

    const email = validEmail(body?.email);
    if (!email) return json({ error: "Enter a valid email." }, 400);

    const { already } = await upsertSubscriber(env, email);

    if (!already) {
      try {
        await sendWelcome(env, email);
      } catch (mailErr) {
        console.error("welcome mail", mailErr);
      }
    }

    return json({
      ok: true,
      already,
      message: already
        ? "Already subscribed."
        : "Subscribed. Watch your inbox tonight at 19:00 EAT.",
    });
  } catch (error) {
    console.error("subscribe", error);
    const status = error.status === 503 ? 503 : 500;
    return json(
      {
        error:
          status === 503
            ? "Newsletter storage is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Cloudflare env."
            : "Could not subscribe. Try again.",
      },
      status
    );
  }
}
