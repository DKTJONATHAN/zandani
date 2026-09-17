"""Shared scrape + rewrite pipeline for Zandani category writers.
Kenya-first hard news. Voice, GEO and skip rules live in voice_guard.
"""
import os, json, re, time, random, hashlib, datetime, urllib.parse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types
from voice_guard import (
    BANNED_PHRASES,
    inject_know_if_missing,
    is_fresh_enough,
    is_spam,
    kenya_score,
    mentions_stale_year,
    model_skipped,
    news_prompt,
    polish_body,
    seo_fields,
    should_skip_story,
    strip_banned,
)

FRESH_HOURS = int(os.environ.get("FRESH_HOURS") or os.environ.get("WRITER_MAX_AGE_HOURS") or 24)

MODELS_TO_TRY = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
]

BRANDS_TO_SCRUB = [
    "Kenyans.co.ke", "Daily Nation", "Nation.Africa", "The Standard", "Standard Media",
    "Citizen Digital", "Tuko", "Pulse Live", "Capital FM", "K24", "NTV Kenya", "KTN News",
    "BBC", "CNN", "Reuters", "Al Jazeera", "Business Daily", "Smart Farmer Kenya",
    "Techweez", "OkayAfrica", "Africanews",
]

DEFAULT_STYLES = [
    {
        "name": "Hard News Lead",
        "format": "News report",
        "lead_style": "Who did what, where, when.",
        "tone": "Reported fact, then a pointed close.",
        "angle": "What happened",
        "structure": "Lead, facts, quotes, commentary heading",
        "sentence_mix": "Short and medium",
        "closing": "A take, not a prediction",
        "commentary_heading": "Why it matters",
    },
    {
        "name": "Event Report",
        "format": "Event report",
        "lead_style": "Open with the event and principal actor.",
        "tone": "Factual, then street-level reading.",
        "angle": "Sequence of events",
        "structure": "Lead, sequence, numbers, commentary heading",
        "sentence_mix": "Short",
        "closing": "Who is left standing",
        "commentary_heading": "The Nairobi read",
    },
    {
        "name": "Statement Report",
        "format": "Statement report",
        "lead_style": "Official action or statement first.",
        "tone": "Attribution first, then who benefits.",
        "angle": "What was said or ordered",
        "structure": "Lead, quote/order, background, commentary heading",
        "sentence_mix": "Medium",
        "closing": "Cost to the reader",
        "commentary_heading": "What it costs you",
    },
    {
        "name": "Desk Take",
        "format": "Reported feature",
        "lead_style": "Scene or consequence first, then the actor.",
        "tone": "Curious, specific, not snarky.",
        "angle": "Why a Kenyan should care",
        "structure": "Lead, evidence, names, commentary heading",
        "sentence_mix": "Short then one long",
        "closing": "One clean judgment",
        "commentary_heading": "The take",
    },
]


def strip_spam(text):
    return strip_banned(text)


