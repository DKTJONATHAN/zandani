#!/usr/bin/env python3
"""Martin Kihara — straight showbiz reporter (Mpasho). No commentary.

Mpasho (mpasho.co.ke) is a Next.js / Radio Africa site:
- Listing pages (/entertainment, /relationships, /exclusives) SSR article links
  with date-slug paths: /entertainment/2026-09-14-some-title
- Article pages SSR og:title, og:image, twitter:image in <head>
- Body text is NOT in <p> tags in the initial HTML; it lives inside the
  self.__next_f RSC flight payload as plain prose strings
- Publish time is embedded as datePublished":"2026-09-14T14:15:00+0300
- Images live on https://cdn.radioafrica.digital/image/YYYY/MM/<uuid>.webp
"""
import os, sys, json, re, time, random, hashlib, datetime, urllib.parse
import requests
from dateutil import parser as date_parser
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types

try:
    from voice_guard import (
        news_prompt, should_skip_story, polish_body, model_skipped,
        mentions_stale_year, seo_fields,
    )
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from voice_guard import (
        news_prompt, should_skip_story, polish_body, model_skipped,
        mentions_stale_year, seo_fields,
    )


AUTHOR_NAME = "Martin Kihara"
AUTHOR_SLUG = "martin-kihara"
CATEGORY = "Showbiz"
SITE_BASE_URL = "https://zandani.co.ke"
SOURCE_URL = "https://www.mpasho.co.ke/"
SOURCE_DOMAIN = "mpasho.co.ke"
POSTS_DIR = os.environ.get("POSTS_DIR", "content/posts")
MEMORY_FILE = os.environ.get("MEMORY_FILE", ".github/memory_martin_mpasho.json")
MAX_CANDIDATES = 30
MAX_SCRAPE_TRIES = 12
FRESH_HOURS = 24

LISTING_URLS = [
    "https://www.mpasho.co.ke/entertainment",
    "https://www.mpasho.co.ke/relationships",
    "https://www.mpasho.co.ke/exclusives",
    "https://www.mpasho.co.ke/",
]

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

