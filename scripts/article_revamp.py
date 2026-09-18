#!/usr/bin/env python3
"""Shared post-generation editorial revamp for Zandani desks.

Takes the fresh post produced by an existing desk writer, re-reads its source,
extracts article-local images with their ALT/caption/context, and asks Gemini to
rebuild the article around a materially different but fully supported Zandani
editorial angle. The original desk scraper/writer remains responsible for
source discovery and desk identity.
"""
from __future__ import annotations

import base64
import glob
import io
import json
import os
import re
import time
import urllib.parse
import datetime

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types
from playwright.sync_api import sync_playwright

from article_intelligence import extract_article_images, format_image_candidates, recent_angle_context
from voice_guard import extract_published_dt, is_fresh_enough, mentions_stale_year, polish_body, should_skip_story, seo_fields

POSTS_DIR = os.environ.get("POSTS_DIR", "content/posts")
MEMORY_FILE = os.environ.get("MEMORY_FILE", "")
CATEGORY = os.environ.get("REVAMP_CATEGORY", "News")
AUTHOR = os.environ.get("REVAMP_AUTHOR", "Za Ndani")
MAX_AGE = int(os.environ.get("FRESH_HOURS", "24") or 24)
MAX_IMAGES = 12
MAX_SELECTED = 3
MAX_POST_AGE_MINUTES = int(os.environ.get("REVAMP_MAX_POST_AGE_MINUTES", "30") or 30)

MODELS = [
    "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash",
    "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite",
    "gemini-3-flash-preview", "gemini-2.5-flash",
]


def read_memory():
    if not MEMORY_FILE or not os.path.exists(MEMORY_FILE):
        return {}
    try:
        with open(MEMORY_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_memory(data):
    if not MEMORY_FILE:
        return
    os.makedirs(os.path.dirname(MEMORY_FILE) or ".", exist_ok=True)
    data.setdefault("revamp_angles", [])
    data["revamp_angles"] = data["revamp_angles"][-100:]
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) != 3:
        return {}, text
    fm = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        fm[key.strip()] = value
    return fm, parts[2].lstrip("\n")


def yaml_quote(value):
    return '"' + str(value or "").replace("\\", "\\\\").replace('"', "'").replace("\n", " ").strip() + '"'


def article_root(soup):
    for sel in ["article", ".node__content", ".field--name-body", ".article__body", "main article", ".content"]:
        node = soup.select_one(sel)
        if node and len(node.find_all("p")) >= 3:
            return node
    return soup


