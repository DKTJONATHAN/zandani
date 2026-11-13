import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SITE = "https://zandani.co.ke";
const ALLOWED_ORIGINS = new Set([SITE, "https://www.zandani.co.ke"]);
const FOOTBALL_API_BASE = "https://api.football-data.org/v4";
const COMPETITIONS: Record<string, string> = {
  PL: "Premier League",
  PD: "La Liga",
  SA: "Serie A",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
};
const requestLimits = new Map<string, { count: number; resetAt: number }>();

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(data: unknown, status: number, origin: string | null, cache = false) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      ...(cache ? { "Cache-Control": "public, max-age=20, s-maxage=20" } : {}),
    },
  });
}

function allowRequest(ip: string) {
  const now = Date.now();
  const current = requestLimits.get(ip);
  if (!current || current.resetAt <= now) {
    requestLimits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (current.count >= 120) return false;
  current.count += 1;
  return true;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "GET") return json({ error: "GET required" }, 405, origin);

  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) return json({ error: "Request limit reached. Please retry shortly." }, 429, origin);

  try {
    const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY") || "";
    if (!apiKey) return json({ error: "Football data is not configured" }, 503, origin);

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "matches";
    const competition = url.searchParams.get("competition") || "PL";
    const matchId = url.searchParams.get("matchId") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";

    if (!["matches", "standings", "match", "competition", "scorers"].includes(endpoint)) {
      return json({ error: "Unsupported football data endpoint" }, 400, origin);
    }
    if (competition !== "ALL" && !Object.hasOwn(COMPETITIONS, competition)) {
      return json({ error: "Unsupported competition" }, 400, origin);
    }

    let apiUrl = "";
    switch (endpoint) {
      case "matches":
        apiUrl = competition === "ALL"
          ? \`\${FOOTBALL_API_BASE}/matches\`
          : \`\${FOOTBALL_API_BASE}/competitions/\${competition}/matches\`;
        if (dateFrom || dateTo) {
          if (!validDate(dateFrom) || !validDate(dateTo)) {
            return json({ error: "Both dates must use YYYY-MM-DD format" }, 400, origin);
          }
          const span = Math.abs(new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000;
          if (span > 14) return json({ error: "Date range cannot exceed 14 days" }, 400, origin);
          apiUrl += \`?dateFrom=\${dateFrom}&dateTo=\${dateTo}\`;
        }
        break;
      case "standings":
        if (competition === "ALL") return json({ error: "Choose a specific competition for standings" }, 400, origin);
        apiUrl = \`\${FOOTBALL_API_BASE}/competitions/\${competition}/standings\`;
        break;
      case "match":
        if (!/^\d{1,12}$/.test(matchId)) return json({ error: "A numeric match ID is required" }, 400, origin);
        apiUrl = \`\${FOOTBALL_API_BASE}/matches/\${matchId}\`;
        break;
      case "competition":
        if (competition === "ALL") return json({ error: "Choose a specific competition" }, 400, origin);
        apiUrl = \`\${FOOTBALL_API_BASE}/competitions/\${competition}\`;
        break;
      case "scorers":
        if (competition === "ALL") return json({ error: "Choose a specific competition for scorers" }, 400, origin);
        apiUrl = \`\${FOOTBALL_API_BASE}/competitions/\${competition}/scorers\`;
        break;
    }

    const response = await fetch(apiUrl, {
      headers: { "X-Auth-Token": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Football data provider rate limit reached" }, 429, origin);
      return json({ error: \`Football data provider returned HTTP \${response.status}\` }, response.status, origin);
    }

    const data = await response.json();
    return json({
      data,
      competitions: COMPETITIONS,
      timestamp: new Date().toISOString(),
    }, 200, origin, true);
  } catch (error) {
    console.error("Football data error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500, origin);
  }
});
