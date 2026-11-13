import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://zandani.co.ke";
const ALLOWED_ORIGINS = new Set([SITE, "https://www.zandani.co.ke"]);
const FOOTBALL_API_BASE = "https://api.football-data.org/v4";
const generationLimits = new Map<string, { count: number; resetAt: number }>();

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

function allowGeneration(ip: string) {
  const now = Date.now();
  const current = generationLimits.get(ip);
  if (!current || current.resetAt <= now) {
    generationLimits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "POST required" }, 405, origin);

  try {
    const rawBody = await req.text();
    if (rawBody.length > 12000) return json({ error: "Request is too large" }, 413, origin);

    let body: { type?: string; match?: { id?: unknown } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON request" }, 400, origin);
    }

    const type = body.type;
    if (type !== "review" && type !== "preview") {
      return json({ error: "Only verified match previews and reviews are supported" }, 400, origin);
    }

    const matchIdNumber = Number(body.match?.id);
    if (!Number.isSafeInteger(matchIdNumber) || matchIdNumber <= 0) {
      return json({ error: "A valid football match ID is required" }, 400, origin);
    }

    const footballKey = Deno.env.get("FOOTBALL_DATA_API_KEY") || "";
    if (!footballKey) return json({ error: "Football data verification is not configured" }, 503, origin);

    const matchResponse = await fetch(\`\${FOOTBALL_API_BASE}/matches/\${matchIdNumber}\`, {
      headers: { "X-Auth-Token": footballKey },
      signal: AbortSignal.timeout(8000),
    });
    if (matchResponse.status === 429) return json({ error: "Football data rate limit reached. Try again shortly." }, 429, origin);
    if (!matchResponse.ok) return json({ error: "Could not verify this match with the football data provider" }, 400, origin);

    const matchPayload = await matchResponse.json();
    const verifiedMatch = matchPayload.match || matchPayload;
    const homeName = String(verifiedMatch.homeTeam?.name || "").trim().slice(0, 100);
    const awayName = String(verifiedMatch.awayTeam?.name || "").trim().slice(0, 100);
    const competitionName = String(verifiedMatch.competition?.name || "Football").trim().slice(0, 100);
    const competitionCode = String(verifiedMatch.competition?.code || "").trim().slice(0, 20);
    const utcDate = String(verifiedMatch.utcDate || "");
    const parsedDate = new Date(utcDate);

    if (!verifiedMatch.id || !homeName || !awayName || Number.isNaN(parsedDate.getTime())) {
      return json({ error: "The football data provider returned an incomplete match" }, 502, origin);
    }
    const ageHours = (Date.now() - parsedDate.getTime()) / 3600000;
    if (ageHours > 24 * 14 || ageHours < -24 * 14) {
      return json({ error: "AI analysis is available only for recent and upcoming fixtures" }, 400, origin);
    }
    if (type === "review" && verifiedMatch.status !== "FINISHED") {
      return json({ error: "A match review is available after the match is finished" }, 400, origin);
    }
    if (type === "preview" && ["FINISHED", "CANCELLED", "POSTPONED"].includes(verifiedMatch.status)) {
      return json({ error: "A preview is not available for this match status" }, 400, origin);
    }

    const matchId = String(verifiedMatch.id);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS") || "{}";
    const secretKeys = JSON.parse(secretKeysRaw);
    const supabaseKey = Deno.env.get("SUPABASE_SECRET_KEY") || secretKeys.default || "";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!supabaseUrl || !supabaseKey || !lovableKey) {
      return json({ error: "Sports analysis service is not configured" }, 503, origin);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: cached } = await supabase
      .from("sports_ai_content")
      .select("headline,content")
      .eq("match_id", matchId)
      .eq("content_type", type)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) return json({ headline: cached.headline, content: cached.content, cached: true }, 200, origin);

    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allowGeneration(ip)) {
      return json({ error: "AI analysis limit reached for this hour. Please try again later." }, 429, origin);
    }

    const homeScore = verifiedMatch.score?.fullTime?.home;
    const awayScore = verifiedMatch.score?.fullTime?.away;
    const prompt = type === "review"
      ? \`Write a brief, accurate football match review (2-3 paragraphs) for:
\${homeName} \${homeScore ?? "?"} - \${awayScore ?? "?"} \${awayName}
Competition: \${competitionName}
Date: \${utcDate}

Include the key result, verified talking points, what the result means for both teams, and a forward-looking angle. Do not invent events, scorers or statistics not provided.\`
      : \`Write a concise pre-match preview (2-3 paragraphs) for:
\${homeName} vs \${awayName}
Competition: \${competitionName}
Date: \${utcDate}

Explain what is at stake, the verified context, and two or three factors to watch. Do not invent injuries, line-ups, form or statistics not provided.\`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: \`Bearer \${lovableKey}\`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a careful football journalist. Use only the verified match facts in the prompt. Never invent events, player names or statistics." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      }),
    });

    if (aiResponse.status === 429) return json({ error: "AI rate limit exceeded. Please try again later." }, 429, origin);
    if (aiResponse.status === 402) return json({ error: "AI credits exhausted. Please contact the newsroom." }, 402, origin);
    if (!aiResponse.ok) throw new Error(\`AI API error: \${aiResponse.status}\`);

    const aiData = await aiResponse.json();
    const content = String(aiData.choices?.[0]?.message?.content || "").trim().slice(0, 6000);
    if (!content) throw new Error("AI returned empty content");
    const headline = content.split("\\n").find((line: string) => line.trim())?.replace(/^[#*]+\s*/, "").slice(0, 200) || "Football Update";

    await supabase.from("sports_ai_content").upsert({
      match_id: matchId,
      content_type: type,
      headline,
      content,
      competition_code: competitionCode,
      home_team: homeName,
      away_team: awayName,
      match_date: utcDate,
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "match_id,content_type" });

    return json({ headline, content, cached: false }, 200, origin);
  } catch (error) {
    console.error("Sports AI error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500, origin);
  }
});
