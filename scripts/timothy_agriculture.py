#!/usr/bin/env python3
"""Timothy Muli — straight agriculture reporter. No commentary."""
import os, sys, json, re, time, random, hashlib, datetime, urllib.parse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types

try:
    from voice_guard import news_prompt, should_skip_story, strip_banned, inject_know_if_missing, seo_fields, polish_body, model_skipped, is_fresh_enough, mentions_stale_year
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from voice_guard import news_prompt, should_skip_story, strip_banned, inject_know_if_missing, seo_fields, polish_body, model_skipped, is_fresh_enough, mentions_stale_year


AUTHOR_NAME = "Timothy Muli"
CATEGORY = "Agriculture"
SOURCE_URL = "https://www.kenyans.co.ke/"
SOURCE_DOMAIN = "kenyans.co.ke"
POSTS_DIR = os.environ.get("POSTS_DIR", "content/posts")
MEMORY_FILE = os.environ.get("MEMORY_FILE", ".github/memory_timothy.json")

MODELS_TO_TRY = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
]

BANNED_PHRASES = [
    "sasa basi", "melting the pot", "spill the tea", "dive in", "delve into",
    "moreover", "furthermore", "in conclusion", "it's worth noting",
    "a testament to", "navigating the landscape", "in today's digital age",
    "tapestry", "game-changer", "stay tuned", "unpack",
    "is central to this update for kenyan readers",
    "is the central subject of the update", "central subject of the update",
    "central to this update", "what this means for kenyans", "what this means for kenya",
    "key takeaway", "search-ready summary", "in a significant development",
    "sparking debate", "raising questions", "underscores the need",
    "only time will tell", "the bigger picture", "it remains to be seen",
    "this development comes as", "what this means for farmers right now",
]

STYLE_PRESETS = [
    {"name": "Hard News Lead", "lead_style": "Who did what, where, when.",
     "tone": "Neutral wire-service. No opinion.", "structure": "Lead, facts by importance, quotes, status"},
    {"name": "Market Report", "lead_style": "Open with the price, harvest or policy move.",
     "tone": "Factual, clipped.", "structure": "Lead, sequence, confirmation, numbers"},
    {"name": "Statement Report", "lead_style": "Official action or statement first.",
     "tone": "Neutral, attribution-heavy.", "structure": "Lead, quote/order, background, response"},
]

BRANDS_TO_SCRUB = [
    "Kenyans.co.ke", "Daily Nation", "Nation.Africa", "The Standard", "Standard Media",
    "Citizen Digital", "Tuko", "Pulse Live", "Capital FM", "K24", "NTV Kenya", "KTN News",
    "BBC", "CNN", "Reuters", "Al Jazeera", "Smart Farmer Kenya",
]

now_utc = datetime.datetime.utcnow()
now_eat = now_utc + datetime.timedelta(hours=3)
publish_ts = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
today_str = now_eat.strftime("%Y-%m-%d")
full_date_str = now_eat.strftime("%A, %B %d, %Y")


def load_memory():
    empty = {"published_hashes": [], "style_history": []}
    if not os.path.exists(MEMORY_FILE):
        return empty
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, list):
            empty["published_hashes"] = raw[-500:]
            return empty
        if isinstance(raw, dict):
            raw.setdefault("published_hashes", [])
            raw.setdefault("style_history", [])
            return raw
    except Exception as e:
        print(f"Memory load error: {e}")
    return empty


def save_memory(mem):
    os.makedirs(os.path.dirname(MEMORY_FILE) or ".", exist_ok=True)
    mem["published_hashes"] = mem.get("published_hashes", [])[-500:]
    mem["style_history"] = mem.get("style_history", [])[-30:]
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(mem, f, indent=2)


def pick_style(history):
    recent = set(list(history)[-2:])
    c = [s for s in STYLE_PRESETS if s["name"] not in recent] or STYLE_PRESETS
    return random.choice(c)


def content_hash(title, body):
    raw = (title + "|" + body[:800]).lower()
    raw = re.sub(r"\s+", " ", raw)
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def scrub_brands(text):
    for b in BRANDS_TO_SCRUB:
        text = re.sub(re.escape(b), "", text, flags=re.I)
    return text


def strip_spam(text):
    if not text:
        return text
    text = re.sub(r"[^.\n]*is central to this update for Kenyan readers[.\s]*", "", text, flags=re.I)
    text = re.sub(r"[^.\n]*is the central subject of the update[.\s]*", "", text, flags=re.I)
    text = re.sub(r"[^.\n]*central subject of the update[.\s]*", "", text, flags=re.I)
    text = re.sub(r"[^.\n]*central to this update[.\s]*", "", text, flags=re.I)
    return text.strip()


def is_spam(text):
    if not text:
        return True
    low = text.lower()
    markers = [
        "is the central subject of the update", "central subject of the update",
        "central to this update", "what this means for kenyans", "key takeaway",
        "it remains to be seen",
    ]
    if any(m in low for m in markers):
        return True
    if re.search(r"##\s*analysis\b", text, re.I):
        return True
    if any(p in low for p in BANNED_PHRASES):
        return True
    if len(re.findall(r"\w+", text)) < 280:
        return True
    return False