def run_writer(cfg):
    author = cfg["author_name"]
    category = cfg["category"]
    source_url = cfg["source_url"]
    source_domain = cfg["source_domain"]
    posts_dir = os.environ.get("POSTS_DIR", "content/posts")
    memory_file = os.environ.get("MEMORY_FILE", cfg["memory_file"])
    styles = cfg.get("styles") or DEFAULT_STYLES
    role = cfg.get("role", f"{category.lower()} correspondent")
    extra_path_hints = cfg.get("path_hints", ["article", "news", "story", "post", "/20"])
    opinion_mode = bool(cfg.get("opinion_mode"))

    now_utc = datetime.datetime.utcnow()
    now_eat = now_utc + datetime.timedelta(hours=3)
    publish_ts = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    today_str = now_eat.strftime("%Y-%m-%d")
    full_date_str = now_eat.strftime("%A, %B %d, %Y")

    def load_memory():
        if not os.path.exists(memory_file):
            return {"published_hashes": [], "style_history": [], "angle_history": []}
        try:
            with open(memory_file, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, list):
                return {"published_hashes": raw[-500:], "style_history": [], "angle_history": []}
            if isinstance(raw, dict):
                raw.setdefault("published_hashes", [])
                raw.setdefault("style_history", [])
                raw.setdefault("angle_history", [])
                raw["style_history"] = [
                    (h.get("stylePreset") or h.get("name") or "") if isinstance(h, dict) else str(h)
                    for h in raw["style_history"]
                ]
                raw["style_history"] = [h for h in raw["style_history"] if h]
                return raw
        except Exception as e:
            print(f"Memory load error: {e}")
        return {"published_hashes": [], "style_history": [], "angle_history": []}

    def save_memory(mem):
        os.makedirs(os.path.dirname(memory_file) or ".", exist_ok=True)
        mem["published_hashes"] = mem.get("published_hashes", [])[-500:]
        mem["style_history"] = mem.get("style_history", [])[-30:]
        mem["angle_history"] = mem.get("angle_history", [])[-80:]
        with open(memory_file, "w", encoding="utf-8") as f:
            json.dump(mem, f, indent=2)

    memory = load_memory()

    def pick_style(history):
        recent = set(list(history)[-2:])
        candidates = [s for s in styles if s["name"] not in recent] or styles
        return random.choice(candidates)

    def content_hash(title, body):
        raw = (title + "|" + body[:800]).lower()
        raw = re.sub(r"\s+", " ", raw)
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    def scrub_brands(text):
        for b in BRANDS_TO_SCRUB:
            text = re.sub(re.escape(b), "", text, flags=re.I)
        return text

    def scrape_source():
        stories = []
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
                page = browser.new_page()
                page.goto(source_url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(2500)
                html = page.content()
                browser.close()
            soup = BeautifulSoup(html, "html.parser")
            for a in soup.select("a[href]")[:120]:
                href = a.get("href") or ""
                title = a.get_text(" ", strip=True)
                if len(title) < 25 or len(title) > 140:
                    continue
                if not any(x in href for x in extra_path_hints):
                    continue
                if href.startswith("/"):
                    href = urllib.parse.urljoin(source_url, href)
                if source_domain not in href:
                    continue
                stories.append({"title": title, "url": href})
            seen = set()
            uniq = []
            for s in stories:
                if s["url"] in seen:
                    continue
                seen.add(s["url"])
                uniq.append(s)
            uniq.sort(key=lambda s: kenya_score(s["title"]), reverse=True)
            print(f"Scraped {len(uniq)} candidate links from {source_domain}")
            return uniq[:15]
        except Exception as e:
            print(f"Scrape error: {e}")
            return []

    def is_good_image(url):
        if not url or not isinstance(url, str):
            return False
        u = url.strip()
        if not u.startswith("http"):
            return False
        low = u.lower()
        if any(x in low for x in ("placeholder", "default-og", "logo.png", "1x1", "pixel", "spacer", "data:image")):
            return False
        return True

    def resolve_image(raw, page_url):
        if not raw:
            return ""
        u = raw.strip()
        if u.startswith("//"):
            u = "https:" + u
        elif u.startswith("/"):
            u = urllib.parse.urljoin(page_url, u)
        return u if is_good_image(u) else ""

    def unsplash_fallback(query):
        key = (os.environ.get("UNSPLASH_ACCESS_KEY") or "").strip()
        if not key:
            return ""
        try:
            import urllib.request
            q = urllib.parse.quote((query or "kenya nairobi")[:80])
            req = urllib.request.Request(
                f"https://api.unsplash.com/photos/random?query={q}&orientation=landscape",
                headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"},
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            url = (data.get("urls") or {}).get("regular") or (data.get("urls") or {}).get("full") or ""
            return url if is_good_image(url) else ""
        except Exception as e:
            print(f"Unsplash fallback failed: {e}")
            return ""

    def fetch_article(url):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=40000)
                page.wait_for_timeout(1500)
                html = page.content()
                browser.close()
            soup = BeautifulSoup(html, "html.parser")

            fresh, age_h = is_fresh_enough(soup, max_hours=FRESH_HOURS)
            if not fresh:
                print(f"Skipping, age {age_h:.1f}h exceeds {FRESH_HOURS}h")
                return "", ""
            if age_h is None:
                print("No structured date — allowing (unknown age)")
            else:
                print(f"Source age ~{age_h:.1f}h")

            og = ""
            for prop in ("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"):
                tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
                if tag and tag.get("content"):
                    og = resolve_image(tag["content"], url)
                    if og:
                        break
            if not og:
                img = soup.select_one("article img[src], .article-image img[src], figure img[src], img.wp-post-image")
                if img and img.get("src"):
                    og = resolve_image(img.get("src"), url)
            for t in soup(["script", "style", "nav", "footer", "aside"]):
                t.decompose()
            paragraphs = [
                p.get_text(" ", strip=True)
                for p in soup.select("p")
                if len(p.get_text(strip=True)) > 40
            ]
            body = "\n\n".join(paragraphs[:18])
            body = scrub_brands(body)[:6000]
            if mentions_stale_year(body, now_eat.year):
                print("Skipping, source body cites an older year (likely a retrospective/reshare)")
                return "", ""
            return body, og
        except Exception as e:
            print(f"Fetch article error: {e}")
            return "", ""

    def call_gemini(prompt):
        api_key = (
            os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
            or os.environ.get("GEMINI_WRITE_KEY")
        )
        if not api_key:
            raise RuntimeError("No GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        last_err = None
        for model in MODELS_TO_TRY:
            try:
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.62 if not opinion_mode else 0.82,
                        max_output_tokens=4096,
                    ),
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
        s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        return s[:80]

    def write_post(title, body_md, style_name, source, image=""):
        body_md = polish_body(body_md, category, title)
        seo = seo_fields(title, body_md, category, author)
        if not is_good_image(image):
            image = unsplash_fallback(seo.get("title") or title) or ""
        slug = f"{today_str}-{slugify(seo['title'])}"
        path = os.path.join(posts_dir, f"{slug}.md")
        os.makedirs(posts_dir, exist_ok=True)
        img = image if is_good_image(image) else ""
        fm = f"""---
title: "{seo['title']}"
slug: "{slugify(seo['title'])}"
description: "{seo['description']}"
excerpt: "{seo['excerpt']}"
date: {publish_ts}
dateModified: {publish_ts}
author: "{author}"
category: "{category}"
county: "{seo['county']}"
image: "{img}"
readTime: {max(3, len(body_md.split()) // 180)}
source: "{source}"
stylePreset: "{style_name}"
schema: "NewsArticle"
---

{body_md}
"""
        with open(path, "w", encoding="utf-8") as f:
            f.write(fm)
        print(f"Wrote {path} kenya_score={kenya_score(seo['title'] + ' ' + body_md)} image={'yes' if img else 'none'}")
        return slug

    print(f"[{author}] Kenya-first run {category} @ {publish_ts}")
    stories = scrape_source()
    if not stories:
        print("No stories found")
        return
    style = pick_style(memory.get("style_history", []))
    print(f"Style: {style['name']}")
    written = 0
    max_posts = int(os.environ.get("MAX_POSTS_PER_RUN", "3") or 3)
    write_every = os.environ.get("WRITE_EVERY_ELIGIBLE_STORY", "1") in ("1", "true", "yes")
    for story in stories:
        if should_skip_story(story["title"], category):
            print(f"Skip (not Kenya-first): {story['title'][:80]}")
            continue
        body, image = fetch_article(story["url"])
        if len(body) < 200:
            print(f"Skip thin body: {story['title'][:60]}")
            continue
        if should_skip_story(story["title"] + " " + body, category):
            print(f"Skip body (not Kenya-first): {story['title'][:80]}")
            continue
        avoid = " | ".join((memory.get("angle_history") or [])[-8:])
        prompt = news_prompt(
            author, full_date_str, style, story["title"], body,
            role=role, opinion=opinion_mode, desk=category, avoid=avoid,
        )
        try:
            article, model_used = call_gemini(prompt)
            print(f"Used {model_used}")
        except Exception as e:
            print(f"Generation failed: {e}")
            continue
        if model_skipped(article):
            print("Model skipped foreign story")
            continue
        article = polish_body(scrub_brands(article), category, story["title"])
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
        write_post(title, article, style["name"], story["url"], image)
        memory.setdefault("published_hashes", []).append(h)
        memory.setdefault("style_history", []).append(style["name"])
        lede = " ".join(article.split()[:12])
        memory.setdefault("angle_history", []).append(lede)
        save_memory(memory)
        print("Memory updated")
        written += 1
        if not write_every:
            return
        if written >= max_posts:
            print(f"Hit MAX_POSTS_PER_RUN={written}")
            return
    if written:
        print(f"Published {written} post(s) this run")
    else:
        print("No suitable Kenya-first story published this run")
