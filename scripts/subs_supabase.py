"""Load active newsletter emails from Supabase (service role)."""
from __future__ import annotations

import json
import os
import subprocess
import urllib.parse
from email.utils import parseaddr


def list_active_emails() -> list[str]:
    url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        return []

    out: list[str] = []
    offset, page = 0, 1000
    nl = "\n"
    while True:
        qs = urllib.parse.urlencode(
            {
                "select": "email",
                "active": "eq.true",
                "order": "email.asc",
                "limit": str(page),
                "offset": str(offset),
            }
        )
        endpoint = f"{url}/rest/v1/newsletter_subscribers?{qs}"
        cmd = [
            "curl",
            "-sS",
            "-H",
            f"apikey: {key}",
            "-H",
            f"Authorization: Bearer {key}",
            "-H",
            "Accept: application/json",
            "-w",
            nl + "%{http_code}",
            endpoint,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        out_s = proc.stdout or ""
        if nl in out_s:
            body, status_s = out_s.rsplit(nl, 1)
        else:
            body, status_s = out_s, "0"
        status_s = status_s.strip()
        try:
            status = int(status_s)
        except ValueError:
            status, body = 0, out_s
        if status < 200 or status >= 300:
            raise RuntimeError(f"Supabase subscribers -> {status}: {body[:400]}")
        rows = json.loads(body) if body.strip() else []
        if not isinstance(rows, list):
            raise RuntimeError("Supabase returned non-list")
        for row in rows:
            if not isinstance(row, dict):
                continue
            em = parseaddr(str(row.get("email") or ""))[1].lower().strip()
            if "@" in em and "." in em.split("@")[-1]:
                out.append(em)
        if len(rows) < page:
            break
        offset += page
    return sorted(set(out))
