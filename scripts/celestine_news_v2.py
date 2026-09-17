#!/usr/bin/env python3
"""Celestine News v2: image-aware, angle-first Zandani newsroom pipeline."""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys

import celestine_news as base
from article_intelligence import extract_article_images, format_image_candidates, recent_angle_context
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


def choose_images(data, candidates):
    selected = []
    items = data.get("images", []) if isinstance(data.get("images"), list) else []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item.get("source_index"))
        except Exception:
            continue
        if idx < 1 or idx > len(candidates) or any(x["index"] == idx for x in selected):
            continue
        source = candidates[idx - 1]
        alt = str(item.get("alt_text") or source.get("alt") or source.get("caption") or "News image").strip()[:180]
        selected.append({**source, "reason": str(item.get("reason") or "Supports the story"), "selected_alt": alt or "News image"})
        if len(selected) >= MAX_SELECTED_IMAGES:
            break
    return selected


def title_similarity(a, b):
    stop = {"the","a","an","of","to","in","on","for","and","or","with","from","by","after","over","new","kenya","kenyan"}
    wa = {x for x in re.findall(r"[a-z0-9]+", (a or "").lower()) if x not in stop and len(x) > 3}
    wb = {x for x in re.findall(r"[a-z0-9]+", (b or "").lower()) if x not in stop and len(x) > 3}
    return len(wa & wb) / max(1, len(wa | wb))


def inject_images(body, images):
    if not images:
        return body
    paragraphs = [p for p in body.split("\n\n") if p.strip()]
    result = []
    placements = {1: 0, 4: 1, 7: 2}
    for i, paragraph in enumerate(paragraphs, 1):
        result.append(paragraph)
        if i in placements and placements[i] < len(images):
            img = images[placements[i]]
            alt = re.sub(r"[\[\]\r\n]", "", img.get("selected_alt") or img.get("alt") or "News image")[:180]
            result.append(f"![{alt}]({img['url']})")
    return "\n\n".join(result)


def write_post_v2(title, body, source, style, analysis, images):
    body = polish_body(body)
    seo = seo_fields(title, body, base.CATEGORY, base.AUTHOR_NAME)
    slug = f"{base.today_str}-{base.slugify(seo['title'])}"
    path = os.path.join(base.POSTS_DIR, f"{slug}.md")
    os.makedirs(base.POSTS_DIR, exist_ok=True)
    primary = images[0]["url"] if images else source.get("featured", "")
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
        selected = choose_images(result, source["images"])
        body = inject_images(body, selected)
        write_post_v2(title, body, {**source, "url": link}, style, analysis, selected)
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
