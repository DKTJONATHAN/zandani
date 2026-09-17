"""Post-write gate for every Za Ndani desk.

Validates and polishes recently touched posts. Revamped posts are treated as
editorially final: they keep their source-faithful angle, selected images and
natural newsroom copy instead of being passed through the legacy normalizer.
Invalid/thin posts are logged and skipped (or dropped when spam/not Kenya-first)
but never fail the whole desk job.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys
import time

from voice_guard import is_spam, polish_body, should_skip_story

POSTS = pathlib.Path("content/posts")
MAX_AGE_SEC = 40 * 60
REQUIRED_FIELDS = {"title", "slug", "date", "category", "author", "image"}
CANONICAL_CATEGORIES = {
    "news", "entertainment", "sports", "business", "technology", "agriculture",
    "africa", "lifestyle", "opinions", "opinion", "diano", "jaj",
    "showbiz", "gossip", "celebrity", "music",
}


def split_fm(text: str):
    if not text.startswith("---"):
        return "", text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return "", text
    return parts[1], parts[2]


def fields_of(fm: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in fm.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def category_of(fm: str) -> str:
    return fields_of(fm).get("category", "News")


def title_of(fm: str) -> str:
    return fields_of(fm).get("title", "")


def is_revamped(fm: str) -> bool:
    data = fields_of(fm)
    return bool(data.get("editorialAngle") or data.get("selectedImages"))


def validate_post(path: pathlib.Path, fm: str, body: str) -> list[str]:
    data = fields_of(fm)
    errors = []
    missing = sorted(k for k in REQUIRED_FIELDS if not data.get(k))
    if missing:
        errors.append("missing: " + ", ".join(missing))
    category = data.get("category", "").lower().strip()
    if category and category not in CANONICAL_CATEGORIES:
        errors.append(f"unsupported category: {category}")
    try:
        if data.get("date"):
            from datetime import datetime
            datetime.fromisoformat(data["date"].replace("Z", "+00:00"))
    except ValueError:
        errors.append("invalid ISO date")
    if data.get("publishDate"):
        try:
            from datetime import datetime
            datetime.fromisoformat(data["publishDate"].replace("Z", "+00:00"))
        except ValueError:
            errors.append("invalid ISO publishDate")
    if len((body or "").split()) < 180 and category not in {"opinions", "opinion"}:
        errors.append("body below 180 words")
    if not body.strip():
        errors.append("empty body")
    if not data.get("image") or data.get("image", "").lower().endswith("placeholder.jpg"):
        errors.append("missing real image")
    return errors


def main() -> int:
    now = time.time()
    if not POSTS.exists():
        print("No posts dir")
        return 0

    # Legacy polishing is useful for ordinary desk output, but it must not
    # rewrite an article that the new editorial revamp has already finalized.
    polish = pathlib.Path("scripts/polish_new_posts.py")
    if polish.exists():
        legacy_paths = []
        for path in POSTS.glob("*.md"):
            try:
                if now - path.stat().st_mtime > MAX_AGE_SEC:
                    continue
                text = path.read_text(encoding="utf-8")
                fm, _ = split_fm(text)
                if not is_revamped(fm):
                    legacy_paths.append(str(path))
            except Exception:
                continue
        if legacy_paths:
            subprocess.run([sys.executable, str(polish), *legacy_paths], check=False)

    dropped = 0
    touched = 0
    invalid = 0
    for path in POSTS.glob("*.md"):
        try:
            if now - path.stat().st_mtime > MAX_AGE_SEC:
                continue
            text = path.read_text(encoding="utf-8")
            fm, body = split_fm(text)
            revamped = is_revamped(fm)
            errors = validate_post(path, fm, body)
            if errors:
                print(f"WARN publication validation: {path.name}: {'; '.join(errors)}")
                invalid += 1
                continue
            cat = category_of(fm)
            title = title_of(fm)
            blob = title + "\n" + body
            if should_skip_story(blob, cat) and cat.lower() not in {"opinions", "opinion"}:
                print(f"DROP not Kenya-first: {path.name}")
                path.unlink()
                dropped += 1
                continue
            # Revamped articles have already passed source-fidelity, angle and
            # image selection. Keep their copy byte-for-byte intact here.
            if revamped:
                continue
            cleaned = polish_body(body, cat, title)
            if is_spam(cleaned, min_words=180) and cat.lower() not in {"opinions", "opinion"}:
                print(f"DROP spam/thin: {path.name}")
                path.unlink()
                dropped += 1
                continue
            if cleaned != body:
                path.write_text("---" + fm + "---\n" + cleaned.lstrip("\n"), encoding="utf-8")
                touched += 1
        except Exception as exc:
            print(f"WARN publication validation error: {path.name}: {exc}")
            invalid += 1

    print(f"finish_desk: touched={touched} dropped={dropped} invalid={invalid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
