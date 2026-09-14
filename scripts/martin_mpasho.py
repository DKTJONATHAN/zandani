#!/usr/bin/env python3
"""Martin Kihara — straight showbiz reporter (Mpasho). No commentary."""
import os, sys, json, re, time, random, hashlib, base64, itertools, datetime, urllib.parse
import requests
from dateutil import parser as date_parser
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


AUTHOR_NAME = "Martin Kihara"
AUTHOR_SLUG = "martin-kihara"
CATEGORY = "Showbiz"
SITE_BASE_URL = "https://zandani.co.ke"
SOURCE_URL = "https://www.mpasho.co.ke/"
SOURCE_DOMAIN = "mpasho.co.ke"
POSTS_DIR = os.environ.get("POSTS_DIR", "content/posts")
MEMORY_FILE = os.environ.get("MEMORY_FILE", ".github/memory_martin_mpasho.json")
MAX_CANDIDATES = 25
MAX_SCRAPE_TRIES = 10
FRESH_HOURS = 12

MODELS_TO_TRY = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
]

UNSPLASH_FALLBACKS = [
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200",
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200",
]

BANNED_PHRASES = [
    "sasa basi", "melting the pot", "spill the tea", "tea is hot", "grab your popcorn",
    "buckle up", "breaking news", "dive in", "delve into", "moreover", "furthermore",
    "in conclusion", "it's worth noting", "a testament to", "navigating the landscape",
    "in today's digital age", "tapestry", "game-changer", "stay tuned", "unpack",
    "is the central subject of the update", "central subject of the update",
    "central to this update", "what this means for kenyans", "what this means for kenya",
    "key takeaway", "search-ready summary",
]

STYLE_PRESETS = [
    {"name": "Hard News Lead", "lead_style": "Who did what, where, when.",
     "tone": "Neutral wire-service. No opinion.", "structure": "Lead, facts by importance, quotes, status"},
    {"name": "Event Report", "lead_style": "Open with the event and principal actor.",
     "tone": "Factual, clipped.", "structure": "Lead, sequence, confirmation, numbers"},
    {"name": "Statement Report", "lead_style": "Official action or statement first.",
     "tone": "Neutral, attribution-heavy.", "structure": "Lead, quote/order, background, response"},
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
    for b in ["Mpasho", "Pulse Live", "Nation.Africa", "Tuko", "Kenyans.co.ke", "Ghafla"]:
        text = re.sub(re.escape(b), "", text, flags=re.I)
    return text

def is_spam(text):
    if not text or len(re.findall(r"\w+", text)) < 200:
        return True
    low = text.lower()
    return any(m in low for m in ["central subject of the update", "what this means for kenyans", "key takeaway"])

def get_target_urls():
    urls = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(SOURCE_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2000)
            html = page.content()
            browser.close()
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.select("a[href]")[:80]:
            href = a.get("href") or ""
            title = a.get_text(" ", strip=True)
            if len(title) < 25 or len(title) > 140:
                continue
            if href.startswith("/"):
                href = urllib.parse.urljoin(SOURCE_URL, href)
            if SOURCE_DOMAIN not in href:
                continue
            if href not in urls:
                urls.append(href)
        return urls[:MAX_CANDIDATES]
    except Exception as e:
        print(f"List scrape error: {e}")
        return []

def scrape_article(url):
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
            return None, None, None
        t = soup.find("title")
        title = t.get_text(strip=True) if t else ""
        for sep in [" | ", " - "]:
            if sep in title:
                title = title.split(sep)[0].strip()
        text = ""
        for sel in ["article", ".post-content", ".entry-content", "main article", ".content", ".article-body"]:
            c = soup.select_one(sel)
            if c:
                text = "\n\n".join(p.get_text(" ", strip=True) for p in c.find_all("p") if len(p.get_text(strip=True)) > 30)
                if len(text) > 400:
                    break
        if len(text) < 400:
            text = "\n\n".join(p.get_text(" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30)
        img = ""
        for m in soup.find_all("meta"):
            prop = m.get("property") or m.get("name") or ""
            if prop in ("og:image", "twitter:image"):
                img = m.get("content", "")
                if img:
                    break
        if mentions_stale_year(text, now_eat.year):
            print("Skipping, source body cites an older year (likely a retrospective/reshare)")
            return None, None, None
        return text, img, title
    except Exception as e:
        print(f"Scrape failed: {e}")
        return None, None, None

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
                config=types.GenerateContentConfig(temperature=0.5, max_output_tokens=4096),
            )
            text = (resp.text or "").strip()
            if text:
                return text, model
        except Exception as e:
            last_err = e
            print(f"Model {model} failed: {e}")
            time.sleep(1)
    raise RuntimeError(f"All models failed: {last_err}")

def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]

def write_post(title, body_md, style_name, source_url, image=""):
    body_md = polish_body(body_md)
    seo = seo_fields(title, body_md, CATEGORY, AUTHOR_NAME)
    if not image:
        image = random.choice(UNSPLASH_FALLBACKS)
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
image: "{image}"
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
    links = get_target_urls()
    if not links:
        print("No links")
        return 0
    style = pick_style(memory.get("style_history", []))
    print(f"Style: {style['name']}")
    for link in links[:MAX_SCRAPE_TRIES]:
        text, img, ttl = scrape_article(link)
        if not text or len(text) < 200:
            continue
        blob = ttl or ""
        if should_skip_story(blob + " " + text, CATEGORY):
            continue
        try:
            prompt = news_prompt(AUTHOR_NAME, full_date_str, style, ttl or "", text, role="correspondent", desk=CATEGORY)
            article, model_used = call_gemini(prompt)
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
        h = content_hash(ttl or link, article)
        if h in memory.get("published_hashes", []):
            print("Duplicate hash, skip")
            continue
        title = ttl or "Kenya showbiz update"
        if article.startswith("#"):
            first = article.split("\n", 1)[0]
            title = re.sub(r"^#+\s*", "", first).strip() or title
            article = article.split("\n", 1)[-1].strip()
        write_post(title, article, style["name"], link, img or "")
        memory.setdefault("published_hashes", []).append(h)
        memory.setdefault("style_history", []).append(style["name"])
        save_memory(memory)
        print("Memory updated")
        return 0
    print("No suitable story published this run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
