#!/usr/bin/env python3
"""Shared post-generation editorial revamp for Zandani desks.

Takes the fresh post produced by an existing desk writer, re-reads its source,
extracts article-local images with their ALT/caption/context, and asks Gemini to
rebuild the article around a materially different Zandani angle. The original
desk scraper/writer remains responsible for source discovery and desk identity.
"""
from __future__ import annotations

import base64
import glob
import hashlib
import io
import json
import os
import re
import time
import urllib.parse

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types
from playwright.sync_api import sync_playwright

from article_intelligence import extract_article_images, format_image_candidates, recent_angle_context
from voice_guard import extract_published_dt, is_fresh_enough, mentions_stale_year, polish_body, should_skip_story, seo_fields, model_skipped, is_spam

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
    fresh, age = is_fresh_enough(soup, max_hours=MAX_AGE)
    if not fresh:
        return None
    root = article_root(soup)
    paragraphs = [p.get_text(" ", strip=True) for p in root.find_all("p") if len(p.get_text(strip=True)) > 30]
    body = "\n\n".join(paragraphs)
    if len(body) < 500:
        body = "\n\n".join(p.get_text(" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30)
    if len(body) < 500 or mentions_stale_year(body, __import__("datetime").datetime.utcnow().year + 3):
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
                    config=types.GenerateContentConfig(temperature=0.72, max_output_tokens=6000),
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
    selected = []
    items = data.get("images") if isinstance(data.get("images"), list) else []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item.get("source_index"))
        except Exception:
            continue
        if not 1 <= idx <= len(candidates) or any(x["index"] == idx for x in selected):
            continue
        src = candidates[idx - 1]
        alt = str(item.get("alt_text") or src.get("alt") or src.get("caption") or "News image").strip()[:180]
        selected.append({**src, "reason": str(item.get("reason") or "Directly supports the reported detail")[:240], "selected_alt": alt or "News image"})
        if len(selected) >= MAX_SELECTED:
            break
    return selected


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
    if not images:
        return body
    blocks = [x for x in body.split("\n\n") if x.strip()]
    out = []
    positions = [1, 4, 7]
    for i, block in enumerate(blocks, 1):
        out.append(block)
        if i <= len(positions) and i == positions[i - 1]:
            image = images[i - 1]
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


def rewrite_post(path, fm, old_body, source, result):
    article = result.get("article") if isinstance(result.get("article"), dict) else {}
    analysis = result.get("analysis") if isinstance(result.get("analysis"), dict) else {}
    title = str(article.get("title") or fm.get("title") or "").strip()
    body = str(article.get("body_markdown") or "").strip()
    if not title or len(re.findall(r"\w+", body)) < 220:
        return False
    body = polish_body(body)
    seo = seo_fields(title, body, CATEGORY, AUTHOR)
    selected = choose_images(result, source["images"])
    for item in selected:
        item["url"] = upload_img(item["url"])
    body = inject_images(body, selected)
    primary = selected[0]["url"] if selected else fm.get("image") or source.get("featured", "")
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

SOURCE IS RESEARCH, NOT A TEMPLATE.
- Do not paraphrase paragraph by paragraph, translate, mirror the source order, or reuse its headline structure.
- First identify the source's dominant likely coverage angle.
- Generate several possible editorial angles internally, then choose ONE that is materially different from that dominant angle and from recent Za Ndani angles.
- A new angle must change the editorial question or lens: consequence, money, accountability, people affected, local impact, timing, practical change, institutional pressure, unresolved factual issue, or another concrete lens supported by the supplied facts.
- Never invent facts to create an angle. If a tempting angle is unsupported, reject it.
- Avoid generic formulaic openings and repeated newsroom filler. Write with specific nouns, active verbs, varied sentence length and short/medium paragraphs.
- Report first, observe second, remain useful throughout. Do not write like a content spinner.
- Do not mention the source publication or say you are rewriting it.
- Use only facts supported by the supplied source material.

IMAGE EDITOR:
The source article's INTERNAL images are supplied below with their original ALT text, caption, context and dimensions. Decide which images actually belong in the new article. Do not choose an image merely because it is first or attractive. Avoid logos, icons, adverts, social-share graphics, decorative images and duplicates. You may select zero images. For every selected image, give a concise ALT text describing what the image shows in the context of this article. Preserve the source index.

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
    "opening_pattern": "",
    "structure_pattern": ""
  }},
  "images": [{{"source_index": 1, "reason": "", "alt_text": ""}}],
  "article": {{"title": "", "dek": "", "slug": "", "seo_keywords": [], "body_markdown": ""}}
}}
"""
    for attempt in range(3):
        try:
            result = parse_json(gemini(prompt + ("\n\nRETRY: materially change the editorial angle; do not merely change wording or headline.\n" if attempt else "")))
        except Exception as exc:
            print(f"Gemini error: {exc}")
            return 0
        if not result or str(result.get("status", "write")).lower() == "skip":
            return 0
        analysis = result.get("analysis") if isinstance(result.get("analysis"), dict) else {}
        angle = str(analysis.get("chosen_angle_gap") or "").strip()
        title = str((result.get("article") or {}).get("title") or "").strip()
        if not angle or not title:
            continue
        if any(similarity(title, str(x.get("title", ""))) > 0.78 or similarity(angle, str(x.get("angle", ""))) > 0.58 for x in recent_angles if isinstance(x, dict)):
            continue
        if similarity(title, str(fm.get("title", ""))) > 0.86:
            continue
        if rewrite_post(path, fm, raw, source, result):
            memory.setdefault("revamp_angles", []).append({"title": title, "angle": angle, "angle_type": str(analysis.get("angle_type", "")), "source": source_url, "published_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
            write_memory(memory)
            return 0
    print("No acceptable unique angle produced")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
