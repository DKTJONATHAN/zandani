#!/usr/bin/env python3
"""Kenya-first voice, GEO/SEO and skip rules for every Za Ndani desk."""
from __future__ import annotations

import datetime as _dt
import json as _json
import re
from pathlib import Path as _Path
from typing import Optional

try:
    from dateutil import parser as _date_parser
except ImportError:
    _date_parser = None

_STALE_YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")


def extract_published_dt(soup) -> Optional["_dt.datetime"]:
    if soup is None or _date_parser is None:
        return None
    candidates = []
    for prop in ("article:published_time", "og:published_time", "article:modified_time"):
        tag = soup.find("meta", property=prop)
        if tag and tag.get("content"):
            candidates.append(tag["content"])
    for name in ("date", "pubdate", "publish-date", "sailthru.date", "parsely-pub-date", "publishdate"):
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            candidates.append(tag["content"])
    time_tag = soup.find("time")
    if time_tag and time_tag.get("datetime"):
        candidates.append(time_tag["datetime"])
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = _json.loads(script.string or "")
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("datePublished"):
                candidates.append(item["datePublished"])
    for raw in candidates:
        try:
            pt = _date_parser.parse(raw)
            if pt.tzinfo is None:
                pt = pt.replace(tzinfo=_dt.timezone.utc)
            return pt
        except Exception:
            continue
    return None


def is_fresh_enough(soup, max_hours: int = 24):
    pt = extract_published_dt(soup)
    if pt is None:
        return False, None
    age_h = (_dt.datetime.now(_dt.timezone.utc) - pt).total_seconds() / 3600
    return age_h <= max_hours, age_h


def mentions_stale_year(text: str, current_year: int) -> bool:
    if not text:
        return False
    years = {int(y) for y in _STALE_YEAR_RE.findall(text)}
    if not years:
        return False
    if current_year in years:
        return False
    return any(y < current_year for y in years)


BANNED_PHRASES = [
    "sasa basi", "melting the pot", "spill the tea", "tea is hot", "grab your popcorn",
    "buckle up", "breaking news", "dive in", "delve into", "moreover", "furthermore",
    "in conclusion", "it's worth noting", "a testament to", "navigating the landscape",
    "in today's digital age", "tapestry", "game-changer", "stay tuned", "unpack",
    "is the central subject of the update", "central subject of the update",
    "central to this update", "search-ready summary", "key takeaway",
    "what this means for kenyans", "what this means for kenya",
]

KENYA_HINTS = re.compile(
    r"\b(kenya|kenyan|nairobi|mombasa|kisumu|nakuru|eldoret|ruto|gachagua|raila|"
    r"safaricom|m-?pesa|iebc|odm|uda|azimio|westlands|kasarani|kiambu|kakamega)\b",
    re.I,
)

FOREIGN_HINTS = re.compile(
    r"\b(trump|biden|white house|westminster|premier league only|tokyo|"
    r"los angeles|new york times|tokyo stock exchange)\b",
    re.I,
)


def strip_banned(text: str) -> str:
    if not text:
        return text or ""
    out = text
    for p in BANNED_PHRASES:
        out = re.sub(re.escape(p), "", out, flags=re.I)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


def is_spam(text: str, min_words: int = 120) -> bool:
    words = re.findall(r"\w+", text or "")
    if len(words) < min_words:
        return True
    low = (text or "").lower()
    return sum(1 for p in BANNED_PHRASES if p in low) >= 3


def kenya_score(text: str) -> int:
    blob = text or ""
    return len(KENYA_HINTS.findall(blob)) * 3 - len(FOREIGN_HINTS.findall(blob)) * 2


def should_skip_story(text: str, category: str = "") -> bool:
    blob = text or ""
    return kenya_score(blob) <= 0 and bool(FOREIGN_HINTS.search(blob))


def model_skipped(text: str) -> bool:
    t = text or ""
    if re.search(r"^SKIP:", t.strip(), re.I):
        return True
    if len(t) < 180 and re.search(r"\b(skip|not kenya|cannot rewrite|refuse)\b", t, re.I):
        return True
    return False