STYLE_PRESETS = [
    {"name": "Hard News Lead", "lead_style": "Who did what, where, when.",
     "tone": "Neutral wire-service. No opinion.", "structure": "Lead, facts by importance, quotes, status"},
    {"name": "Event Report", "lead_style": "Open with the event and principal actor.",
     "tone": "Factual, clipped.", "structure": "Lead, sequence, confirmation, numbers"},
    {"name": "Statement Report", "lead_style": "Official action or statement first.",
     "tone": "Neutral, attribution-heavy.", "structure": "Lead, quote/order, background, response"},
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

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
    return any(m in low for m in [
        "central subject of the update", "what this means for kenyans", "key takeaway",
    ])


def _is_article_path(path: str) -> bool:
    if not path or path in ("/", ""):
        return False
    bad = ("/author/", "/tag/", "/category/", "/page/", "/feed/", "/comment-", "/search", "/about", "/contact")
    if any(b in path for b in bad):
        return False
    # Primary pattern on this CMS: /section/YYYY-MM-DD-slug
    if re.search(r"/20\d{2}-\d{2}-\d{2}-[a-z0-9-]{10,}", path):
        return True
    good = ("/entertainment/", "/relationships/", "/exclusives/", "/lifestyle/")
    if any(g in path for g in good):
        slug = path.rstrip("/").split("/")[-1]
        return len(slug) > 20 and "-" in slug
    return False


def _extract_links_from_html(html: str, seen: set) -> list:
    urls = []
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        if href.startswith("/"):
            href = urllib.parse.urljoin(SOURCE_URL, href)
        if SOURCE_DOMAIN not in href:
            continue
        path = urllib.parse.urlparse(href).path or ""
        if not _is_article_path(path):
            continue
        if href in seen:
            continue
        seen.add(href)
        urls.append(href)
    return urls


def get_target_urls():
    """Prefer plain requests on category listings (SSR). Playwright only as fallback."""
    seen = set()
    urls = []

    for list_url in LISTING_URLS:
        try:
            r = requests.get(list_url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            found = _extract_links_from_html(r.text, seen)
            urls.extend(found)
            print(f"requests {list_url} → +{len(found)} links (total {len(urls)})")
            if len(urls) >= MAX_CANDIDATES:
                break
        except Exception as e:
            print(f"requests failed on {list_url}: {e}")

    if urls:
        def date_key(u):
            m = re.search(r"/(20\d{2})-(\d{2})-(\d{2})-", u)
            return int(m.group(1) + m.group(2) + m.group(3)) if m else 0
        urls = sorted(urls, key=date_key, reverse=True)[:MAX_CANDIDATES]
        print(f"Discovered {len(urls)} candidate article links (requests)")
        return urls

    print("No links via requests — falling back to Playwright")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
            )
            context = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()
            for list_url in LISTING_URLS[:2]:
                try:
                    page.goto(list_url, wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(3000)
                    for _ in range(2):
                        page.evaluate("window.scrollBy(0, 1400)")
                        page.wait_for_timeout(1000)
                    found = _extract_links_from_html(page.content(), seen)
                    urls.extend(found)
                    print(f"playwright {list_url} → +{len(found)} links (total {len(urls)})")
                except Exception as e:
                    print(f"playwright page error on {list_url}: {e}")
            browser.close()
    except Exception as e:
        print(f"List scrape error (playwright): {e}")

    if urls:
        def date_key(u):
            m = re.search(r"/(20\d{2})-(\d{2})-(\d{2})-", u)
            return int(m.group(1) + m.group(2) + m.group(3)) if m else 0
        urls = sorted(urls, key=date_key, reverse=True)[:MAX_CANDIDATES]
    print(f"Discovered {len(urls)} candidate article links")
    return urls


def _extract_og_image(soup) -> str:
    """og:image / twitter:image → clean CDN URL (strip cache-bust query)."""
    for prop in ("og:image",):
        tag = soup.find("meta", property=prop)
        if tag and tag.get("content"):
            return tag["content"].split("?")[0].strip()
    for name in ("twitter:image",):
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].split("?")[0].strip()
    return ""


def _extract_publish_dt(html: str, soup):
    """Mpasho embeds datePublished in the RSC payload, not always as meta tags."""
    m = re.search(r'datePublished\\?":\\?"([^"\\]+)', html)
    if m:
        try:
            pt = date_parser.parse(m.group(1))
            if pt.tzinfo is None:
                pt = pt.replace(tzinfo=datetime.timezone.utc)
            return pt
        except Exception:
            pass
    # Fallback: standard meta / time tags via voice_guard-compatible selectors
    for prop in ("article:published_time", "og:published_time"):
        tag = soup.find("meta", property=prop)
        if tag and tag.get("content"):
            try:
                pt = date_parser.parse(tag["content"])
                if pt.tzinfo is None:
                    pt = pt.replace(tzinfo=datetime.timezone.utc)
                return pt
            except Exception:
                pass
    return None


def _extract_body_from_rsc(html: str) -> str:
    """Pull article prose out of the Next.js RSC flight payload.

    Initial HTML has almost no <p> tags. Body lives as long sentence strings
    inside self.__next_f.push([...]) chunks.
    """
    # Prefer unescaped prose that looks like real paragraphs
    prose = re.findall(r'([A-Z][a-z][^\\"<>]{100,700}\.)', html)
    clean = []
    seen = set()
    junk = (
        "function", "window.", "static/chunks", "className", "cdn.",
        "self.__", "React", "http", "keywords", "doesn’t seem to exist",
        "does not seem to exist", "mpasho whatsapp", "radio africa",
    )
    for p in prose:
        p = p.strip()
        if any(j in p for j in junk):
            continue
        # skip keyword-list debris and nav crumbs
        if p.count(",") > 6 and len(p) < 200:
            continue
        key = p[:70].lower()
        if key in seen:
            continue
        seen.add(key)
        clean.append(p)
    if len(clean) >= 3:
        return "\n\n".join(clean)

    # Fallback: normal <p> tags if the page ever SSRs them
    soup = BeautifulSoup(html, "html.parser")
    paras = [
        p.get_text(" ", strip=True)
        for p in soup.find_all("p")
        if len(p.get_text(strip=True)) > 40
    ]
    return "\n\n".join(paras)


def scrape_article(url):
    try:
        html = None
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200 and len(r.text) > 2000:
                html = r.text
        except Exception as e:
            print(f"requests article fetch failed: {e}")

        if not html:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage"],
                )
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=40000)
                page.wait_for_timeout(2000)
                html = page.content()
                browser.close()

        soup = BeautifulSoup(html, "html.parser")

        # Freshness from RSC datePublished (or meta fallback)
        pt = _extract_publish_dt(html, soup)
        if pt is not None:
            age_h = (datetime.datetime.now(datetime.timezone.utc) - pt).total_seconds() / 3600
            if age_h > FRESH_HOURS:
                print(f"Skipping (dated, age {age_h:.1f}h > {FRESH_HOURS}h): {url}")
                return None, None, None
            print(f"Publish age {age_h:.1f}h — ok")
        else:
            print(f"No publish-date signal (soft-pass): {url}")

        # Title: og:title is cleanest
        og_title = soup.find("meta", property="og:title")
        title = (og_title.get("content") or "").strip() if og_title else ""
        if not title and soup.title:
            title = soup.title.get_text(strip=True)
            for sep in [" | ", " - "]:
                if sep in title:
                    title = title.split(sep)[0].strip()

        # Body from RSC payload (not <p> tags)
        text = _extract_body_from_rsc(html)
        if len(text) < 250:
            print(f"Body too short ({len(text)} chars): {url}")
            return None, None, None
        print(f"Body {len(text)} chars / ~{len(text.split())} words")

        # OG image from meta → cdn.radioafrica.digital
        img = _extract_og_image(soup)
        if img:
            print(f"OG image: {img}")
        else:
            print("No og:image found")

        if mentions_stale_year(text, now_eat.year):
            print("Skipping, source body cites an older year (likely a retrospective/reshare)")
            return None, None, None

        return text, img, title
    except Exception as e:
        print(f"Scrape failed: {e}")
        return None, None, None


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
        print("No links discovered — check requests/Playwright / site structure")
        return 0
    style = pick_style(memory.get("style_history", []))
    print(f"Style: {style['name']}")
    for link in links[:MAX_SCRAPE_TRIES]:
        print(f"Trying: {link}")
        text, img, ttl = scrape_article(link)
        if not text or len(text) < 200:
            continue
        blob = ttl or ""
        if should_skip_story(blob + " " + text, CATEGORY):
            print("should_skip_story=True")
            continue
        try:
            prompt = news_prompt(
                AUTHOR_NAME, full_date_str, style, ttl or "", text,
                role="correspondent", desk=CATEGORY,
            )
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
