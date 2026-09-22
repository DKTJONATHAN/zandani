import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const USER_AGENT = "Mozilla/5.0 (compatible; ZaNdaniNewsroom/2.0; +https://zandani.co.ke)";

function clean(s: unknown, max = 400) {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function absolute(base: string, value: string) {
  try { return new URL(value, base).toString(); } catch { return ""; }
}

function isBadImage(url: string, alt = "") {
  const s = (url + " " + alt).toLowerCase();
  if (!url || /logo|favicon|sprite|avatar|icon|tracking|pixel|placeholder|default[-_]?og|social[-_]?share|zandani|banner[-_]?ad|advert/.test(s)) return true;
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "").endsWith("zandani.co.ke")) return true;
    if (/\/logo|\/brand|\/favicon|\/icon|\/placeholder/.test(u.pathname.toLowerCase())) return true;
  } catch { return true; }
  return false;
}

async function scrape(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" }, redirect: "follow" });
  if (!res.ok) throw new Error(`source returned HTTP ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("could not parse source HTML");

  const root = doc.querySelector("article,[itemprop='articleBody'],.article-body,.article__body,.entry-content,main") || doc.body;
  const paragraphs = Array.from(root.querySelectorAll("p"))
    .map(p => clean(p.textContent, 1200))
    .filter(p => p.length > 30);
  const body = paragraphs.join("\n\n");
  if (body.length < 500) throw new Error("source article body is too short");

  const publishedRaw =
    doc.querySelector("meta[property='article:published_time']")?.getAttribute("content") ||
    doc.querySelector("meta[name='date']")?.getAttribute("content") ||
    doc.querySelector("time[datetime]")?.getAttribute("datetime") || "";
  if (publishedRaw) {
    const published = new Date(publishedRaw);
    if (!Number.isNaN(published.getTime())) {
      const ageHours = (Date.now() - published.getTime()) / 3600000;
      if (ageHours > 24 || ageHours < -2) throw new Error(`article age ${ageHours.toFixed(1)}h outside freshness window`);
    }
  } else {
    throw new Error("no usable publication date");
  }

  const title =
    clean(doc.querySelector("meta[property='og:title']")?.getAttribute("content")) ||
    clean(doc.querySelector("h1")?.textContent) ||
    clean(doc.title?.split("|")[0]);

  const featured =
    doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
    doc.querySelector("meta[name='twitter:image']")?.getAttribute("content") || "";

  const images: Array<{index:number,url:string,alt:string,caption:string}> = [];
  const seen = new Set<string>();
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src =
      img.getAttribute("data-src") ||
      img.getAttribute("data-lazy-src") ||
      img.getAttribute("data-original") ||
      img.getAttribute("src") || "";
    const u = absolute(url, src);
    const alt = clean(img.getAttribute("alt"), 240);
    if (!u || seen.has(u) || isBadImage(u, alt)) continue;
    const fig = img.closest("figure");
    const caption = clean(fig?.querySelector("figcaption")?.textContent, 300);
    if (!fig && !img.closest("picture") && !/photo|image|media|content/i.test(img.className + " " + img.id)) continue;
    seen.add(u);
    images.push({ index: images.length + 1, url: u, alt, caption });
    if (images.length >= 8) break;
  }

  return { title, body, featured: absolute(url, featured), images };
}

function promptFor(source: any, desk: string, author: string, recentTitles: string[]) {
  return `You are the senior editor for Za Ndani's ${desk} desk.
Write an original publication-ready Kenyan digital-news article from the supplied source material.

NON-NEGOTIABLE GAP RULE:
- The source is research, never a writing template.
- Identify the obvious/commodity framing, then choose ONE concrete editorial gap that is supported by the supplied facts.
- Change the editorial question, not merely the wording.
- Do not copy the source lead, headline logic, paragraph order, subheadings, sentence rhythm, or framing.
- Do not invent quotes, reactions, motives, statistics, dates, consequences or facts.
- Do not present assumptions as reporting.
- Avoid generic AI filler and stock conclusions.
- Keep named people, places, dates and numbers accurate.
- 500-900 words.
- The headline must be specific and materially different from the source headline.
- Use only source-supported image selections.
- If no defensible angle exists, return status "skip".

Return JSON only:
{
  "status":"write"|"skip",
  "skip_reason":"",
  "analysis":{"chosen_angle_gap":"","angle_type":"","opening_pattern":"","structure_pattern":""},
  "images":[{"source_index":1,"reason":"","alt_text":""}],
  "article":{"title":"","description":"","body_markdown":""}
}

Desk style:
${desk === "entertainment" || desk === "showbiz" ? "Lively Kenyan entertainment journalism. Lead with the named celebrity, artist, creator or concrete event. Curiosity must come from a real detail, never manufactured drama." : "Specific reported journalism. Lead with the concrete development and its verified consequence. Avoid vague institutional language."}

Recent Za Ndani titles to avoid repeating:
${recentTitles.slice(-12).map(x => "- " + clean(x, 180)).join("\n") || "- none"}

SOURCE TITLE:
${clean(source.title, 300)}

SOURCE BODY:
${source.body.slice(0, 24000)}

SOURCE IMAGES:
${source.images.map((x:any) => `IMAGE ${x.index}: ${x.url}\nALT: ${x.alt || "(none)"}\nCAPTION: ${x.caption || "(none)"}`).join("\n\n") || "NONE"}
`;
}

Deno.serve(async (req) => {
    const expected = Deno.env.get("SUPABASE_SECRET_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || "";
    const supplied = req.headers.get("apikey") || "";
    if (!expected || supplied !== expected) return Response.json({ error: "unauthorized" }, { status: 401, headers: JSON_HEADERS });
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405, headers: JSON_HEADERS });

    let runId = "";
    try {
      const body = await req.json();
      const desk = clean(body.desk || "news", 40).toLowerCase();
      const author = clean(body.author || "Za Ndani Desk", 120);
      let sourceUrl = clean(body.source_url, 2000);
      const sourceList = clean(body.source_list || "https://www.kenyans.co.ke/news", 2000);
      if (!sourceUrl) {
        const listingRes = await fetch(sourceList, { headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" }, redirect: "follow" });
        if (!listingRes.ok) throw new Error(`source listing returned HTTP ${listingRes.status}`);
        const listingHtml = await listingRes.text();
        const listingDoc = new DOMParser().parseFromString(listingHtml, "text/html");
        const candidates: string[] = [];
        for (const a of Array.from(listingDoc.querySelectorAll("a[href]"))) {
          const href = absolute(sourceList, a.getAttribute("href") || "");
          if (!href || candidates.includes(href)) continue;
          if (/kenyans\.co\.ke\/news\//i.test(href) && !/\/category\/|\/tag\//i.test(href)) candidates.push(href);
          if (candidates.length >= 20) break;
        }
        if (!candidates.length) throw new Error("no article candidates found");
        let selected = "";
        for (const candidate of candidates) {
          try {
            const probe = await scrape(candidate);
            if (probe.body.length >= 500) { selected = candidate; break; }
          } catch {}
        }
        if (!selected) throw new Error("no usable fresh article candidate found");
        sourceUrl = selected;
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      const serviceKey = Deno.env.get("SUPABASE_SECRET_KEY") || keys.default || "";
      if (!serviceKey) throw new Error("Supabase server key is not configured");
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: model } = await admin
        .from("automation_model_versions")
        .select("*")
        .eq("status", "production")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: deskConfig } = await admin.from("automation_desks").select("*").eq("id", desk).maybeSingle();
      const recent = await admin.from("automation_runs").select("article_slug").eq("desk_id", desk).not("article_slug", "is", null).order("created_at", { ascending: false }).limit(12);

      const run = await admin.from("automation_runs").insert({
        desk_id: desk,
        source: "supabase-newsroom-writer",
        status: "running",
        started_at: new Date().toISOString(),
        model_version: model?.version_label || "zandani-gemini-v1",
        prompt_version: deskConfig?.prompt_version || model?.prompt_version || 1,
        gap_version: deskConfig?.gap_version || model?.gap_version || 1,
        image_pipeline_version: deskConfig?.image_pipeline_version || model?.image_pipeline_version || 1,
        source_url: sourceUrl,
        metadata: { engine: "newsroom-writer-v1" }
      }).select("id").single();
      if (run.error || !run.data?.id) throw new Error(`automation_runs insert failed: ${run.error?.message || "unknown database error"}`);
      runId = run.data.id;

      const source = await scrape(sourceUrl);
      const sourceImages = source.images.filter((x:any) => !isBadImage(x.url, x.alt)).slice(0, 3);
      const imgbbKey = Deno.env.get("IMGBB_API_KEY") || "";
      if (imgbbKey) {
        for (const img of sourceImages) {
          try {
            const imgRes = await fetch("https://api.imgbb.com/1/upload", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `key=${encodeURIComponent(imgbbKey)}&image=${encodeURIComponent(img.url)}`
            });
            const imgJson = await imgRes.json();
            if (imgJson?.success && imgJson?.data?.display_url) img.hosted_url = imgJson.data.display_url;
          } catch {}
        }
      }
      source.images = sourceImages;
      const recentTitles = (recent.data || []).map((x:any) => x.article_slug || "").filter(Boolean);

      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
      const modelName = model?.config?.gateway_model || (String(model?.model_name || "").includes("/") ? model.model_name : "google/gemini-3-flash-preview");
      const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: "You are a strict newsroom editor. Output valid JSON only." },
            { role: "user", content: promptFor(source, desk, author, recentTitles) }
          ],
          temperature: 0.7
        })
      });
      if (!ai.ok) {
        const detail = (await ai.text()).slice(0, 600);
        throw new Error(`AI gateway returned HTTP ${ai.status}: ${detail}`);
      }
      const aiJson = await ai.json();
      const raw = aiJson.choices?.[0]?.message?.content || "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI did not return JSON");
      const result = JSON.parse(match[0]);

      if (result.status !== "write") {
        await admin.from("automation_runs").update({ status: "skipped", finished_at: new Date().toISOString(), candidate_count: 1, image_count: 0, metadata: { reason: result.skip_reason || "editorial skip" } }).eq("id", run.data.id);
        return Response.json({ ...result, run_id: run.data.id, model_version: model?.version_label || "zandani-gemini-v1" });
      }

      const chosen = new Set((result.images || []).map((x:any) => Number(x.source_index)));
      const images = source.images.filter((x:any) => chosen.has(x.index) && !isBadImage(x.url, x.alt)).slice(0, 3)
        .map((x:any) => ({ ...x, source_url: x.url, hosted_url: x.hosted_url || "" }));

      const article = result.article || {};
      const title = clean(article.title, 220);
      let markdown = String(article.body_markdown || "").trim();
      const hosted = source.images.filter((x:any) => x.hosted_url || x.url).slice(0, 3);
      const ogImage = hosted[0]?.hosted_url || hosted[0]?.url || "";
      const bodyImages = hosted.slice(1, 3);
      if (bodyImages.length) {
        const paras = markdown.split(/\\n\\s*\\n/);
        const inserts = bodyImages.map((x:any) => `![${clean(x.alt || "Za Ndani image", 180)}](${x.hosted_url || x.url})`);
        if (paras.length > 3) {
          paras.splice(Math.max(2, Math.floor(paras.length / 3)), 0, inserts[0]);
          if (inserts[1]) paras.splice(Math.max(4, Math.floor(paras.length * 2 / 3)), 0, inserts[1]);
          markdown = paras.join("\\n\\n");
        }
      }
      if (!title || markdown.split(/\s+/).length < 220) throw new Error("editorial output failed quality gate");

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      await admin.from("automation_runs").update({
        status: "generated",
        finished_at: new Date().toISOString(),
        article_slug: slug,
        candidate_count: 1,
        image_count: images.length,
        metadata: { source_title: source.title, angle: result.analysis?.chosen_angle_gap || "", engine: "newsroom-writer-v1" }
      }).eq("id", run.data.id);

      return Response.json({
        ok: true,
        run_id: run.data.id,
        model_version: model?.version_label || "zandani-gemini-v1",
        prompt_version: deskConfig?.prompt_version || model?.prompt_version || 1,
        gap_version: deskConfig?.gap_version || model?.gap_version || 1,
        image_pipeline_version: deskConfig?.image_pipeline_version || model?.image_pipeline_version || 1,
        source_url: sourceUrl,
        og_image: ogImage,
        source,
        result: { ...result, article: { ...article, body_markdown: markdown, slug } },
        images
      });
    } catch (e) {
      const message = e instanceof Error ? e.message  : "unknown error";
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
        const serviceKey = Deno.env.get("SUPABASE_SECRET_KEY") || keys.default || "";
        if (runId && supabaseUrl && serviceKey) {
          const admin = createClient(supabaseUrl, serviceKey);
          await admin.from("automation_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", runId);
        }
      } catch {}
      return Response.json({ error: message }, { status: 500, headers: JSON_HEADERS });
    }
});