def news_prompt(
    author: str,
    date_str: str,
    style,
    title: str,
    body: str,
    role: str = "correspondent",
    opinion: bool = False,
    desk: str = "News",
    avoid: str = "",
    source_published: str = "",
) -> str:
    prompt_file = _Path(__file__).with_name("zandani_writer_prompt.txt")
    master = prompt_file.read_text(encoding="utf-8") if prompt_file.is_file() else ""
    if "<SYSTEM_PROMPT>" not in master:
        raise RuntimeError("scripts/zandani_writer_prompt.txt missing or invalid")
    style_name = style.get("name") if isinstance(style, dict) else str(style)
    tone = style.get("tone", "") if isinstance(style, dict) else ""
    structure = style.get("structure", "") if isinstance(style, dict) else ""
    mode = "opinion column" if opinion else "news report"
    avoid_line = f"Avoid repeating these recent framings already used on this desk: {avoid}" if avoid else ""
    return (
        master
        + "\n<INPUT>\n"
        + f"Desk: {desk}\n"
        + f"Author: {author}\n"
        + f"Role: {role}\n"
        + f"Date: {date_str}\n"
        + f"Mode: {mode}\n"
        + f"House style: {style_name}. Tone: {tone}. Structure: {structure}.\n"
        + f"{avoid_line}\n"
        + f"Source published/updated: {source_published or 'not supplied — workflow already applied the 24-hour gate'}\n"
        + f"SOURCE TITLE: {title}\n"
        + "SOURCE BODY:\n"
        + f"{body[:3500]}\n"
        + "</INPUT>\n"
    )


def guess_county(text: str) -> str:
    low = (text or "").lower()
    for name in ("Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Kiambu", "Kakamega", "Kisii", "Meru"):
        if name.lower() in low:
            return name
    return "Nairobi"


def seo_fields(title: str, body: str, category: str, author: str) -> dict:
    clean = re.sub(r"^#+\s*", "", title or "").strip()
    clean = re.sub(r"\s+", " ", clean)
    clean = re.sub(r"\s*[|:\-\u2013\u2014\u2026]+\s*$", "", clean).strip()
    if len(clean) > 100:
        cut = clean[:101]
        m = list(re.finditer(r"\b(?:after|amid|over|as|for|from|with|on|in|at|and|to)\b", cut, flags=re.I))
        if m and m[-1].start() >= 40:
            clean = cut[: m[-1].start()].strip(" .,:;!-")
        else:
            clean = cut.rsplit(" ", 1)[0].strip(" .,:;!-")
    source = body or ""
    plain = re.sub(r"[#*_>`]", "", source)
    plain = re.sub(r"\s+", " ", plain).strip()
    sentences = re.split(r"(?<=[.!?])\s+", plain)
    lede = next((s.strip() for s in sentences if len(s.strip()) >= 40), plain)
    if lede and lede[0].islower():
        lede = lede[0].upper() + lede[1:]
    desc = lede[:155]
    if len(lede) > 155:
        desc = desc.rsplit(" ", 1)[0].rstrip(".,:;") + "."
    if len(desc) < 90:
        desc = (desc.rstrip(".") + " Coverage from Nairobi, Kenya.")[:155]
    excerpt = desc.replace('"', "'")
    return {
        "title": clean.replace('"', "'"),
        "description": desc.replace('"', "'"),
        "excerpt": excerpt,
        "schema": "NewsArticle",
        "category": category,
        "author": author,
        "county": guess_county(title + " " + body),
    }


def should_have_know(category: str = "", title: str = "") -> bool:
    return False


def strip_know_block(body: str) -> str:
    return body or ""


def inject_know_if_missing(body: str, category: str = "News", title: str = "") -> str:
    return body or ""


def strip_date_lede(body: str) -> str:
    if not body:
        return body or ""
    return re.sub(
        r'^(On\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)'
        r'[^\n.]{0,80}\.\s*)',
        "",
        body.strip(),
        count=1,
        flags=re.I,
    )


def unwrap_writer_json(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
        raw = re.sub(r"\s*```$", "", raw)
    blob = raw
    if not blob.startswith("{"):
        m = re.search(r"\{[\s\S]*\}", blob)
        if not m:
            return text or ""
        blob = m.group(0)
    try:
        data = _json.loads(blob)
    except Exception:
        return text or ""
    if not isinstance(data, dict):
        return text or ""
    art = data.get("article") if isinstance(data.get("article"), dict) else {}
    status = str(data.get("status") or "").strip().lower()
    skip_reason = str(data.get("skip_reason") or "").strip()
    body = str(art.get("body_markdown") or art.get("body") or "").strip()
    title = str(art.get("title") or "").strip()
    if status == "skip" or (not body and skip_reason):
        return f"SKIP: {skip_reason or 'unusable source'}"
    if not body:
        return text or ""
    if title:
        return f"# {title}\n\n{body}"
    return body


def polish_body(body: str, category: str = "News", title: str = "") -> str:
    body = unwrap_writer_json(body or "")
    return strip_date_lede(strip_banned(body))
