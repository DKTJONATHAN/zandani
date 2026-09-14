#!/usr/bin/env python3
"""One-shot restore of scripts/martin_mpasho.py from base64 chunks (ImgBB-enabled build)."""
import base64
from pathlib import Path

here = Path(__file__).resolve().parent
parts = []
for i in range(4):
    p = here / f"_mk_chunk_{i}.b64"
    if not p.exists():
        raise SystemExit(f"missing {p}")
    parts.append(p.read_text(encoding="utf-8").strip())
raw = base64.b64decode("".join(parts))
target = here / "martin_mpasho.py"
target.write_bytes(raw)
print(f"Restored {target} ({len(raw)} bytes)")
