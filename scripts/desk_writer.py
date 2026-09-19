#!/usr/bin/env python3
"""Shared GAP-style writer for non-News desks."""
from __future__ import annotations
import datetime, json, os, re, time
from google import genai
from article_intelligence import format_image_candidates, recent_angle_context
from voice_guard import news_prompt, polish_body, model_skipped, is_spam
STYLE_PRESETS = [{"name":"Personality Lead","tone":"Open on the celebrity, creator or artist and the most interesting verified development.","structure":"Person, hook, verified detail, context, close"},{"name":"What Happened","tone":"Entertainment-first, conversational and specific without gossiping beyond the evidence.","structure":"Hook, what happened, key details, reaction or statement, context, close"},{"name":"Revealed Detail","tone":"Lead with the detail that gives readers a reason to keep reading.","structure":"Revealed detail, evidence, people involved, background, close"},{"name":"Drama & Context","tone":"Capture the human or entertainment tension in the verified facts, then explain what is actually known.","structure":"Tension, facts, quote or action, context, next development"}]
MODELS=["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite","gemini-3.1-pro-preview","gemini-3.1-flash-lite","gemini-3-flash-preview","gemini-2.5-flash"]
def _words(s): return len(re.findall(r"\w+", s or ""))
def _sim(a,b):
    stop={"the","a","an","of","to","in","on","for","and","or","with","from","by","after","over","new","kenya","kenyan"}
    wa={x for x in re.findall(r"[a-z0-9]+",(a or "").lower()) if x not in stop and len(x)>3}
    wb={x for x in re.findall(r"[a-z0-9]+",(b or "").lower()) if x not in stop and len(x)>3}
    return len(wa&wb)/max(1,len(wa|wb))
def _parse(raw):
    raw=(raw or "").strip()
    raw=re.sub(r"^JSON\s*","",raw,flags=re.I)
    m=re.search(r"\{[\s\S]*\}",raw)
    if not m: return None
    try: data=json.loads(m.group(0))
    except Exception: return None
    return data if isinstance(data,dict) else None
def _call(prompt):
    keys=[os.environ.get(k) for k in ("GEMINI_WRITE_KEY","GEMINI_API_KEY","GEMINI_API_KEY1") if os.environ.get(k)]
    if not keys: raise RuntimeError("No Gemini API key configured")
    last=None
    for key in keys:
        client=genai.Client(api_key=key)
        for model in MODELS:
            for _ in range(2):
                try:
                    r=client.models.generate_content(model=model,contents=prompt)
                    out=(r.text or "").strip()
                    if out: return out
                except Exception as e:
                    last=e; msg=str(e).lower()
                    if any(x in msg for x in ("429","quota","rate","503","unavailable","500","overloaded")): time.sleep(3); continue
                    if any(x in msg for x in ("404","not_found","deprecated")): break
                    break
    raise RuntimeError(last or "Gemini returned no usable article")