def scrape_source():
    stories = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(SOURCE_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)
            html = page.content()
            browser.close()
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.select("a[href]")[:80]:
            href = a.get("href") or ""
            title = a.get_text(" ", strip=True)
            if len(title) < 25 or len(title) > 140:
                continue
            if not any(x in href for x in ["/20", "article", "news", "story", "post"]):
                continue
            if href.startswith("/"):
                href = urllib.parse.urljoin(SOURCE_URL, href)
            if SOURCE_DOMAIN not in href:
                continue
            stories.append({"title": title, "url": href})
        seen = set()
        uniq = []
        for s in stories:
            if s["url"] in seen:
                continue
            seen.add(s["url"])
            uniq.append(s)
        return uniq[:12]
    except Exception as e:
        print(f"Scrape error: {e}")
        return []


FRESH_HOURS = 24


def fetch_article(url):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=40000)
            page.wait_for_timeout(1500)
            html = page.content()
            browser.close()
        soup = BeautifulSoup(html, "html.parser")

        fresh, age_h = is_fresh_enough(soup, max_hours=FRESH_HOURS)
        if not fresh:
            if age_h is None:
                print("Skipping, no usable publish-date signal found (fail-closed)")
            else:
                print(f"Skipping, age {age_h:.1f}h")
            return ""

        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()
        paragraphs = [p.get_text(" ", strip=True) for p in soup.select("p") if len(p.get_text(strip=True)) > 40]
        body = "\n\n".join(paragraphs[:18])
        body = scrub_brands(body)[:6000]
        if mentions_stale_year(body, now_eat.year):
            print("Skipping, source body cites an older year (likely a retrospective/reshare)")
            return ""
        return body
    except Exception as e:
        print(f"Fetch article error: {e}")
        return ""


def call_gemini(prompt):
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_WRITE_KEY")
    if not api_key:
        raise RuntimeError("No GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    last_err = None
    for model in MODELS_TO_TRY:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.4, max_output_tokens=4096),
            )
            text = (resp.text or "").strip()
            if text:
                return text, model
        except Exception as e:
            last_err = e
            print(f"Model {model} failed: {e}")
            time.sleep(1)
    raise RuntimeError(f"All models failed: {last_err}")


def build_prompt(story, source_body, style):
    return news_prompt(AUTHOR_NAME, full_date_str, style, story.get("title",""), source_body, role="correspondent", desk=CATEGORY)


def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]


def write_post(title, body_md, style_name, source_url):
    body_md = polish_body(body_md)
    seo = seo_fields(title, body_md, CATEGORY, AUTHOR_NAME)
    slug = f"{today_str}-{slugify(seo['title'])}"
    path = os.path.join(POSTS_DIR, f"{slug}.md")
    os.makedirs(POSTS_DIR, exist_ok=True)
    fm = f"""---
title: "{seo['title']}"
slug: "{slugify(seo['title'])}"
description: "{seo['description']}"
excerpt: "{seo['excerpt']}"
date: {publish_ts}
dateModified: {publish_ts}
author: "{AUTHOR_NAME}"
category: "{CATEGORY}"
county: "{seo['county']}"
image: ""
readTime: {max(3, len(body_md.split()) // 180)}
source: "{source_url}"
stylePreset: "{style_name}"
schema: "NewsArticle"
---

{body_md}
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(fm)
    print(f"Wrote {path}")
    return slug


def main():
    memory = load_memory()
    print(f"[{AUTHOR_NAME}] hard-news run @ {publish_ts}")
    stories = scrape_source()
    if not stories:
        print("No stories found")
        return 0
    style = pick_style(memory.get("style_history", []))
    print(f"Style: {style['name']}")
    for story in stories:
        blob = story.get("title", "")
        if should_skip_story(blob, CATEGORY):
            print(f"Skip (not Kenya-first): {blob[:80]}")
            continue
        body = fetch_article(story["url"])
        if len(body) < 200:
            continue
        if should_skip_story(blob + " " + body, CATEGORY):
            print(f"Skip body (not Kenya-first): {blob[:80]}")
            continue
        try:
            article, model_used = call_gemini(build_prompt(story, body, style))
            print(f"Used {model_used}")
        except Exception as e:
            print(f"Generation failed: {e}")
            continue
        if model_skipped(article):
            print("Model skipped foreign story")
            continue
        article = polish_body(scrub_brands(article))
        if is_spam(article):
            print("Rejected: spam or too short")
            continue
        h = content_hash(story["title"], article)
        if h in memory.get("published_hashes", []):
            print("Duplicate hash, skip")
            continue
        title = story["title"]
        if article.startswith("#"):
            first = article.split("\n", 1)[0]
            title = re.sub(r"^#+\s*", "", first).strip() or title
            article = article.split("\n", 1)[-1].strip()
        write_post(title, article, style["name"], story["url"])
        memory.setdefault("published_hashes", []).append(h)
        memory.setdefault("style_history", []).append(style["name"])
        save_memory(memory)
        print("Memory updated")
        return 0
    print("No suitable story published this run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
