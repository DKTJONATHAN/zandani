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

# Years older than the current one that we've actually seen leak through as
# "breaking news" (stale retrospectives, anniversary pieces, reposts with no
# usable publish-date meta). Kept as a belt-and-suspenders check alongside
# the date-based gate below, since many source CMSs omit publish-date meta
# entirely on these pages.
_STALE_YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")


def extract_published_dt(soup) -> Optional["_dt.datetime"]:
    """Best-effort publish-date extraction from a scraped article page.

    Tries, in order: OpenGraph/article meta tags, common non-OG meta names,
    the first <time datetime=\"...\"> tag, and JSON-LD `datePublished`.
    Returns a tz-aware datetime, or None if nothing usable was found.
    """
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


def is_fresh_enough(soup, max_hours: float = 24.0):
    """Fail-closed freshness gate.

    Returns (is_fresh, age_hours). Unlike a bare
    ``if meta and age > max: reject`` check, this treats a page where we
    could not find ANY usable publish-date signal as NOT fresh, rather than
    silently letting it through. That silent pass-through is what let a
    stale, undated retrospective get rewritten and published as breaking
    news. When in doubt, skip the story rather than publish it.
    """
    pt = extract_published_dt(soup)
    if pt is None:
        return False, None
    age_h = (_dt.datetime.now(_dt.timezone.utc) - pt).total_seconds() / 3600
    return age_h <= max_hours, age_h


def mentions_stale_year(text: str, current_year: int) -> bool:
    """Secondary safety net: flag body text that explicitly cites an older
    year (e.g. an anniversary/retrospective piece) and never mentions the
    current year at all. Source CMS date meta is inconsistent enough across
    these sites that a single signal isn't enough on its own.
    """
    if not text:
        return False
    years = {int(y) for y in _STALE_YEAR_RE.findall(text)}
    if not years:
        return False
    if current_year in years:
        return False
    return any(y < current_year for y in years)
