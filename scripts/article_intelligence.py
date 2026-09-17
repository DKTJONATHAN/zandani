#!/usr/bin/env python3
"""Shared editorial intelligence for Zandani article pipelines.

Extracts meaningful in-article image candidates and prepares compact editorial
memory for Gemini. It deliberately uses source-provided alt/caption/context
rather than pretending to visually inspect remote images.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse


IMAGE_LIMIT = 12


def _clean(value: str, limit: int = 260) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value[:limit]


def _absolute_url(src: str, page_url: str) -> str:
    if not src:
        return ""
    return urljoin(page_url, src.strip())


def _src_from_img(img) -> str:
    for attr in ("src", "data-src", "data-lazy-src", "data-original", "data-url"):
        value = img.get(attr)
        if value and not str(value).startswith("data:"):
            return str(value)
    srcset = img.get("srcset") or img.get("data-srcset")
    if srcset:
        first = str(srcset).split(",")[0].strip().split(" ")[0]
        return first
    return ""


def _looks_like_asset(url: str, alt: str, caption: str) -> bool:
    blob = f"{url} {alt} {caption}".lower()
    junk = (
        "logo", "icon", "avatar", "sprite", "pixel", "tracking", "placeholder",
        "favicon", "advert", "banner-ad", "social-share", "whatsapp", "facebook",
        "twitter", "telegram", "loading", "spinner"
    )
    return any(x in blob for x in junk)


def extract_article_images(soup, page_url: str, article_root=None, limit: int = IMAGE_LIMIT):
    """Return meaningful internal article image candidates with alt/caption/context."""
    root = article_root or soup
    candidates = []
    seen = set()

    for img in root.find_all("img"):
        src = _absolute_url(_src_from_img(img), page_url)
        if not src or src in seen or _looks_like_asset(src, img.get("alt", ""), ""):
            continue

        alt = _clean(img.get("alt", ""), 240)
        title = _clean(img.get("title", ""), 180)
        caption = ""
        figure = img.find_parent("figure")
        if figure:
            cap = figure.find("figcaption")
            if cap:
                caption = _clean(cap.get_text(" ", strip=True), 300)
        if not caption and title:
            caption = title

        # Prefer descriptive images. A source image with no alt/caption is still
        # retained if it has a normal image URL and article context.
        parent = figure or img.parent
        context = ""
        if parent:
            context = _clean(parent.get_text(" ", strip=True), 360)
        if not context:
            prev = img.find_previous("p")
            nxt = img.find_next("p")
            context = _clean(" ".join(x.get_text(" ", strip=True) for x in (prev, nxt) if x), 360)

        width = img.get("width") or ""
        height = img.get("height") or ""
        candidates.append({
            "index": len(candidates) + 1,
            "url": src,
            "alt": alt,
            "caption": caption,
            "context": context,
            "width": str(width),
            "height": str(height),
        })
        seen.add(src)
        if len(candidates) >= limit:
            break

    return candidates


def format_image_candidates(images) -> str:
    if not images:
        return "NO INTERNAL IMAGE CANDIDATES FOUND."
    blocks = []
    for image in images:
        blocks.append(
            "IMAGE {index}\nURL: {url}\nALT: {alt}\nCAPTION: {caption}\nCONTEXT: {context}\nDIMENSIONS: {width}x{height}".format(
                index=image.get("index", ""),
                url=image.get("url", ""),
                alt=image.get("alt") or "(missing)",
                caption=image.get("caption") or "(missing)",
                context=image.get("context") or "(not available)",
                width=image.get("width") or "?",
                height=image.get("height") or "?",
            )
        )
    return "\n\n".join(blocks)


def recent_angle_context(memory: dict, limit: int = 12) -> str:
    angles = memory.get("published_angles", []) if isinstance(memory, dict) else []
    if not angles:
        return "NO RECENT ZANDANI ANGLE MEMORY AVAILABLE."
    blocks = []
    for item in angles[-limit:]:
        if not isinstance(item, dict):
            continue
        blocks.append(
            "TITLE: {title}\nANGLE: {angle}\nANGLE TYPE: {angle_type}\nOPENING: {opening}\nSTRUCTURE: {structure}".format(
                title=_clean(str(item.get("title", "")), 180),
                angle=_clean(str(item.get("angle", "")), 300),
                angle_type=_clean(str(item.get("angle_type", "")), 80),
                opening=_clean(str(item.get("opening", "")), 180),
                structure=_clean(str(item.get("structure", "")), 180),
            )
        )
    return "\n\n".join(blocks) or "NO RECENT ZANDANI ANGLE MEMORY AVAILABLE."


def build_image_markdown(image: dict, alt_override: str = "") -> str:
    """Build a safe markdown image from a Gemini-selected source candidate."""
    url = image.get("url", "")
    alt = alt_override or image.get("alt") or image.get("caption") or "News image"
    alt = re.sub(r"[\[\]\r\n]", "", alt).strip()[:180]
    return f"![{alt}]({url})" if url else ""
