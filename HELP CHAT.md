# HELP CHAT — Celestine News (ZA News) Logo-as-Body-Image Bug

**Purpose of this file:** Collaborative debugging log between AIs.  
Grok (xAI) and any other AI the owner points at this file should append messages here, read previous entries, and work together to find and fix why the Celestine News pipeline is inserting the Za Ndani website logo as internal body images in articles.

**Rules for AIs:**
- Always append your message at the bottom with a clear timestamp + your identity.
- Do not delete previous messages.
- Quote relevant code snippets or file paths.
- Propose concrete fixes (code changes) once root cause is agreed.
- Owner can also reply here.

---

## [2026-09-19 ~06:45 UTC] Grok (xAI) — Initial report & first analysis

**Problem statement (from owner):**  
In the ZA NEWS CELESTINE WORKFLOW, articles are being written with the website logo being used as internal body images. Fix needed.

**Relevant files identified:**
- Workflow: `.github/workflows/za-news.yml` (runs `scripts/celestine_news_v2.py` hourly)
- Main pipeline: `scripts/celestine_news_v2.py`
- Image extraction / logo rejection: `scripts/article_intelligence.py` (`extract_article_images`, `_looks_like_asset`)
- Shared image pipeline for other desks: `scripts/desk_image_pipeline.py` (mentions aligning with Celestine rules)

**What the current code already tries to do:**
1. `article_intelligence._looks_like_asset()` rejects anything with "logo", "zandani", "brand", site-header, etc., and any image hosted on `zandani.co.ke`.
2. `celestine_news_v2.strip_generated_images()` strips *all* markdown/HTML images that Gemini might have emitted in the body.
3. `inject_images()` then only inserts the first **two** scraped+ImgBB-hosted images at ~30% and ~65% of the body.
4. Primary frontmatter `image:` uses the third selected image (OG slot) or falls back to the first.

**Possible failure modes still open:**
- Gemini is somehow still emitting the logo URL after `strip_generated_images` (regex miss?).
- `extract_article_images` is still returning a logo-like asset because the source page (kenyans.co.ke etc.) embeds the *source site's* logo inside the article body with weak alt text / no "logo" keyword.
- ImgBB upload is failing and a fallback path is inserting a default/logo URL.
- Frontmatter `image:` or `selectedImages` ends up with a logo, and the frontend renders it as body image.
- Older posts (pre-v2) still contain the problem; new runs may be clean but owner is seeing legacy ones.
- The `featured` OG image from the source is being preferred in a fallback path and happens to be a logo/branding asset on some stories.

**Next steps for the other AI:**
1. Inspect a few recent posts under `content/posts/` that exhibit the logo-in-body symptom and paste the exact markdown image lines + frontmatter `image:` / `selectedImages`.
2. Check whether the bad URLs point to:
   - `zandani.co.ke` assets
   - ImgBB uploads that look like logos
   - Source-site logos that slipped past `_looks_like_asset`
3. Review the exact regex in `strip_generated_images` and the placement logic in `inject_images`.
4. Propose a hardening patch (extra blacklist, post-injection logo scrub, or stricter candidate filtering).

Waiting for your findings. Append below.

---

