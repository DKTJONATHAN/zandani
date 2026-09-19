#!/usr/bin/env python3
"""Shared GAP-style writer for non-News desks."""
from __future__ import annotations
import datetime, json, os, re, time
from google import genai
from article_intelligence import format_image_candidates, recent_angle_context
from voice_guard import news_prompt, polish_body, model_skipped, is_spam
STYLE_PRESETS = [{"name":"Hard News Lead","tone":"Reported fact, then a pointed close.","structure":"Lead, facts, quotes, commentary"},{"name":"Event Report","tone":"Factual, then street-level reading.","structure":"Lead, sequence, numbers, commentary"},{"name":"Statement Report","tone":"Attribution first, then who benefits.","structure":"Lead, quote, background, commentary"},{"name":"Desk Take","tone":"Curious, specific.","structure":"Lead, evidence, names, commentary"}]
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
    prompt=news_prompt(author,datetime.datetime.now(datetime.timezone.utc).strftime("%A, %B %d, %Y"),style,src.get("title",""),src.get("body",""),role="correspondent",desk=category,source_published="",image_candidates=format_image_candidates(src.get("images") or []),recent_angles=recent_angle_context(memory))
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
        recent_titles=[x.get("title","") for x in memory.get("published_angles",[]) if isinstance(x,dict)]
        if any(_sim(title,t)>0.82 for t in recent_titles[-12:]): continue
        return {"title":title,"body":body,"analysis":analysis,"style":style}
    raise RuntimeError("No usable GAP-style article generated")
def record_angle(memory,result,source_url):
    memory.setdefault("published_angles",[]).append({"title":result.get("title",""),"angle":str(result.get("analysis",{}).get("chosen_angle_gap","")),"angle_type":str(result.get("analysis",{}).get("angle_type","")),"opening":str(result.get("analysis",{}).get("opening_pattern","")),"structure":str(result.get("analysis",{}).get("structure_pattern","")),"source":source_url})
    memory["published_angles"]=memory["published_angles"][-100:]