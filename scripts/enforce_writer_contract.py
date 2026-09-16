#!/usr/bin/env python3
"""Per-desk preflight: 24h freshness + shared Gemini writer prompt."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
PROMPT = ROOT / "scripts" / "zandani_writer_prompt.txt"
SCRIPTS = ROOT / "scripts"


def main() -> int:
    desk = os.environ.get("WRITER_DESK", "unknown")
    print(f"[writer-contract] desk={desk}")
    if not PROMPT.is_file():
        print("ERROR: scripts/zandani_writer_prompt.txt missing")
        return 1
    text = PROMPT.read_text(encoding="utf-8")
    for needle in ("<SYSTEM_PROMPT>", "<OUTPUT_SCHEMA>", "<FRESHNESS_RULE>", '"status"'):
        if needle not in text:
            print(f"ERROR: writer prompt missing {needle}")
            return 1
    print(f"[writer-contract] prompt ok ({len(text)} bytes)")

    patched = 0
    for path in sorted(SCRIPTS.glob("*.py")):
        raw = path.read_text(encoding="utf-8")
        new = raw
        new = re.sub(r"FRESH_HOURS\s*=\s*\d+", "FRESH_HOURS = 24", new)
        new = re.sub(r"max_hours\s*=\s*\d+", "max_hours = 24", new)
        if new != raw:
            path.write_text(new, encoding="utf-8")
            patched += 1
            print(f"[writer-contract] freshness=24h in {path.name}")
    print(f"[writer-contract] files patched={patched}")
    print("[writer-contract] write every eligible story; skip only if older than 24h or unusable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