def generate_article(src,memory,author,role,category):
    history=memory.get("style_history",[]) if isinstance(memory,dict) else []
    style=next((s for s in STYLE_PRESETS if s["name"] not in history[-2:]),STYLE_PRESETS[0])
    prompt=news_prompt(author,datetime.datetime.now(datetime.timezone.utc).strftime("%A, %B %d, %Y"),style,src.get("title",""),src.get("body",""),role=role,desk=category,source_published="",image_candidates=format_image_candidates(src.get("images") or []),recent_angles=recent_angle_context(memory))
    if category.lower() in ("entertainment", "showbiz", "gossip"):
        prompt += """
<ENTERTAINMENT_DESK_RULES>
This is an ENTERTAINMENT desk, not a general news desk.
Write with a Kenyan entertainment-news voice: sharp, lively, human and specific, while staying fully factual.
Titles must feel like entertainment headlines, not institutional news headlines. Prefer a named celebrity, artist or creator plus the revealing action, quote, relationship development, controversy, comeback, reveal, lifestyle detail or unexpected turn.
Do not manufacture drama. The source must support every claim.
Avoid dry institutional constructions unless the story genuinely requires them.
Avoid generic clickbait such as "you won't believe", "shocking", "what happened next", "left fans stunned" or "netizens went wild".
Where supported, use the actual person, relationship, statement, event, money detail, career move or cultural detail as the hook.
The headline should create curiosity through a real detail, not exaggeration.
Do not simply reproduce the source headline. Build a distinct Za Ndani entertainment angle.
</ENTERTAINMENT_DESK_RULES>
"""
    tone_rules = {
        "africa": "Write regional African news with geographic precision. Lead with the most consequential verified fact, name the country/institution/person early, explain Kenya's connection where supported, and avoid generic pan-African filler.",
        "agriculture": "Write practical Kenyan agriculture journalism. Prioritise farmers, prices, production, weather, inputs, markets, policy, technology and livelihoods. Put the useful farming or market consequence behind the story in the headline and lead when supported.",
        "business": "Write sharp Kenyan business journalism. Prioritise money, companies, markets, deals, earnings, regulation, jobs and measurable business impact. Headlines should foreground the concrete commercial development or number, not vague corporate language.",
        "technology": "Write modern Kenyan technology journalism. Explain what changed, who is affected, the product/platform/technology involved and the practical consequence. Use precise product and technical terms without sounding like a press release.",
        "sports": "Write energetic but factual Kenyan sports journalism. Lead with the player/team result, selection, injury, transfer, milestone or decisive moment. Use sport-specific detail and context; do not manufacture drama.",
        "lifestyle": "Write useful Kenyan lifestyle and culture journalism. Lead with the person, place, trend, experience or practical detail that makes the story useful or interesting. Keep it vivid but factual.",
        "opinions": "Write a clearly signposted opinion piece. Distinguish sourced facts from the columnist's argument, make the thesis concrete, test it against a counterpoint, and avoid presenting opinion as reported fact.",
        "entertainment": "Write Kenyan entertainment journalism with a lively, human voice. Lead with the named artist, celebrity, creator, event, relationship, statement, career move or revealing detail. Curiosity must come from a real fact, never manufactured drama.",
        "showbiz": "Write Kenyan showbiz journalism with a lively, human voice. Lead with the named celebrity, artist or creator and the concrete development readers actually care about. Avoid generic celebrity-news phrasing.",
        "gossip": "Write factual Kenyan celebrity/gossip journalism. Use the verified personal development, statement or public event as the hook without inventing motives, reactions or drama.",
    }
    prompt += "\n<DESK_TONE_RULES>\n" + tone_rules.get(category.lower(), "Write specific Kenyan digital journalism: concrete names, actions, numbers, places and consequences; avoid vague summaries.") + "\n</DESK_TONE_RULES>\n"
    prompt += "\n<DESK_GAP_REQUIREMENT>Use the same GAP/angle-gap discipline as Za Ndani News. Open on one concrete editorial gap, not a vague summary. Keep supported names, dates, places, numbers and actions. Do not invent reactions, motives, quotes or consequences. Write 500-900 words with a strong lead, factual development and concrete close. For entertainment, stay specific to the people and event actually supported by the source. Avoid generic filler such as fans are excited, the industry is watching, or this has sparked conversations. Return the required strict JSON schema only.</DESK_GAP_REQUIREMENT>\n"
    for retry in range(3):
        p=prompt if not retry else prompt+"\n<EDITORIAL_RETRY>Choose a materially different, concrete GAP and rebuild the article around it.</EDITORIAL_RETRY>"
        data=_parse(_call(p))
        if not data or str(data.get("status","write")).lower()=="skip": continue
        art=data.get("article") if isinstance(data.get("article"),dict) else {}
        body=polish_body(str(art.get("body_markdown") or "")); title=str(art.get("title") or src.get("title") or "").strip()
        analysis=data.get("analysis") if isinstance(data.get("analysis"),dict) else {}
        angle=str(analysis.get("chosen_angle_gap") or "").strip()
        if not title or _words(body)<220 or model_skipped(body) or is_spam(body) or not angle: continue
        source_title=str(src.get("title") or "").strip()
        if source_title and _sim(title,source_title) > 0.92:
            continue
        if category.lower() in ("entertainment","showbiz","gossip") and title.lower().strip(" .!?") in ("latest news","breaking news","kenya news","entertainment news","celebrity news"):
            continue
        recent_titles=[x.get("title","") for x in memory.get("published_angles",[]) if isinstance(x,dict)]
        if any(_sim(title,t)>0.82 for t in recent_titles[-12:]): continue
        return {"title":title,"body":body,"analysis":analysis,"style":style}
    raise RuntimeError("No usable GAP-style article generated")
def record_angle(memory,result,source_url):
    memory.setdefault("published_angles",[]).append({"title":result.get("title",""),"angle":str(result.get("analysis",{}).get("chosen_angle_gap","")),"angle_type":str(result.get("analysis",{}).get("angle_type","")),"opening":str(result.get("analysis",{}).get("opening_pattern","")),"structure":str(result.get("analysis",{}).get("structure_pattern","")),"source":source_url})
    memory["published_angles"]=memory["published_angles"][-100:]