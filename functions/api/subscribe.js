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
  const key = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    const err = new Error(
      "SUPABASE_URL plus SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY is not configured on Cloudflare"
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Za Ndani</title></head>
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
</td></tr><tr><td style="padding:22px 30px;border-top:1px solid #262626;font:12px/1.6 Arial,sans-serif;color:#6a655c;">Za Ndani · zandani.co.ke</td></tr>
</table></td></tr></table></body></html>`;
}
async function sendWelcome(env, email, suppliedName = "") {
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
      subject: "Welcome to Za Ndani",
      html: welcomeHtml(email, suppliedName),
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
        await sendWelcome(env, email, body?.name);
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
