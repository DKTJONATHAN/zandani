#!/usr/bin/env python3
"""Shared source-image pipeline for non-News Za Ndani desks.

Keeps desk workflows aligned with the Celestine News image rules:
- source article images only
- reject branding/logo assets through article_intelligence
- upload selected source images to ImgBB
- first two selected images are inserted deep in the article body
- third selected image is the OG/frontmatter image
- never trust model-generated image URLs
"""
from __future__ import annotations

import base64
import io
import json
import os
import re

import requests

from article_intelligence import extract_article_images

try:
    from PIL import Image
except Exception:
    Image = None


def _same(a: str, b: str) -> bool:
    def norm(v):
        return (v or "").strip().lower().split("?")[0].split("#")[0].rstrip("/")
    return bool(norm(a) and norm(b) and norm(a) == norm(b))


def select_images(candidates, featured=""):
    """Select up to three distinct source images, reusing only when necessary."""
    candidates = [x for x in (candidates or []) if isinstance(x, dict) and x.get("url")]
    ranked = []
    for item in candidates:
        if any(_same(item.get("url"), x.get("url")) for x in ranked):
            continue
        ranked.append({
            **item,
            "reason": "Selected from the scraped article image set",
            "selected_alt": str(item.get("alt") or item.get("caption") or "News image").strip()[:180] or "News image",
        })
    if not ranked:
        return []

    non_featured = [x for x in ranked if not _same(x.get("url"), featured)]
    selected = non_featured[:3]
    for item in ranked:
        if len(selected) >= 3:
            break
        if any(_same(item.get("url"), x.get("url")) for x in selected):
            continue
        selected.append(item)

    pool = non_featured or ranked
    if pool:
        while len(selected) < min(3, max(1, len(pool))):
            selected.append(pool[(len(selected) - len(non_featured)) % len(pool)])

    # If there are only one or two source images, reuse an available source image
    # only as the necessary fallback, matching the News pipeline's best-effort rule.
    while selected and len(selected) < 3:
        selected.append(selected[(len(selected) - 1) % len(selected)])

    return selected[:3]


def upload_to_imgbb(image_url: str, source_url: str = "") -> str:
    if not image_url or "ibb.co" in image_url or "imgbb.com" in image_url:
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
            return image_url

        encoded = None
        if Image is not None:
            try:
                img = Image.open(io.BytesIO(raw))
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")
                if img.width > 1600:
                    ratio = 1600 / float(img.width)
                    img = img.resize((1600, max(1, int(img.height * ratio))), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="WEBP", quality=84, method=4)
                encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
            except Exception as exc:
                print("WebP conversion failed:", exc)
        if encoded is None:
            encoded = base64.b64encode(raw).decode("utf-8")

        upload = requests.post(
            "https://api.imgbb.com/1/upload",
            data={"key": api_key, "image": encoded},
            timeout=35,
        )
        upload.raise_for_status()
        data = upload.json().get("data") or {}
        return data.get("url") or data.get("display_url") or image_url
    except Exception as exc:
        print("ImgBB upload failed:", exc)
        return image_url


def prepare_images(candidates, featured="", source_url=""):
    selected = select_images(candidates, featured)
    hosted = []
    for image in selected:
        source = image.get("url", "")
        hosted_url = upload_to_imgbb(source, source_url) or source
        hosted.append({**image, "source_url": source, "url": hosted_url})
    return hosted


def strip_generated_images(body: str) -> str:
    body = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body or "")
    body = re.sub(r"<img\b[^>]*>", "", body, flags=re.I)
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def inject_images(body: str, images) -> str:
    body = strip_generated_images(body)
    if len(images) < 2:
        return body
    paragraphs = [p for p in body.split("\n\n") if p.strip()]
    if len(paragraphs) < 4:
        return body

    n = len(paragraphs)
    first_after = max(4, min(n - 3, round(n * 0.30)))
    second_after = max(first_after + 3, min(n - 1, round(n * 0.65)))
    placements = {first_after: images[0], second_after: images[1]}

    result = []
    for i, paragraph in enumerate(paragraphs, 1):
        result.append(paragraph)
        image = placements.get(i)
        if image:
            alt = re.sub(r"[\[\]\r\n]", "", image.get("selected_alt") or image.get("alt") or "News image")[:180]
            result.append(f"![{alt}]({image['url']})")
    return "\n\n".join(result)


def selected_images_json(images):
    return json.dumps([
        {
            "url": x.get("url", ""),
            "alt": x.get("selected_alt") or x.get("alt") or x.get("caption") or "News image",
            "reason": x.get("reason", "Selected from the scraped article image set"),
        }
        for x in images
    ], ensure_ascii=False)
