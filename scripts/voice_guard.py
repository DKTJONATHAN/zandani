#!/usr/bin/env python3
"""Kenya-first voice, GEO/SEO and skip rules for every Za Ndani desk."""
from __future__ import annotations

import datetime as _dt
import json as _json
import re
from typing import Optional

try:
    from dateutil import parser as _date_parser
except ImportError:  # pragma: no cover - dateutil is a pipeline dependency
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
    hits = sum(1 for p in BANNED_PHRASES if p in low)
    return hits >= 3


def kenya_score(text: str) -> int:
    blob = text or ""
    score = len(KENYA_HINTS.findall(blob)) * 3
    score -= len(FOREIGN_HINTS.findall(blob)) * 2
    return score


def should_skip_story(text: str, category: str = "") -> bool:
    blob = text or ""
    if kenya_score(blob) <= 0 and FOREIGN_HINTS.search(blob):
        return True
    return False


def model_skipped(text: str) -> bool:
    t = text or ""
    if re.search(r"SKIP:\s*NO UNIQUE ANGLE", t, re.I):
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
) -> str:
    style_name = style.get("name") if isinstance(style, dict) else str(style)
    tone = style.get("tone", "") if isinstance(style, dict) else ""
    structure = style.get("structure", "") if isinstance(style, dict) else ""
    mode = "opinion column" if opinion else "news report"
    avoid_line = f"Avoid repeating these recent angles: {avoid}" if avoid else ""
    know = (
        "Do NOT include a 'What we know' section. This is not a hard-news brief."
        if opinion or (desk or "").lower() in {"opinions", "opinion", "lifestyle", "entertainment", "gossip"}
        else (
            "After the lede, add a '### What we know' section with 3-5 short bullets.\n"
            "Each bullet must be an ORIGINAL editorial commentary line that synthesises "
            "context for a busy reader (who / what shifted / why it matters).\n"
            "Rules for the bullets:\n"
            "- Do NOT copy or lightly rephrase sentences from the article body.\n"
            "- Write like a desk editor briefing a colleague.\n"
            "- One idea per bullet, 12-28 words, end with a period.\n"
            "- No first person, no clickbait."
        )
    )
    return f"""You are {author}, {role} for Za Ndani ({desk}).
Date: {date_str}
Mode: {mode}
Style: {style_name}. Tone: {tone}. Structure: {structure}.
Write original Kenyan-first {mode} in clean Markdown. No brand names of rival outlets.
{know}
{avoid_line}

UNIQUENESS GATE:
The source below is a tip sheet, not a draft. Nation, Standard, Citizen and Tuko likely already ran the same facts.
Do not rewrite their lede, quote stack or paragraph order.
Before writing, name one unused angle: cost to a Nairobi reader this week; what the circular/gazette/fixture actually changes; the official line that does not add up; the question the presser skipped; second-day consequence.
If you cannot name that angle, output only: SKIP: NO UNIQUE ANGLE
Never invent quotes, crowds or official comments.
Do not open with the source headline restated.

SOURCE TITLE: {title}
SOURCE BODY:
{body[:3500]}

Output the article only. Start with a sharp lede that is NOT the source lede (no H1 title line)."""


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
    if re.search(r"what we know", source, re.I):
        lines = source.splitlines()
        out = []
        skipping = False
        for line in lines:
            stripped = line.strip()
            if re.match(r"^#{2,3}\s*What we know:?\s*$", stripped, re.I):
                skipping = True
                continue
            if skipping:
                if not stripped or stripped.startswith(("-", "*", "+")):
                    continue
                if re.match(r"^#{2,3}\s+", stripped):
                    skipping = False
                    out.append(line)
                    continue
                skipping = False
                out.append(line)
                continue
            out.append(line)
        source = "\n".join(out)
    source = re.sub(r"(?im)^\s*what we know\b[:\-\u2013\u2014]?\s*", "", source)
    plain = re.sub(r"[#*_>`]", "", source)
    plain = re.sub(r"\s+", " ", plain).strip()
    plain = re.sub(
        r"^([a-z0-9][a-z0-9\s\-]{8,80}?):\s+",
        "",
        plain,
        count=1,
        flags=re.I,
    )
    sentences = re.split(r"(?<=[.!?])\s+", plain)
    lede = ""
    for s in sentences:
        s = s.strip()
        if len(s) < 40:
            continue
        if re.match(r"^(what we know|key takeaway|in conclusion)\b", s, re.I):
            continue
        if s.count(" ") < 4 and ":" in s[:40]:
            continue
        lede = s
        break
    if not lede:
        lede = plain
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
    cat = (category or "").strip().lower()
    if cat in {"opinion", "opinions", "lifestyle", "gossip", "entertainment", "showbiz", "celebrity", "sports"}:
        return False
    if cat not in {"news", "politics", "business"}:
        return False
    if re.match(r"^(why|how|opinion)\b", (title or "").strip(), re.I):
        return False
    return True


def strip_know_block(body: str) -> str:
    if not re.search(r"what we know", body or "", re.I):
        return body or ""
    lines = (body or "").splitlines()
    out: list[str] = []
    skipping = False
    for line in lines:
        stripped = line.strip()
        if re.match(r"^#{2,3}\s*What we know:?\s*$", stripped, re.I):
            skipping = True
            continue
        if skipping:
            if not stripped or stripped.startswith(("-", "*", "+")):
                continue
            if re.match(r"^#{2,3}\s+", stripped):
                skipping = False
                out.append(line)
                continue
            skipping = False
            out.append(line)
            continue
        out.append(line)
    return "\n".join(out).strip() + "\n"


def inject_know_if_missing(body: str, category: str = "News", title: str = "") -> str:
    if not should_have_know(category, title):
        return strip_know_block(body or "")
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


def polish_body(body: str, category: str = "News", title: str = "") -> str:
    cleaned = strip_date_lede(strip_banned(body or ""))
    return inject_know_if_missing(cleaned, category, title)
