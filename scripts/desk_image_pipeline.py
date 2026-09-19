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

from article_intelligence import extract_article_images, _looks_like_asset

try:
    from PIL import Image
except Exception:
    Image = None


def _same(a: str, b: str) -> bool:
    def norm(v):
        return (v or "").strip().lower().split("?")[0].split("#")[0].rstrip("/")
    return bool(norm(a) and norm(b) and norm(a) == norm(b))


def select_images(candidates, featured=""):
    """Select up to three distinct source-body images; never reuse an image."""
    candidates = [x for x in (candidates or []) if isinstance(x, dict) and x.get("url")]
    ranked = []
    seen = set()
    for item in candidates:
        url = (item.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        ranked.append({
            **item,
            "reason": "Selected from the scraped article image set",
            "selected_alt": str(item.get("alt") or item.get("caption") or "News image").strip()[:180] or "News image",
        })
    non_featured = [x for x in ranked if not _same(x.get("url"), featured)]
    selected = non_featured[:3]
    if not selected and ranked:
        selected = ranked[:1]
    return selected[:3]

def upload_to_imgbb(image_url: str, source_url: str = "") -> str:
    if not image_url or "ibb.co" in image_url or "imgbb.com" in image_url:
        return image_url
    api_key = os.environ.get("IMGBB_API_KEY") or os.environ.get("IMGBB_KEY")
    if not api_key:
        print("IMGBB_API_KEY missing — rejecting external image rather than publishing a hotlink")
        return ""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; ZandaniBot/1.0)"}
        if source_url:
            headers["Referer"] = source_url
        response = requests.get(image_url, headers=headers, timeout=25)
        response.raise_for_status()
        raw = response.content
        if len(raw) < 500:
            return ""

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
        return data.get("url") or data.get("display_url") or ""
    except Exception as exc:
        print("ImgBB upload failed:", exc)
        return ""


def prepare_images(candidates, featured="", source_url=""):
    selected = select_images(candidates, featured)
    hosted = []
    for image in selected:
        source = (image.get("url") or "").strip()
        if not source or _looks_like_asset(source, image.get("alt", ""), image.get("caption", "")):
            continue
        hosted_url = upload_to_imgbb(source, source_url) or source
        if _looks_like_asset(hosted_url, image.get("alt", ""), image.get("caption", "")):
            continue
        hosted.append({**image, "source_url": source, "url": hosted_url})
    return hosted

def strip_generated_images(body: str) -> str:
    body = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body or "")
    body = re.sub(r"<img\b[^>]*>", "", body, flags=re.I)
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def inject_images(body: str, images) -> str:
    """Insert up to two distinct trusted images deep in the article body."""
    body = strip_generated_images(body)
    trusted = []
    seen = set()
    for image in images or []:
        source = (image.get("source_url") or "").strip()
        hosted = (image.get("url") or "").strip()
        if not source or not hosted or source in seen or hosted in seen:
            continue
        if _looks_like_asset(source, image.get("alt", ""), image.get("caption", "")) or _looks_like_asset(hosted, image.get("alt", ""), image.get("caption", "")):
            continue
        seen.add(source); seen.add(hosted); trusted.append(image)
    if not trusted:
        return body
    paragraphs = [p for p in body.split("\n\n") if p.strip()]
    if len(paragraphs) < 4:
        return body
    n = len(paragraphs)
    first = max(2, min(n - 1, round(n * 0.30)))
    placements = {first: trusted[0]}
    if len(trusted) >= 2:
        placements[max(first + 2, min(n - 1, round(n * 0.65)))] = trusted[1]
    result = []
    for i, paragraph in enumerate(paragraphs, 1):
        result.append(paragraph)
        image = placements.get(i)
        if image:
            alt = re.sub(r"[\[\]\r\n]", "", image.get("selected_alt") or image.get("alt") or image.get("caption") or "News image")[:180]
            result.append(f"![{alt}]({image['url']})")
    return "\n\n".join(result)

def selected_images_json(images):
    return json.dumps([
        {
            "url": x.get("url", ""),
            "source_url": x.get("source_url", ""),
            "alt": x.get("selected_alt") or x.get("alt") or x.get("caption") or "News image",
            "reason": x.get("reason", "Selected from the scraped article image set"),
        }
        for x in images
    ], ensure_ascii=False)
