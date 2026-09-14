#!/usr/bin/env python3
"""Bootstrap: fetch last-good martin_mpasho.py and apply ImgBB patch."""
import os, re, sys, urllib.request

BASE_URL = (
    "https://raw.githubusercontent.com/DKTJONATHAN/zandani/"
    "934a5fd53f16354b3e039cc34d913eee0d0783b3/scripts/martin_mpasho.py"
)
TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "martin_mpasho.py")

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "zandani-bootstrap/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")

text = fetch(BASE_URL)
print(f"Fetched base ({len(text)} chars)")

old_imp = "import os, sys, json, re, time, random, hashlib, datetime, urllib.parse\nimport requests"
new_imp = (
    "import os, sys, json, re, time, random, hashlib, datetime, urllib.parse, base64, io\n"
    "import requests\n"
    "try:\n"
    "    from PIL import Image\n"
    "except ImportError:\n"
    "    Image = None"
)
if old_imp not in text:
    raise SystemExit("import block not found in base")
text = text.replace(old_imp, new_imp, 1)
text = re.sub(r"UNSPLASH_FALLBACKS = \[[^\]]+\]\n\n", "", text, count=1)

uf = []
uf.append("")
uf.append("def upload_to_imgbb(image_url: str) -> str:")
uf.append("    \"\"\"Download article OG image, convert to WebP, host on ImgBB. Never stock placeholders.\"\"\"")
uf.append("    if not image_url:")
uf.append("        return \"\"")
uf.append("    if \"ibb.co\" in image_url or \"imgbb.com\" in image_url:")
uf.append("        return image_url")
uf.append("    api_key = os.environ.get(\"IMGBB_API_KEY\") or os.environ.get(\"IMGBB_KEY\")")
uf.append("    if not api_key:")
uf.append("        print(\"IMGBB_API_KEY missing — using source CDN image\")")
uf.append("        return image_url")
uf.append("    try:")
uf.append("        r = requests.get(image_url, headers={**HEADERS, \"Referer\": SOURCE_URL}, timeout=25)")
uf.append("        r.raise_for_status()")
uf.append("        raw = r.content")
uf.append("        if len(raw) < 500:")
uf.append("            print(f\"Image too small ({len(raw)} bytes) — keeping source URL\")")
uf.append("            return image_url")
uf.append("        b64 = None")
uf.append("        if Image is not None:")
uf.append("            try:")
uf.append("                img = Image.open(io.BytesIO(raw))")
uf.append("                if img.mode in (\"RGBA\", \"LA\", \"P\"):")
uf.append("                    img = img.convert(\"RGB\")")
uf.append("                max_w = 1400")
uf.append("                if img.width > max_w:")
uf.append("                    ratio = max_w / float(img.width)")
uf.append("                    img = img.resize((max_w, max(1, int(img.height * ratio))), Image.LANCZOS)")
uf.append("                buf = io.BytesIO()")
uf.append("                img.save(buf, format=\"WEBP\", quality=82, method=4)")
uf.append("                buf.seek(0)")
uf.append("                b64 = base64.b64encode(buf.read()).decode(\"utf-8\")")
uf.append("            except Exception as e:")
uf.append("                print(f\"WebP convert failed ({e}) — uploading original bytes\")")
uf.append("                b64 = None")
uf.append("        if b64 is None:")
uf.append("            b64 = base64.b64encode(raw).decode(\"utf-8\")")
uf.append("        res = requests.post(")
uf.append("            \"https://api.imgbb.com/1/upload\",")
uf.append("            data={\"key\": api_key, \"image\": b64},")
uf.append("            timeout=30,")
uf.append("        )")
uf.append("        if res.status_code == 200:")
uf.append("            data = res.json().get(\"data\") or {}")
uf.append("            new_url = data.get(\"url\") or data.get(\"display_url\") or \"\"")
uf.append("            if new_url:")
uf.append("                print(f\"ImgBB hosted: {new_url}\")")
uf.append("                return new_url")
uf.append("            print(f\"ImgBB response missing url: {res.text[:200]}\")")
uf.append("        else:")
uf.append("            print(f\"ImgBB failed ({res.status_code}): {res.text[:200]}\")")
uf.append("    except Exception as e:")
uf.append("        print(f\"ImgBB error: {e}\")")
uf.append("    return image_url")
uf.append("")
uf.append("")
upload_fn = "\n".join(uf)

if "def upload_to_imgbb" not in text:
    marker = "def _extract_publish_dt(html: str, soup):"
    if marker not in text:
        raise SystemExit("publish_dt marker missing")
    text = text.replace(marker, upload_fn + marker, 1)

text = text.replace(
    "    if not image:\n        image = random.choice(UNSPLASH_FALLBACKS)\n    slug = f\"{today_str}-{slugify(seo['title'])}\"",
    "    if not image:\n        print(\"WARNING: writing post with empty image field (no og:image / ImgBB)\")\n    slug = f\"{today_str}-{slugify(seo['title'])}\"",
)

text = text.replace(
    "        write_post(title, article, style[\"name\"], link, img or \"\")\n        memory.setdefault(\"published_hashes\", []).append(h)",
    "        hosted = upload_to_imgbb(img) if img else \"\"\n        if not hosted:\n            print(\"No article image available — refusing placeholder; post image will be empty\")\n        write_post(title, article, style[\"name\"], link, hosted)\n        memory.setdefault(\"published_hashes\", []).append(h)",
)

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(text)
print(f"Wrote {TARGET} ({len(text)} chars)")
print("has upload_to_imgbb:", "def upload_to_imgbb" in text)
print("has UNSPLASH:", "UNSPLASH" in text)

os.execv(sys.executable, [sys.executable, TARGET] + sys.argv[1:])
