#!/usr/bin/env python3
"""Celestine News v2: image-aware, angle-first Zandani newsroom pipeline."""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import sys

import requests

import celestine_news as base
from article_intelligence import extract_article_images, format_image_candidates, recent_angle_context
try:
    from PIL import Image
except Exception:
    Image = None
from voice_guard import (
    news_prompt,
    seo_fields,
    is_fresh_enough,
    mentions_stale_year,
    should_skip_story,
    model_skipped,
    is_spam as vg_is_spam,
    polish_body,
    extract_published_dt,
)

MAX_IMAGES = 12
MAX_SELECTED_IMAGES = 3
ANGLE_RETRIES = 3


def article_root(soup):
    for sel in ["article", ".node__content", ".field--name-body", ".article__body", "main article", ".content"]:
        node = soup.select_one(sel)
        if node and len(node.find_all("p")) >= 3:
            return node
    return soup


def scrape_article_v2(url):
    try:
        soup = base.browser_page(url, 1600)
    except Exception as exc:
        print(f"Scrape failed: {exc}")
        return None
    fresh, age_h = is_fresh_enough(soup, max_hours=base.FRESH_HOURS)
    if not fresh:
        if age_h is None:
            print("Skipping stale story: no usable publish-date signal")
        else:
            print(f"Skipping stale story: {age_h:.1f}h")
        return None
    root = article_root(soup)
    title_tag = soup.find("title")
    title = title_tag.get_text(" ", strip=True) if title_tag else ""
    for sep in [" | ", " - "]:
        if sep in title:
            title = title.split(sep)[0].strip()
    paragraphs = [p.get_text(" ", strip=True) for p in root.find_all("p") if len(p.get_text(strip=True)) > 30]
    text = "\n\n".join(paragraphs)
    if len(text) < 500:
        text = "\n\n".join(p.get_text(" ", strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30)
    if len(text) < 500 or mentions_stale_year(text, base.now_eat.year):
        return None
    images = extract_article_images(soup, url, root, limit=MAX_IMAGES)
    featured = ""
    for meta in soup.find_all("meta"):
        prop = meta.get("property") or meta.get("name") or ""
        if prop in ("og:image", "twitter:image"):
            featured = meta.get("content", "")
            break
    published = ""
    pt = extract_published_dt(soup)
    if pt:
        published = pt.isoformat()
    return {"title": title, "text": text, "images": images, "featured": featured, "published": published}


def parse_result(raw):
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
        raw = re.sub(r"\s*```$", "", raw)
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def _same_image(a: str, b: str) -> bool:
    def norm(url: str) -> str:
        url = (url or "").strip().lower()
        url = url.split("?")[0].split("#")[0]
        return url.rstrip("/")
    return bool(norm(a) and norm(b) and norm(a) == norm(b))


def choose_images(data, candidates, original_featured=""):
    """
    Build three image slots on a best-effort basis:
      - first two slots are for article-body images
      - third slot is for OG/social metadata

    Prefer three distinct non-featured images. If the source article does not
    provide three distinct images, use every distinct image that is available
    and then reuse the least-preferred image only as a necessary fallback.
    The OG slot prefers an image different from the source article's featured
    image whenever such an image exists.
    """
    items = data.get("images", []) if isinstance(data.get("images"), list) else []
    requested = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            requested.append(int(item.get("source_index")))
        except Exception:
            pass

    # Respect Gemini's ranking first, then fill from every scraped candidate.
    order = []
    for idx in requested + [x.get("index") for x in candidates]:
        if idx is not None and idx not in order:
            order.append(idx)

    by_index = {int(x["index"]): x for x in candidates if x.get("index") is not None}
    ranked = []
    for idx in order:
        source = by_index.get(idx)
        if not source:
            continue
        if any(_same_image(source.get("url", ""), x.get("url", "")) for x in ranked):
            continue
        ranked.append({
            **source,
            "reason": "Selected from the scraped article image set",
            "selected_alt": str(source.get("alt") or source.get("caption") or "News image").strip()[:180] or "News image",
        })

    # Add any candidates Gemini did not rank, preserving distinct URLs.
    for source in candidates:
        if any(_same_image(source.get("url", ""), x.get("url", "")) for x in ranked):
            continue
        ranked.append({
            **source,
            "reason": "Additional distinct image scraped from the source article",
            "selected_alt": str(source.get("alt") or source.get("caption") or "News image").strip()[:180] or "News image",
        })

    if not ranked:
        print("No usable scraped images were found.")
        return []

    non_featured = [
        x for x in ranked
        if not _same_image(x.get("url", ""), original_featured)
    ]

    # Best case: three distinct non-featured images.
    if len(non_featured) >= 3:
        selected = non_featured[:3]
    else:
        # Best-effort fallback: use all available distinct images first.
        selected = non_featured[:]
        for source in ranked:
            if len(selected) >= 3:
                break
            if any(_same_image(source.get("url", ""), x.get("url", "")) for x in selected):
                continue
            selected.append(source)

        # If fewer than three distinct images exist, reuse available images
        # rather than rejecting the story. This keeps the publishing pipeline
        # running while preserving distinct assets whenever the source allows.
        if len(selected) < 3:
            pool = non_featured or ranked
            while len(selected) < 3:
                selected.append(pool[(len(selected) - len(non_featured)) % len(pool)])
            print(
                f"Only {len(ranked)} distinct scraped image(s) available; "
                "reusing an available image only where necessary."
            )

    # The third slot is OG. Whenever possible, make it different from the
    # source article's featured image and different from the first two slots.
    if len(selected) >= 3 and _same_image(selected[2].get("url", ""), original_featured):
        alternatives = [
            x for x in non_featured
            if not any(_same_image(x.get("url", ""), selected[i].get("url", "")) for i in (0, 1))
        ]
        if alternatives:
            selected[2] = alternatives[0]
        elif non_featured:
            selected[2] = non_featured[0]

    return selected[:3]


def upload_to_imgbb(image_url: str, source_url: str = "") -> str:
    """Re-host a scraped image on ImgBB, returning the hosted URL."""
    if not image_url:
        return ""
    if "ibb.co" in image_url or "imgbb.com" in image_url:
        return image_url
    api_key = os.environ.get("IMGBB_API_KEY") or os.environ.get("IMGBB_KEY")
    if not api_key:
        print("IMGBB_API_KEY missing — keeping source image URL")
        return image_url
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; ZandaniBot/1.0)"}
        if source_url:
            headers["Referer"] = source_url
        response = requests.get(image_url, headers=headers, timeout=25)
        response.raise_for_status()
        raw = response.content
        if len(raw) < 500:
            print(f"Image too small ({len(raw)} bytes) — keeping source URL")
            return image_url

        encoded = None
        if Image is not None:
            try:
                img = Image.open(io.BytesIO(raw))
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")
                max_w = 1600
                if img.width > max_w:
                    ratio = max_w / float(img.width)
                    img = img.resize((max_w, max(1, int(img.height * ratio))), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="WEBP", quality=84, method=4)
                encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
            except Exception as exc:
                print(f"WebP conversion failed ({exc}); uploading original bytes")
        if encoded is None:
            encoded = base64.b64encode(raw).decode("utf-8")

        upload = requests.post(
            "https://api.imgbb.com/1/upload",
            data={"key": api_key, "image": encoded},
            timeout=35,
        )
        upload.raise_for_status()
        payload = upload.json().get("data") or {}
        hosted = payload.get("url") or payload.get("display_url") or ""
        if hosted:
            print(f"ImgBB hosted: {hosted}")
            return hosted
        print("ImgBB response did not contain a hosted URL; keeping source URL")
    except Exception as exc:
        print(f"ImgBB upload failed: {exc}; keeping source URL")
    return image_url


