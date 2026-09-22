#!/usr/bin/env python3
"""Za Ndani story brief via Resend.

Subscribers from Supabase newsletter_subscribers (active=true) via
SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Resend for delivery.
Do not print full addresses in logs.

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
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from html import escape

EAT = timezone(timedelta(hours=3))
SITE = "https://zandani.co.ke"
LOGO = f"{SITE}/logo.png"
POSTS = pathlib.Path("content/posts")
SUBS_FILE = pathlib.Path("data/subscribers.json")
RESEND = "https://api.resend.com"
FROM_DEFAULT = "Za Ndani <onboarding@resend.dev>"

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


def list_contacts() -> list[str]:
    """Prefer Supabase; fall back to data/subscribers.json if still present."""
    import importlib.util

    helper = pathlib.Path(__file__).resolve().parent / "subs_supabase.py"
    if helper.exists():
        spec = importlib.util.spec_from_file_location("subs_supabase", helper)
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            try:
                people = mod.list_active_emails()
                print(f"contacts source=supabase count={len(people)}")
                if people or (
                    os.environ.get("SUPABASE_URL")
                    and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                ):
                    return people
            except Exception as e:
                print(f"supabase contacts error: {e}", file=sys.stderr)

    if not SUBS_FILE.exists():
        print("no subscribers (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)")
        return []
    data = json.loads(SUBS_FILE.read_text(encoding="utf-8"))
    out: list[str] = []
    for row in data.get("subscribers") or []:
        if not isinstance(row, dict) or row.get("active") is False:
            continue
        em = parseaddr(str(row.get("email") or ""))[1].lower().strip()
        if "@" in em and "." in em.split("@")[-1]:
            out.append(em)
    people2 = sorted(set(out))
    print(f"contacts source=json-fallback count={len(people2)}")
    return people2