def scrape_source(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(1600)
        soup = BeautifulSoup(page.content(), "html.parser")
        browser.close()
    fresh, _age = is_fresh_enough(soup, max_hours=MAX_AGE)
    if not fresh:
        return None
    root = article_root(soup)
    paragraphs = [p.get_text(" ", strip=True) for p in root.find_all("p") if len(p.get_text(strip=True)) > 30]
    body = "\n\n".join(paragraphs)
    if len(body) < 500:
        body = "\n\n".join(p.get_text(" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30)
    current_year = datetime.datetime.utcnow().year
    if len(body) < 500 or mentions_stale_year(body, current_year):
        return None
    images = extract_article_images(soup, url, root, limit=MAX_IMAGES)
    featured = ""
    for meta in soup.find_all("meta"):
        prop = meta.get("property") or meta.get("name") or ""
        if prop in ("og:image", "twitter:image", "twitter:image:src") and meta.get("content"):
            featured = urllib.parse.urljoin(url, meta["content"])
            break
    published = extract_published_dt(soup)
    return {
        "url": url,
        "body": body[:12000],
        "images": images,
        "featured": featured,
        "published": published.isoformat() if published else "",
    }


def norm_words(text):
    stop = {"the","a","an","of","to","in","on","for","and","or","with","from","by","after","over","new","kenya","kenyan","what","this","that","has","have"}
    return {x for x in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(x) > 3 and x not in stop}


def similarity(a, b):
    x, y = norm_words(a), norm_words(b)
    return len(x & y) / max(1, len(x | y))


def gemini(prompt):
    keys = [os.environ.get(k) for k in ("GEMINI_WRITE_KEY", "GEMINI_API_KEY", "GEMINI_API_KEY1") if os.environ.get(k)]
    if not keys:
        raise RuntimeError("No Gemini API key")
    last = None
    for key in keys:
        client = genai.Client(api_key=key)
        for model in MODELS:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.58, max_output_tokens=6000),
                )
                text = (response.text or "").strip()
                if text:
                    print(f"Gemini OK [{model}]")
                    return text
            except Exception as exc:
                last = exc
                msg = str(exc).lower()
                if any(x in msg for x in ("429", "quota", "rate", "503", "overloaded")):
                    time.sleep(5)
                elif any(x in msg for x in ("404", "not found", "deprecated")):
                    break
    raise RuntimeError(f"Gemini failed: {last}")


def parse_json(raw):
    raw = (raw or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
    raw = re.sub(r"\s*```$", "", raw)
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def choose_images(data, candidates):
    """Respect Gemini ranking, then fill from every trusted scraped source image."""
    selected = []
    items = data.get("images") if isinstance(data.get("images"), list) else []
    requested = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            requested.append(int(item.get("source_index")))
        except Exception:
            pass

    by_index = {int(x["index"]): x for x in candidates if x.get("index") is not None}
    order = []
    for idx in requested + [x.get("index") for x in candidates]:
        if idx is not None and idx not in order:
            order.append(idx)

    for idx in order:
        src = by_index.get(idx)
        if not src or any(x.get("index") == idx for x in selected):
            continue
        selected.append({
            **src,
            "reason": "Selected from the scraped article image set",
            "selected_alt": str(src.get("alt") or src.get("caption") or "News image").strip()[:180] or "News image",
        })
        if len(selected) >= MAX_SELECTED:
            break

    # Best-effort fallback: never lose all internal images just because Gemini
    # did not return image selections.
    if not selected:
        for src in candidates:
            if any((src.get("url") or "") == (x.get("url") or "") for x in selected):
                continue
            selected.append({
                **src,
                "reason": "Additional distinct image scraped from the source article",
                "selected_alt": str(src.get("alt") or src.get("caption") or "News image").strip()[:180] or "News image",
            })
            if len(selected) >= MAX_SELECTED:
                break

    # If the source has fewer than three distinct images, reuse an available
    # source image only where necessary, matching the News best-effort rule.
    if selected:
        while len(selected) < MAX_SELECTED:
            selected.append(selected[(len(selected) - 1) % len(selected)])
    return selected[:MAX_SELECTED]


def upload_img(url):
    api = os.environ.get("IMGBB_API_KEY", "").strip()
    if not api or not url or not url.startswith("http") or "ibb.co" in url or "imgbb.com" in url:
        return url
    try:
        r = requests.get(url, timeout=25, headers={"User-Agent": "ZaNdani/1.0"})
        r.raise_for_status()
        raw = r.content
        try:
            from PIL import Image
            image = Image.open(io.BytesIO(raw))
            if image.mode in ("RGBA", "LA", "P"):
                image = image.convert("RGB")
            if image.width > 1400:
                ratio = 1400 / float(image.width)
                image = image.resize((1400, max(1, int(image.height * ratio))), Image.LANCZOS)
            buf = io.BytesIO()
            image.save(buf, format="WEBP", quality=82, method=4)
            raw = buf.getvalue()
        except Exception:
            pass
        encoded = base64.b64encode(raw).decode()
        res = requests.post("https://api.imgbb.com/1/upload", data={"key": api, "image": encoded}, timeout=30)
        if res.ok:
            d = res.json().get("data") or {}
            return d.get("url") or d.get("display_url") or url
    except Exception as exc:
        print(f"Image rehost failed: {exc}")
    return url


def inject_images(body, images):
    """Strip any model images and place the first two trusted images deep in the article."""
    body = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body or "")
    body = re.sub(r"<img\b[^>]*>", "", body, flags=re.I)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    if len(images) < 2:
        return body
    blocks = [x for x in body.split("\n\n") if x.strip()]
    if len(blocks) < 4:
        return body

    n = len(blocks)
    first_after = max(4, min(n - 3, round(n * 0.30)))
    second_after = max(first_after + 3, min(n - 1, round(n * 0.65)))
    positions = {first_after: images[0], second_after: images[1]}
    out = []
    for i, block in enumerate(blocks, 1):
        out.append(block)
        image = positions.get(i)
        if image:
            alt = re.sub(r"[\[\]\r\n]", "", image.get("selected_alt") or "News image")[:180]
            out.append(f"![{alt}]({image['url']})")
    return "\n\n".join(out)


def find_target_post():
    cutoff = time.time() - MAX_POST_AGE_MINUTES * 60
    candidates = []
    for path in glob.glob(os.path.join(POSTS_DIR, "*.md")):
        try:
            if os.path.getmtime(path) < cutoff:
                continue
            with open(path, encoding="utf-8") as f:
                text = f.read()
            fm, _ = parse_frontmatter(text)
            if str(fm.get("category", "")).strip().lower() != CATEGORY.lower():
                continue
            if str(fm.get("source", "")).strip().startswith("http"):
                candidates.append((os.path.getmtime(path), path, fm, text))
        except Exception:
            continue
    candidates.sort(reverse=True)
    return candidates[0] if candidates else None


# Strong verbs require explicit or near-explicit support in the source.
# This is deliberately conservative: an uncertain headline is rejected rather than published.
STRONG_HEADLINE_TERMS = {
    "discard": ("discard", "discarded", "discarding"),
    "scrap": ("scrap", "scrapped", "scrapping"),
    "cancel": ("cancel", "cancelled", "canceled", "cancellation"),
    "reject": ("reject", "rejected", "rejection"),
    "ban": ("ban", "banned", "banning"),
    "shut": ("shut", "shutdown", "closed", "closure"),
    "terminate": ("terminate", "terminated", "termination"),
    "force": ("force", "forced", "forcing", "order", "ordered", "orders"),
    "fire": ("fire", "fired", "sack", "sacked", "dismiss", "dismissed"),
    "arrest": ("arrest", "arrested", "detain", "detained"),
    "lose": ("lose", "lost", "loss"),
}


def headline_is_overstated(title, source_body):
    low = (title or "").lower()
    src = (source_body or "").lower()
    for stem, variants in STRONG_HEADLINE_TERMS.items():
        if re.search(r"\b" + re.escape(stem) + r"\w*\b", low):
            if not any(v in src for v in variants):
                return True, f"headline uses '{stem}' without source support"
    # Absolute language is risky unless the source itself contains it.
    for term in ("all", "none", "never", "every", "completely", "entirely", "no longer"):
        if re.search(r"\b" + re.escape(term) + r"\b", low) and term not in src:
            return True, f"headline uses unsupported absolute '{term}'"
    return False, ""


def rewrite_post(path, fm, old_body, source, result):
    article = result.get("article") if isinstance(result.get("article"), dict) else {}
    analysis = result.get("analysis") if isinstance(result.get("analysis"), dict) else {}
    title = str(article.get("title") or fm.get("title") or "").strip()
    body = str(article.get("body_markdown") or "").strip()
    if not title or len(re.findall(r"\w+", body)) < 220:
        return False
    overstated, reason = headline_is_overstated(title, source.get("body", ""))
    if overstated:
        print(f"Rejected headline: {reason}")
        return False
    body = polish_body(body)
    seo = seo_fields(title, body, CATEGORY, AUTHOR)
    selected = choose_images(result, source["images"])
    for item in selected:
        item["url"] = upload_img(item["url"])
    body = inject_images(body, selected)
    primary = selected[2]["url"] if len(selected) >= 3 else (selected[0]["url"] if selected else fm.get("image") or source.get("featured", ""))
    fm.update({
        "title": seo["title"], "description": seo["description"], "excerpt": seo["excerpt"],
        "dateModified": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "image": primary,
        "editorialAngle": str(analysis.get("chosen_angle_gap") or "").strip()[:300],
        "angleType": str(analysis.get("angle_type") or "").strip()[:80],
        "selectedImages": json.dumps([{"url": x["url"], "alt": x["selected_alt"], "reason": x["reason"]} for x in selected], ensure_ascii=False),
        "schema": "NewsArticle",
    })
    order = ["title","slug","description","excerpt","date","dateModified","author","category","county","image","readTime","source","stylePreset","editorialAngle","angleType","selectedImages","schema"]
    lines = ["---"]
    used = set()
    for key in order:
        if key not in fm:
            continue
        used.add(key)
        value = fm[key]
        if key == "selectedImages":
            lines.append(f"{key}: {value}")
        elif key == "readTime":
            lines.append(f"{key}: {value}")
        elif key in ("date", "dateModified") and re.match(r"^\d{4}-\d{2}-\d{2}T", str(value)):
            lines.append(f"{key}: {value}")
        else:
            lines.append(f"{key}: {yaml_quote(value)}")
    for key, value in fm.items():
        if key not in used:
            lines.append(f"{key}: {yaml_quote(value)}")
    lines += ["---", "", body, ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Revamped {path} angle={fm['editorialAngle'][:120]} images={len(selected)}")
    return True


def main():
    target = find_target_post()
    if not target:
        print(f"No fresh {CATEGORY} post to revamp")
        return 0
    _, path, fm, raw = target
    source_url = str(fm.get("source") or "").strip()
    print(f"Revamping {path} from {source_url}")
    source = scrape_source(source_url)
    if not source or should_skip_story(source.get("body", "") + " " + str(fm.get("title", "")), CATEGORY):
        print("Source rejected by freshness/desk gate")
        return 0
    memory = read_memory()
    recent = recent_angle_context(memory)
    recent_angles = memory.get("revamp_angles", [])[-12:] if isinstance(memory.get("revamp_angles"), list) else []
    recent_text = "\n".join(str(x.get("angle", "")) for x in recent_angles if isinstance(x, dict))
    candidates = format_image_candidates(source["images"])
    prompt = f"""You are the senior editor of Za Ndani. Rebuild the supplied source material into an original {CATEGORY} article.

EDITORIAL STANDARD: REPORTING, NOT AI PARAPHRASING.
- The source is research material. Do not paraphrase it paragraph by paragraph, translate it, mirror its paragraph order, or imitate its headline.
- Do not try to sound different by making the story more dramatic. Difference must come from a different factual editorial question or reporting lens.
- First identify the source's dominant likely coverage angle.
- Generate several possible angles internally. Choose ONE that is materially different from that dominant angle and from recent Za Ndani angles, but only if the supplied facts genuinely support it.
- Good angle changes include: who is affected, what changes operationally, what readers must do next, timing, money, accountability, local impact, an overlooked factual detail, an official clarification, an unresolved factual question, or a concrete consequence directly supported by the source.
- If no genuinely different supported angle exists, return status=skip. Do not manufacture an angle merely to satisfy uniqueness.
- Never strengthen a source claim. For example, archived is not discarded; delayed is not cancelled; criticism is not proof; a warning is not an order; a possibility is not an outcome.
- Every strong factual claim in the headline must be explicitly supported by the source material. Prefer precise verbs such as said, announced, introduced, required, archived, opened, reported, confirmed or explained when those are what the source supports.
- Do not use sensational compression such as "X destroys", "X wipes out", "X crushes", "X discards all", or similar language unless the supplied source explicitly supports that wording.
- The headline must be written AFTER the reporting angle and article are established. It must accurately summarize the article, not manufacture a hook.
- Lead with a concrete fact, action, person, place, time or consequence. Avoid theatrical openings and generic AI introductions.
- Use ordinary newsroom language. Prefer specific nouns and active verbs. Vary sentence length naturally. Use short and medium paragraphs. Do not make every paragraph follow the same cadence.
- Do not write "This comes as", "The development marks", "In a significant move", "Against this backdrop", "As the country", or similar filler unless genuinely necessary.
- Do not end with a generic summary or moral. End when the useful reporting is complete.
- Do not mention the source publication or say you are rewriting it.
- Use only facts supported by the supplied source material. No invented quotes, motives, statistics, dates, consequences, experts or reactions.

SOURCE-FIDELITY CHECK BEFORE RETURNING JSON:
1. What exactly does the source say happened?
2. What does the source NOT say?
3. Does the headline use any stronger verb than the source supports? If yes, rewrite it.
4. Is the chosen angle genuinely a different lens, or just the same story with more dramatic wording? If the latter, skip or choose another supported lens.
5. Could a reader verify every important factual sentence from the supplied source? If not, remove it.

IMAGE EDITOR:
The source article's INTERNAL images are supplied below with their original ALT text, caption, context and dimensions. Decide which images actually belong in the new article. Do not choose an image merely because it is first or attractive. Avoid logos, icons, adverts, social-share graphics, decorative images and duplicates. You may select zero images. For every selected image, give concise ALT text describing what the image shows in the context of this article. Preserve the source index.

RECENT ZA NDANI ANGLES TO AVOID:
{recent}

RECENT REVAMP ANGLES TO AVOID:
{recent_text or '(none recorded)'}

SOURCE TITLE:
{fm.get('title','')}

SOURCE PUBLISHED:
{source.get('published','')}

SOURCE ARTICLE:
{source['body']}

INTERNAL IMAGE CANDIDATES:
{candidates or '(no usable internal images)'}

Return ONLY valid JSON matching this exact shape:
{{
  "status": "write" | "skip",
  "analysis": {{
    "main_event": "",
    "dominant_likely_coverage_angle": "",
    "chosen_angle_gap": "",
    "angle_type": "",
    "editorial_focus": "",
    "evidence_basis": "",
    "opening_pattern": "",
    "structure_pattern": ""
  }},
  "images": [{{"source_index": 1, "reason": "", "alt_text": ""}}],
  "article": {{"title": "", "dek": "", "slug": "", "seo_keywords": [], "body_markdown": ""}}
}}
"""
    for attempt in range(3):
        try:
            retry = "\n\nRETRY: Your previous draft was too close to the source or too interpretive. Rebuild from verified facts. Do not intensify wording. If no supported angle exists, return status=skip.\n" if attempt else ""
            result = parse_json(gemini(prompt + retry))
        except Exception as exc:
            print(f"Gemini error: {exc}")
            return 0
        if not result or str(result.get("status", "write")).lower() == "skip":
            return 0
        analysis = result.get("analysis") if isinstance(result.get("analysis"), dict) else {}
        angle = str(analysis.get("chosen_angle_gap") or "").strip()
        dominant = str(analysis.get("dominant_likely_coverage_angle") or "").strip()
        title = str((result.get("article") or {}).get("title") or "").strip()
        evidence = str(analysis.get("evidence_basis") or "").strip()
        if not angle or not title or not evidence:
            continue
        if dominant and similarity(angle, dominant) > 0.58:
            print("Rejected: chosen angle remains too close to source angle")
            continue
        if any(similarity(title, str(x.get("title", ""))) > 0.78 or similarity(angle, str(x.get("angle", ""))) > 0.58 for x in recent_angles if isinstance(x, dict)):
            continue
        if similarity(title, str(fm.get("title", ""))) > 0.86:
            continue
        overstated, reason = headline_is_overstated(title, source.get("body", ""))
        if overstated:
            print(f"Rejected: {reason}")
            continue
        if rewrite_post(path, fm, raw, source, result):
            memory.setdefault("revamp_angles", []).append({
                "title": title,
                "angle": angle,
                "angle_type": str(analysis.get("angle_type", "")),
                "evidence_basis": evidence,
                "source": source_url,
                "published_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
            write_memory(memory)
            return 0
    print("No acceptable unique, source-faithful angle produced")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
