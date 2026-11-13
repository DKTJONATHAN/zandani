import { verifyAdminSessionToken } from "../_shared/admin.ts";

const SITE = "https://zandani.co.ke";
const ALLOWED_ORIGINS = new Set([SITE, "https://www.zandani.co.ke"]);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "POST required" }, 405, origin);

  const token = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const secret = Deno.env.get("ADMIN_API_TOKEN") || "";
  if (!(await verifyAdminSessionToken(token, secret))) {
    return json({ error: "Unauthorized or expired admin session" }, 401, origin);
  }

  const apiKey = Deno.env.get("INDEXJUMP_API_KEY");
  if (!apiKey) return json({ error: "IndexJump API key is not configured" }, 503, origin);

  let body: { urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON request" }, 400, origin);
  }

  if (!Array.isArray(body.urls) || body.urls.length < 1 || body.urls.length > 5) {
    return json({ error: "Submit between 1 and 5 article URLs at a time" }, 400, origin);
  }

  const fullUrls: string[] = [];
  for (const candidate of body.urls) {
    if (typeof candidate !== "string" || candidate.length > 2048) {
      return json({ error: "Invalid article URL" }, 400, origin);
    }
    try {
      const url = new URL(candidate, SITE);
      if (url.origin !== SITE || !/^\/article\/[a-z0-9-]+$/i.test(url.pathname) || url.search || url.hash) {
        return json({ error: "Only canonical Za Ndani article URLs may be submitted" }, 400, origin);
      }
      fullUrls.push(url.toString());
    } catch {
      return json({ error: "Invalid article URL" }, 400, origin);
    }
  }

  const results: { url: string; success: boolean; error?: string }[] = [];
  for (const fullUrl of fullUrls) {
    try {
      const indexUrl = \`https://api.indexjump.com/index?url=\${encodeURIComponent(fullUrl)}&token=\${apiKey}\`;
      const response = await fetch(indexUrl);
      if (response.ok) {
        results.push({ url: fullUrl, success: true });
      } else {
        results.push({ url: fullUrl, success: false, error: (await response.text()).slice(0, 300) });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      results.push({ url: fullUrl, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  const successful = results.filter((result) => result.success).length;
  return json({
    success: successful === results.length,
    message: \`Submitted \${successful}/\${results.length} URL(s) to IndexJump\`,
    results,
  }, 200, origin);
});
