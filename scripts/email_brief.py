#!/usr/bin/env python3
"""Za Ndani story brief via Resend.

Subscribers live in Supabase `newsletter_subscribers`. Send layer is Resend
(RESEND_API_KEY). Do not print full addresses in logs.

HTTP uses curl (available on GitHub Actions runners). Python urllib
from GHA has been seen to hit Cloudflare error 1010 on api.resend.com.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from html import escape

EAT = timezone(timedelta(hours=3))
SITE = "https://zandani.co.ke"
LOGO = f"{SITE}/logo.png"
POSTS = pathlib.Path("content/posts")
SUPABASE_REST = "/rest/v1/newsletter_subscribers"
RESEND = "https://api.resend.com"
FROM_DEFAULT = "Za Ndani <brief@zandani.co.ke>"

# Brand palette (inline-only — email clients strip <style>)
BG = "#0a0a0a"
CARD = "#141414"
BORDER = "#262626"
TEXT = "#f5f0e8"
MUTED = "#9a9388"
DIM = "#6a655c"
ACCENT = "#e85d04"


def eat_now() -> datetime:
    return datetime.now(EAT)


def mask(email: str) -> str:
    if "@" not in email:
        return "***"
    name, domain = email.split("@", 1)
    keep = name[:1] if name else "*"
    return f"{keep}***@{domain}"


def split_fm(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta: dict[str, str] = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, parts[2]


def kenya_score(blob: str) -> int:
    t = blob.lower()
    score = 0
    for w in (
        "kenya", "kenyan", "nairobi", "mombasa", "kisumu", "ruto", "safaricom",
        "harambee", "iebc", "county", "gachagua", "westlands", "nakuru",
    ):
        if w in t:
            score += 4
    if any(w in t for w in ("tokyo", "netflix", "marvel", "oscar", "grammy", "emmy")):
        score -= 6
    return score


def load_today_posts(limit: int = 3) -> list[dict]:
    cutoff = eat_now() - timedelta(hours=30)
    rows: list[dict] = []
    if not POSTS.exists():
        return []
    for path in POSTS.glob("*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        meta, body = split_fm(text)
        raw_date = meta.get("date") or meta.get("dateModified") or ""
        try:
            dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt.astimezone(EAT) < cutoff:
            continue
        title = meta.get("title") or path.stem
        slug = meta.get("slug") or path.stem
        excerpt = (meta.get("excerpt") or meta.get("description") or body.strip()[:180]).strip()
        excerpt = re.sub(r"\s+", " ", excerpt)[:180]
        cat = meta.get("category") or "News"
        image = meta.get("image") or LOGO
        hours_old = (eat_now() - dt.astimezone(EAT)).total_seconds() / 3600
        score = kenya_score(f"{title} {excerpt} {cat}") + max(0, 10 - int(hours_old))
        if cat.lower() in {"news", "politics"}:
            score += 3
        rows.append({
            "title": title,
            "slug": slug,
            "excerpt": excerpt,
            "category": cat,
            "image": image,
            "url": f"{SITE}/article/{slug}",
            "score": score,
            "date": dt,
        })
    rows.sort(key=lambda r: (-r["score"], -r["date"].timestamp()))
    return rows[:limit]


def story_card(post: dict, index: int) -> str:
    img = escape(post["image"])
    title = escape(post["title"])
    excerpt = escape(post["excerpt"])
    cat = escape(post["category"].upper())
    url = escape(post["url"])
    n = f"{index:02d}"
    # Card with image, category pill, title, lede, CTA
    return f"""
      <tr>
        <td style="padding:0 0 20px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{CARD};border:1px solid {BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:0;line-height:0;font-size:0;">
                <a href="{url}" style="text-decoration:none;">
                  <img src="{img}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:200px;object-fit:cover;border:0;background:#111;">
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 22px 22px;">
                <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;font-weight:700;color:{ACCENT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">
                  {n}&nbsp;&nbsp;·&nbsp;&nbsp;{cat}
                </p>
                <h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-family:Georgia,'Times New Roman',serif;font-weight:700;color:{TEXT};">
                  <a href="{url}" style="color:{TEXT};text-decoration:none;">{title}</a>
                </h2>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:{MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">{excerpt}</p>
                <a href="{url}" style="display:inline-block;background:{ACCENT};color:#0a0a0a;text-decoration:none;padding:10px 16px;font-size:12px;letter-spacing:0.06em;font-weight:700;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">Read the story →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>"""


def unsub_url(email: str) -> str:
    return f"{SITE}/api/unsubscribe?email={urllib.parse.quote(email)}"


def brief_html(posts: list[dict], email: str = "") -> str:
    day = eat_now().strftime("%A, %-d %B %Y")
    cards = "\n".join(story_card(p, i + 1) for i, p in enumerate(posts)) or f"""
      <tr><td style="color:{MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;padding:24px 0;">No new stories in this brief. We'll be back soon.</td></tr>
    """
    unsub = ""
    if email:
        unsub = (
            f'<a href="{escape(unsub_url(email))}" '
            f'style="color:{DIM};text-decoration:underline;">Unsubscribe</a>'
            f'&nbsp;&nbsp;·&nbsp;&nbsp;'
        )
    lead = escape(posts[0]["title"] if posts else "Today from Za Ndani")
    count = len(posts)
    subhead = (
        f"{count} stories worth your attention"
        if count
        else "Your Za Ndani brief"
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Za Ndani · Daily brief</title>
</head>
<body style="margin:0;padding:0;background:{BG};color:{TEXT};-webkit-text-size-adjust:100%;">
  <!-- Preheader (inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    {lead} — {escape(subhead)}.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{BG};">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding:0 4px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="middle" style="text-align:left;">
                    <a href="{SITE}" style="text-decoration:none;">
                      <img src="{LOGO}" alt="Za Ndani" width="48" height="48" style="display:block;border:0;width:48px;height:48px;border-radius:8px;">
                    </a>
                  </td>
                  <td valign="middle" style="text-align:right;">
                    <a href="{SITE}" style="font-size:12px;font-weight:600;color:{MUTED};text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">zandani.co.ke</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 6px;font-size:11px;letter-spacing:0.2em;font-weight:700;color:{ACCENT};text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">Daily brief</p>
              <h1 style="margin:0;font-size:28px;line-height:1.15;font-family:Georgia,'Times New Roman',serif;font-weight:700;color:{TEXT};">{escape(subhead)}</h1>
              <p style="margin:10px 0 0;font-size:13px;color:{DIM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">{escape(day)}</p>
            </td>
          </tr>

          <!-- Stories -->
          {cards}

          <!-- Footer -->
          <tr>
            <td style="padding:28px 4px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid {BORDER};">
                <tr>
                  <td style="padding:22px 0 0;">
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:{MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">
                      <strong style="color:{TEXT};">Za Ndani</strong> — Kenya news, culture & showbiz for readers everywhere.
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:{DIM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">
                      {unsub}<a href="{SITE}" style="color:{DIM};text-decoration:underline;">zandani.co.ke</a>
                      &nbsp;&nbsp;·&nbsp;&nbsp;
                      <a href="{SITE}" style="color:{DIM};text-decoration:underline;">Read more online</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def subscriber_display_name(email: str, supplied_name: str = "") -> str:
    clean = parseaddr(email)[1].lower().strip()
    explicit = re.sub(r"\s+", " ", str(supplied_name or "").strip())
    if explicit and len(explicit) <= 120:
        return explicit
    local = clean.split("@", 1)[0] if "@" in clean else clean
    candidate = re.sub(r"\s+", " ", re.sub(r"[._+\-]+", " ", re.sub(r"\d+", " ", local))).strip()
    if not candidate:
        return clean
    words = [w for w in candidate.split(" ") if w]
    if len(words) <= 4 and all(re.fullmatch(r"[A-Za-z]{2,20}", w) for w in words):
        return " ".join(w[:1].upper() + w[1:].lower() for w in words)
    return clean


def welcome_html(email: str = "", supplied_name: str = "") -> str:
    name = subscriber_display_name(email, supplied_name) if email else "there"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to Za Ndani</title>
</head>
<body style="margin:0;padding:0;background:{BG};color:{TEXT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{BG};">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:{CARD};border:1px solid {BORDER};">
        <tr><td style="height:4px;background:{ACCENT};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:34px 30px 30px;">
          <img src="{LOGO}" alt="Za Ndani" width="52" height="52" style="display:block;border:0;border-radius:8px;">
          <p style="margin:20px 0 8px;font:700 11px Arial,sans-serif;letter-spacing:.2em;color:{ACCENT};text-transform:uppercase;">WELCOME TO ZA NDANI</p>
          <h1 style="margin:0 0 18px;font:700 28px/1.2 Georgia,serif;color:{TEXT};">Hi {escape(name)},</h1>
          <p style="margin:0 0 16px;font:15px/1.7 Arial,sans-serif;color:{MUTED};">Thank you for subscribing to Za Ndani. We are glad to have you with us.</p>
          <p style="margin:0 0 16px;font:15px/1.7 Arial,sans-serif;color:{MUTED};">Za Ndani is a Kenya-focused digital news platform bringing you timely stories across news, politics, business, society, culture, entertainment, lifestyle and sports. We focus on stories that matter to Kenyan readers while also keeping you connected to important developments beyond Kenya.</p>
          <p style="margin:0 0 24px;font:15px/1.7 Arial,sans-serif;color:{MUTED};">As a subscriber, you will receive selected Za Ndani stories and updates in your inbox, with links back to the full articles on our website.</p>
          <a href="{SITE}" style="display:inline-block;background:{ACCENT};color:#0a0a0a;text-decoration:none;padding:13px 20px;font:700 12px Arial,sans-serif;letter-spacing:.08em;">VISIT ZA NDANI</a>
        </td></tr>
        <tr><td style="padding:22px 30px;border-top:1px solid {BORDER};font:12px/1.6 Arial,sans-serif;color:{DIM};">Za Ndani · zandani.co.ke</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def api_key() -> str:
    key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not key:
        raise SystemExit("RESEND_API_KEY is missing")
    return key


def resend(method: str, path: str, payload: dict | None = None) -> dict:
    """Call Resend via curl to avoid Cloudflare 1010 on Python urllib from GHA."""
    if method.upper() != "POST" or payload is None:
        raise RuntimeError(f"unsupported Resend call {method} {path}")

    body = json.dumps(payload)
    cmd = [
        "curl", "-sS", "-X", "POST",
        f"{RESEND}{path}",
        "-H", f"Authorization: Bearer {api_key()}",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json",
        "-H", "User-Agent: zandani-brief/2.0 (+https://zandani.co.ke)",
        "-d", body,
        "-w", "\n%{http_code}",
    ]
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
    except FileNotFoundError as e:
        raise RuntimeError("curl is required to call Resend") from e

    out = (completed.stdout or "").rstrip("\n")
    err = (completed.stderr or "").strip()
    if not out:
        raise RuntimeError(f"Resend empty response stderr={err!r}")

    if "\n" in out:
        raw_body, status_s = out.rsplit("\n", 1)
    else:
        raw_body, status_s = "", out
    try:
        status = int(status_s)
    except ValueError:
        raw_body, status = out, 0

    parsed: dict = {}
    if raw_body.strip():
        try:
            parsed = json.loads(raw_body)
        except json.JSONDecodeError:
            parsed = {"raw": raw_body[:500]}

    if status < 200 or status >= 300:
        msg = parsed.get("message") or parsed.get("raw") or raw_body[:500] or err
        raise RuntimeError(f"Resend {method} {path} -> {status}: {msg}")

    return parsed if isinstance(parsed, dict) else {}


def from_addr() -> str:
    return (os.environ.get("RESEND_FROM") or "").strip() or FROM_DEFAULT


def list_contacts() -> list[str]:
    base = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
    if not base or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    url = f"{base}{SUPABASE_REST}"
    query = urllib.parse.urlencode({
        "select": "email",
        "active": "eq.true",
        "order": "subscribed_at.asc",
    })
    cmd = [
        "curl", "-sS", "--fail-with-body",
        url + "?" + query,
        # Supabase sb_secret_* keys are opaque API keys, not JWTs.
        "-H", f"apikey: {key}",
        "-H", "Accept: application/json",
        "-H", "User-Agent: zandani-brief/3.0 (+https://zandani.co.ke)",
    ]
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except FileNotFoundError as e:
        raise RuntimeError("curl is required to read Supabase") from e
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "Supabase request failed").strip()
        raise RuntimeError(f"Supabase subscriber read failed: {detail[:500]}")
    try:
        rows = json.loads(completed.stdout or "[]")
    except json.JSONDecodeError as e:
        raise RuntimeError("Supabase returned invalid subscriber JSON") from e
    out: list[str] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        em = parseaddr(str(row.get("email") or ""))[1].lower().strip()
        if "@" in em and "." in em.split("@")[-1]:
            out.append(em)
    return sorted(set(out))


def send_one(to: str, subject: str, html: str) -> None:
    resend("POST", "/emails", {
        "from": from_addr(),
        "to": [to],
        "subject": subject,
        "html": html,
        "headers": {
            "X-Entity-Ref-ID": f"zandani-{eat_now().strftime('%Y%m%d')}-{to}",
        },
    })


def cmd_welcome(email: str) -> int:
    email = parseaddr(email)[1].lower().strip()
    send_one(email, "Welcome to Za Ndani", welcome_html(email), FROM_DEFAULT)
    print(f"welcome sent to {mask(email)}")
    return 0


def cmd_welcome_all() -> int:
    people = list_contacts()
    print(f"welcome-all subscribers={len(people)}")
    if not people:
        print("No active subscribers")
        return 0
    sent = 0
    failed = 0
    for em in people:
        try:
            send_one(em, "Welcome to Za Ndani", welcome_html(em), FROM_DEFAULT)
            sent += 1
            time.sleep(0.55)
        except Exception as e:
            failed += 1
            print(f"fail {mask(em)}: {e}", file=sys.stderr)
    print(f"welcome-all sent={sent} failed={failed}")
    return 0 if failed == 0 else 1


def cmd_digest() -> int:
    posts = load_today_posts(3)
    people = list_contacts()
    print(f"digest posts={len(posts)} subscribers={len(people)}")
    print(f"from={from_addr()}")
    for p in posts:
        print(f"  - {p['category']}: {p['title']}")
    if not people:
        print("No active subscribers yet")
        return 0
    # Clean subject — no "evening brief" / EAT
    if posts:
        subject = f"Za Ndani · {posts[0]['title']}"
        if len(subject) > 90:
            subject = subject[:87].rsplit(" ", 1)[0] + "…"
    else:
        subject = f"Za Ndani · {eat_now().strftime('%-d %B')}"
    sent = 0
    failed = 0
    for em in people:
        try:
            send_one(em, subject, brief_html(posts, em))
            sent += 1
            time.sleep(0.55)
        except Exception as e:
            failed += 1
            print(f"fail {mask(em)}: {e}", file=sys.stderr)
    print(f"sent={sent} failed={failed}")
    return 0 if failed == 0 else 1


def main(argv: list[str]) -> int:
    if len(argv) >= 3 and argv[1] == "welcome":
        return cmd_welcome(argv[2])
    if len(argv) >= 2 and argv[1] == "welcome-all":
        return cmd_welcome_all()
    if len(argv) >= 2 and argv[1] == "digest":
        return cmd_digest()
    if len(argv) >= 2 and argv[1] == "preview":
        posts = load_today_posts(3)
        out = pathlib.Path("/tmp/zandani-brief.html")
        out.write_text(brief_html(posts, "preview@zandani.co.ke"), encoding="utf-8")
        print("wrote", out, [p["title"] for p in posts])
        return 0
    print("usage: email_brief.py digest | welcome EMAIL | welcome-all | preview")
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
