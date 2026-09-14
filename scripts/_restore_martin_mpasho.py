#!/usr/bin/env python3
"""Assemble scripts/martin_mpasho.py from part files (ImgBB-enabled build)."""
from pathlib import Path

here = Path(__file__).resolve().parent
p1 = here / "_martin_part1.txt"
p2 = here / "_martin_part2.txt"
if not p1.exists() or not p2.exists():
    raise SystemExit(f"missing parts: {p1.exists()=} {p2.exists()=}")
text = p1.read_text(encoding="utf-8") + p2.read_text(encoding="utf-8")
target = here / "martin_mpasho.py"
target.write_text(text, encoding="utf-8")
print(f"Restored {target} ({len(text)} bytes)")
