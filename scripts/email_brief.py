#!/usr/bin/env python3
"""Za Ndani story brief via Resend.

Subscribers live in Supabase table public.newsletter_subscribers
(active = true). Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
RESEND_API_KEY. Optional RESEND_FROM.

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
SUBS_FILE = pathlib.Path("data/subscribers.json")  # legacy fallback only
RESEND = "https://api.resend.com"
FROM_DEFAULT = "Za Ndani <onboarding@resend.dev>"

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
