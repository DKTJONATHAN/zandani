#!/usr/bin/env python3
"""Set clear GitHub Actions display names: Category | Author ← source"""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(".github/workflows")

# filename -> display name
NAMES = {
    "za-news.yml": "News | Celestine Nzioka ← kenyans.co.ke",
    "za Entertainment.yml": "Entertainment | Mutheu Ann ← pulselive.co.ke",
    "za-ghafla.yml": "Gossip | Wanjiku Kuria ← ghafla.co.ke",
    "za-mpasho.yml": "Showbiz | Martin Kihara ← mpasho.co.ke",
    "za ghafla.yml": "DISABLED | Ghost Ghafla (use za-ghafla.yml)",
    "za sports.yml": "Sports | Jona Munyi ← nation.africa/kenya/sports",
    "za business.yml": "Business | Grace Mkamburi ← kenyanwallstreet.com",
    "za opinions.yml": "Opinions | Jonathan Mwaniki ← the-star.co.ke/opinion",
    "za lifestyle.yml": "Lifestyle | Jona Munyi ← ghafla.co.ke",
    "za technology.yml": "Technology | Elizabeth Muthoni ← techweez.com",
    "za agriculture.yml": "Agriculture | Timothy Muli ← smartfarmerkenya.com",
    "za africa.yml": "Pan-Africa Ent. | Amara Ndlovu ← pulse.ng/entertainment",
    "za diano.yml": "Diano/X | Zed Mogaka ← @georgediano (X/Twitter)",
    "za-entertainment-hourly.yml": "Dispatcher | Hourly Entertainment (disabled)",
    "za-news-hourly.yml": "Dispatcher | News hourly (disabled helper)",
    "after-writers-quality.yml": "Quality gate | quarantine + polish + lint",
    "automation.yml": "Research | Multi-source article generator",
    "za manual.yml": "Manual | On-demand article scraper",
    "za jaj.yml": "Column | Jaj opinion writer",
    "satirical-narrator.yml": "Column | Satirical narrator",
    "podcast-generator.yml": "Audio | Podcast generator",
}

NAME_RE = re.compile(r"^(?:\ufeff)?name:\s*.*$", re.M)


def main() -> int:
    changed = []
    for fname, display in NAMES.items():
        path = ROOT / fname
        if not path.exists():
            print(f"missing {fname}")
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if text.startswith("\ufeff"):
            text = text[1:]
        new_line = f"name: {display}"
        if NAME_RE.search(text):
            updated = NAME_RE.sub(new_line, text, count=1)
        else:
            updated = new_line + "\n" + text
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed.append(fname)
            print(f"labeled {fname} -> {display}")
        else:
            print(f"unchanged {fname}")
    print(f"done, changed={len(changed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