def title_similarity(a, b):
    stop = {"the","a","an","of","to","in","on","for","and","or","with","from","by","after","over","new","kenya","kenyan"}
    wa = {x for x in re.findall(r"[a-z0-9]+", (a or "").lower()) if x not in stop and len(x) > 3}
    wb = {x for x in re.findall(r"[a-z0-9]+", (b or "").lower()) if x not in stop and len(x) > 3}
    return len(wa & wb) / max(1, len(wa | wb))


def inject_images(body, images):
    """Place only the first two selected images deep in the article body."""
    if len(images) < 2:
        return body
    paragraphs = [p for p in body.split("\n\n") if p.strip()]
    if len(paragraphs) < 4:
        print("Article body is too short for deep image placement; skipping image injection.")
        return body

    # Deliberately avoid paragraph 2. Target roughly 30% and 65% into the story,
    # with safe minimum gaps so the images are distributed rather than clustered.
    n = len(paragraphs)
    first_after = max(4, min(n - 3, round(n * 0.30)))
    second_after = max(first_after + 3, min(n - 1, round(n * 0.65)))
    placements = {first_after: images[0], second_after: images[1]}

    result = []
    for i, paragraph in enumerate(paragraphs, 1):
        result.append(paragraph)
        img = placements.get(i)
        if img:
            alt = re.sub(r"[\[\]\r\n]", "", img.get("selected_alt") or img.get("alt") or "News image")[:180]
            result.append(f"![{alt}]({img['url']})")
    return "\n\n".join(result)


def write_post_v2(title, body, source, style, analysis, images):
    body = polish_body(body)
    seo = seo_fields(title, body, base.CATEGORY, base.AUTHOR_NAME)
    slug = f"{base.today_str}-{base.slugify(seo['title'])}"
    path = os.path.join(base.POSTS_DIR, f"{slug}.md")
    os.makedirs(base.POSTS_DIR, exist_ok=True)
    # Third image is reserved for OG/social metadata; first two are body images.
    primary = images[2]["url"] if len(images) >= 3 else (images[0]["url"] if images else "")
    image_meta = [{"url": x.get("url", ""), "alt": x.get("selected_alt", ""), "reason": x.get("reason", "")} for x in images]
    angle = str(analysis.get("chosen_angle_gap", "")).replace('"', "'")[:300]
    angle_type = str(analysis.get("angle_type", "")).replace('"', "'")[:80]
    lines = [
        "---", f'title: "{seo["title"]}"', f'slug: "{slug}"',
        f'description: "{seo["description"]}"', f'excerpt: "{seo["excerpt"]}"',
        f"date: {base.publish_ts}", f"dateModified: {base.publish_ts}",
        f'author: "{base.AUTHOR_NAME}"', f'category: "{base.CATEGORY}"',
        f'county: "{seo["county"]}"', f'image: "{primary}"',
        f"readTime: {max(3, len(body.split()) // 180)}", f'source: "{source["url"]}"',
        f'stylePreset: "{style["name"]}"', f'editorialAngle: "{angle}"', f'angleType: "{angle_type}"',
        "selectedImages: " + json.dumps(image_meta, ensure_ascii=False), 'schema: "NewsArticle"', "---", "", body, ""
    ]
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    print(f"Wrote {path} angle={angle[:120]}")


