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

FRESH_HOURS = 24

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
    },
    {
        "name": "Context First",
        "format": "News report",
        "lead_style": "Why this matters before the bare fact.",
        "tone": "Explanatory, still sharp.",
        "angle": "Why it matters",
        "structure": "Context, facts, quotes, commentary heading",
        "sentence_mix": "Medium",
        "closing": "What to watch next",
    },
    {
        "name": "Quote-Led",
        "format": "News report",
        "lead_style": "Open on a strong quote, then ground it.",
        "tone": "Voice-forward reporting",
        "angle": "Who said what",
        "structure": "Quote, facts, reaction, commentary heading",
        "sentence_mix": "Short and medium",
        "closing": "The line that lingers",
    },
]


def now_eat():
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3)))


def load_memory(path):
    if not os.path.exists(path):
        return {"published_hashes": [], "style_history": [], "angle_history": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"published_hashes": [], "style_history": [], "angle_history": []}


def save_memory(memory, path):
    memory["published_hashes"] = memory.get("published_hashes", [])[-200:]
    memory["style_history"] = memory.get("style_history", [])[-40:]
    memory["angle_history"] = memory.get("angle_history", [])[-40:]
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2)


def scrub_brands(text):
    out = text or ""
    for b in BRANDS_TO_SCRUB:
        out = re.sub(re.escape(b), "", out, flags=re.I)
    return re.sub(r"\s{2,}", " ", out).strip()


def pick_style(memory):
    recent = set(memory.get("style_history", [])[-6:])
    choices = [s for s in DEFAULT_STYLES if s["name"] not in recent] or DEFAULT_STYLES
    return random.choice(choices)


def story_hash(title, url):
    return hashlib.sha1(f"{title}|{url}".encode("utf-8")).hexdigest()


def already_published(memory, title, url):
    return story_hash(title, url) in set(memory.get("published_hashes", []))


def fetch_list_links(list_url, link_selector, max_links=12):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(list_url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(1500)
            html = page.content()
            browser.close()
        soup = BeautifulSoup(html, "html.parser")
        links = []
        for a in soup.select(link_selector):
            href = a.get("href") or ""
            if not href or href.startswith("#"):
                continue
            full = urllib.parse.urljoin(list_url, href)
            if full not in links:
                links.append(full)
            if len(links) >= max_links:
                break
        return links
    except Exception as e:
        print(f"List fetch failed: {e}")
        return []


def fetch_article(url):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(1200)
            html = page.content()
            browser.close()
        soup = BeautifulSoup(html, "html.parser")

        fresh, age_h = is_fresh_enough(soup, max_hours=FRESH_HOURS)
        if not fresh:
            if age_h is None:
                print("Skipping, no usable publish-date signal found (fail-closed)")
            else:
                print(f"Skipping, age {age_h:.1f}h")
            return "", ""

        og = ""
        for prop in ("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"):
            tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            if tag and tag.get("content"):
                og = tag["content"]
                break
        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()
        paragraphs = [
            p.get_text(" ", strip=True)
            for p in soup.select("p")
            if len(p.get_text(strip=True)) > 40
        ]
        body = "\n\n".join(paragraphs[:18])
        body = scrub_brands(body)[:6000]
        if mentions_stale_year(body, now_eat().year):
            print("Skipping, source body cites an older year (likely a retrospective/reshare)")
            return "", ""
        return body, og
    except Exception as e:
        print(f"Fetch article error: {e}")
        return "", ""


def rewrite_with_gemini(title, body, author, desk, style, category="News"):
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    date_str = now_eat().strftime("%A, %d %B %Y")
    prompt = news_prompt(
        author=author,
        date_str=date_str,
        style=style,
        title=title,
        body=body,
        desk=desk,
    )
    last_err = None
    for model in MODELS_TO_TRY:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.7, max_output_tokens=4096),
            )
            text = (resp.text or "").strip()
            if model_skipped(text):
                print(f"Model skipped story ({model})")
                return None
            if is_spam(text) or should_skip_story(text, category):
                print(f"Rejected as spam/off-desk ({model})")
                return None
            text = polish_body(text, category, title)
            return text
        except Exception as e:
            last_err = e
            print(f"Model {model} failed: {e}")
            time.sleep(1.2)
    print(f"All models failed: {last_err}")
    return None


def slugify(title):
    s = re.sub(r"[^a-z0-9]+", "-", (title or "").lower()).strip("-")
    return s[:80] or "post"


def write_markdown(title, body, author, category, image, out_dir="content/posts"):
    fields = seo_fields(title, body, category, author)
    slug = slugify(fields["title"])
    ts = now_eat()
    fname = f"{ts.strftime('%Y-%m-%d')}-{slug}.md"
    path = os.path.join(out_dir, fname)
    os.makedirs(out_dir, exist_ok=True)
    front = {
        "title": fields["title"],
        "slug": slug,
        "description": fields["description"],
        "excerpt": fields["excerpt"],
        "author": author,
        "authorUrl": f"https://zandani.co.ke/author/{slugify(author)}",
        "image": image or "",
        "category": category,
        "tags": [category.lower(), "kenya"],
        "date": ts.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dateModified": ts.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "focusKeyword": " ".join(fields["title"].split()[:5]).lower(),
        "schema": fields["schema"],
        "county": fields["county"],
        "stylePreset": "News",
    }
    lines = ["---"]
    for k, v in front.items():
        if isinstance(v, list):
            lines.append(f"{k}: {json.dumps(v)}")
        else:
            lines.append(f'{k}: "{str(v).replace(chr(34), chr(39))}"')
    lines.append("---")
    lines.append(body.strip())
    lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {path}")
    return path


def run_desk(
    *,
    author,
    desk,
    category,
    list_url,
    link_selector,
    memory_path,
    max_tries=8,
):
    memory = load_memory(memory_path)
    links = fetch_list_links(list_url, link_selector)
    if not links:
        print("No links found")
        return
    random.shuffle(links)
    style = pick_style(memory)
    for url in links[:max_tries]:
        body, image = fetch_article(url)
        if not body or len(body) < 200:
            continue
        title_guess = url.rstrip("/").split("/")[-1].replace("-", " ").title()
        if already_published(memory, title_guess, url):
            print(f"Already published: {title_guess}")
            continue
        if should_skip_story(body, category):
            print("Skip non-Kenya story")
            continue
        article = rewrite_with_gemini(title_guess, body, author, desk, style, category)
        if not article:
            continue
        # Prefer a clean title from the first line if the model put one
        first = article.splitlines()[0].strip()
        if first.startswith("#"):
            title = re.sub(r"^#+\s*", "", first).strip()
            article = "\n".join(article.splitlines()[1:]).strip()
        else:
            title = title_guess
        h = story_hash(title, url)
        write_markdown(title, article, author, category, image)
        memory.setdefault("published_hashes", []).append(h)
        memory.setdefault("style_history", []).append(style["name"])
        lede = " ".join(article.split()[:12])
        memory.setdefault("angle_history", []).append(lede)
        save_memory(memory, memory_path)
        print("Memory updated")
        return
    print("No suitable Kenya-first story published this run")