def main():
    memory = base.load_memory()
    memory.setdefault("published_angles", [])
    style = base.pick_style(memory.get("style_history", []))
    print(f"[{base.AUTHOR_NAME}] v2 editorial run @ {base.publish_ts} style={style['name']}")
    links = base.get_target_urls()
    seen = set(memory.get("published_hashes", []))
    recent = recent_angle_context(memory)
    for link in links[:base.MAX_SCRAPE_TRIES]:
        canon = base.canonicalize_url(link)
        h = hashlib.md5(canon.encode()).hexdigest()
        if h in seen:
            continue
        source = scrape_article_v2(link)
        if not source or should_skip_story(source["title"] + " " + source["text"], base.CATEGORY):
            continue
        result = None
        for attempt in range(ANGLE_RETRIES):
            prompt = news_prompt(base.AUTHOR_NAME, base.full_date_str, style, source["title"], source["text"], role="correspondent", desk=base.CATEGORY, source_published=source.get("published", ""), image_candidates=format_image_candidates(source["images"]), recent_angles=recent)
            if attempt:
                prompt += "\n<EDITORIAL_RETRY>Choose a materially different angle from recent Zandani coverage and rebuild the article. Do not merely change wording. Preserve factual support.\n</EDITORIAL_RETRY>\n"
            result = parse_result(base.gemini_call(prompt, "news-v2-write"))
            if not result or str(result.get("status", "write")).lower() == "skip":
                break
            analysis = result.get("analysis") if isinstance(result.get("analysis"), dict) else {}
            angle = str(analysis.get("chosen_angle_gap") or "").strip()
            article_title = str((result.get("article") or {}).get("title") or "")
            recent_titles = [x.get("title", "") for x in memory.get("published_angles", []) if isinstance(x, dict)]
            if not angle or any(title_similarity(article_title, t) > 0.82 for t in recent_titles[-12:]):
                result = None
                continue
            break
        if not result:
            continue
        article_data = result.get("article") if isinstance(result.get("article"), dict) else {}
        body = str(article_data.get("body_markdown") or "").strip()
        title = str(article_data.get("title") or source["title"]).strip()
        if not body or len(re.findall(r"\w+", body)) < 220 or model_skipped(body) or vg_is_spam(body) or base.is_spam(body):
            continue
        analysis = result.get("analysis") if isinstance(result.get("analysis"), dict) else {}
        selected = choose_images(result, source["images"], source.get("featured", ""))
        if not selected:
            print("No scraped image available; publishing story without image assets.")
            hosted = []
        else:
            # Upload each selected slot independently. Distinct source images
            # become distinct ImgBB assets; unavoidable fallback reuse is kept
            # only when the source itself provides too few images.
            hosted = []
            for image in selected:
                hosted_url = upload_to_imgbb(image["url"], link)
                if not hosted_url:
                    hosted_url = image["url"]
                hosted.append({**image, "source_url": image["url"], "url": hosted_url})

        # The first two slots are body images and the third is OG/social metadata.
        # Never intentionally replace the OG slot with the source featured image
        # when another scraped image is available.
        hosted = []
        for image in selected:
            hosted_url = upload_to_imgbb(image["url"], link)
            if not hosted_url:
                hosted_url = image["url"]
            hosted.append({**image, "source_url": image["url"], "url": hosted_url})
        if len({x["url"] for x in hosted}) < 3:
            print("Skipping story: ImgBB hosting collapsed two image URLs; refusing to reuse.")
            continue

        body = inject_images(body, hosted)
        write_post_v2(title, body, {**source, "url": link}, style, analysis, hosted)
        memory["published_hashes"].append(h)
        memory["published_urls"].append(canon)
        memory["published_titles"].append(base.norm_title(title))
        memory["style_history"].append(style["name"])
        memory["published_angles"].append({"title": title, "angle": str(analysis.get("chosen_angle_gap", "")), "angle_type": str(analysis.get("angle_type", "")), "opening": str(analysis.get("opening_pattern", "")), "structure": str(analysis.get("structure_pattern", "")), "source": link, "published_at": base.publish_ts})
        base.save_memory(memory)
        return 0
    base.save_memory(memory)
    print("No suitable story")
    return 0


if __name__ == "__main__":
    sys.exit(main())
