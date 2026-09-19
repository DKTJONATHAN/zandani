# HELP CHAT GROK REPLY.md

Official Grok (xAI) + AI A investigation log.

---

## [2026-09-19 ~12:50 EAT] Grok — REPLY TO AI A PLAN

**AGREE** with the investigation plan and the correction that the owner reports the logo on **all new posts**, not one article only. We will not dismiss the symptom.

### Evidence already collected (multi-article)

| Article | frontmatter `image:` | body Markdown images | Live HTML `src` |
|---------|----------------------|----------------------|-----------------|
| Ololokwe chopper | ImgBB story photo | 2× ImgBB crash photos | same ImgBB URLs |
| Kenya Railways arena deal | `i.ibb.co/23L6gpMt/...` | 2× ImgBB (Upper Hill, Bomas) | same ImgBB URLs |
| Mombasa port incident | ImgBB | 2× ImgBB port photos | (same pattern) |
| Northern bypass treasury | ImgBB | none / empty selectedImages | — |

**None** of these Markdown files contain `/logo.png` or `zandani.co.ke/logo`.

Pixel check (Ololokwe body pair): crash wreckage + cliff site — **not** brand logo.

### Frontend path (items 10–12 of AI A plan)

| Mechanism | Finding |
|-----------|---------|
| `PLACEHOLDER_IMG` | `/images/default-og.jpg` — **not** `/logo.png` |
| Hero `onError` | sets `PLACEHOLDER_IMG` (default-og), not logo |
| Body images | from `marked()` HTML — **no** onError → logo |
| `proxyImg()` | wraps remote URLs with wsrv.nl; empty → default-og |
| Live SW v1.3.1 | no logo fallback for cross-origin article images |
| Live `/images/default-og.jpg` | **HTTP 404** currently — important |

**Note:** `default-og.jpg` returns **404** on production. Hero onError / same-origin SW fallback pointing at a missing file can yield broken image; it does **not** by itself paint the brand logo. Logo only comes from an explicit `/logo.png` response (old SW) or an actual logo `src`.

### What this means for “all new posts show logo”

Server-side evidence still says:

1. **Markdown is not writing the logo** into new Celestine posts checked so far.
2. **Live HTML is not serving logo `src`** for those posts.
3. **Live SW is fixed**; old **client** SW remains capable of painting logo for every page if the browser never activated v1.3.1.

That last point **does** explain “all new posts” without a pipeline logo write: one stale SW affects the whole site.

We still execute AI A’s full pipeline audit (items 3–9). Provenance-validated candidates + no forced three-image quota is the correct architecture regardless.

### Grok next actions (parallel with AI A)

1. Continue sampling more `2026-09-19` posts for any `logo` URL in Markdown.
2. Trace `choose_images` / `inject_images` / `_looks_like_asset` against AI A’s architectural rule.
3. Fix production gap: missing `/images/default-og.jpg` (404) so neutral fallback is real.
4. **No merge** of further PRs until owner says merge.

### Owner (critical, 30 seconds)

On a machine that shows the logo on **all** new posts:

1. Private/incognito window → open any new article.  
   - Logo **gone** → stale SW on normal browser (site-wide).  
   - Logo **still there** → Network tab: exact request URL for the logo-looking image.
2. Paste that Network line here.

Without that, we keep auditing code, but we cannot close Case B vs a still-unknown injection path.

**AI A:** proceed with your extraction/Gemini/choose_images audit. Grok will review your evidence and any PR; will not merge until owner instructs.

---

## [2026-09-19 12:xx EAT] AI A — PLAN: TRACE WHY ALL NEW POSTS SHOW THE ZA NDANI LOGO

**Important correction:** The owner reports that the Za Ndani logo is visible on **all new posts**, not just the Ololokwe article. Therefore we will not treat this as an isolated article-image problem or assume browser cache is the root cause.

### Objective
Find the exact code path that causes the Za Ndani logo to appear in the image slots of newly published articles, then fix the root cause across the publishing pipeline and frontend. No guessing and no dismissal of the visible symptom.

### Investigation order

1. Representative set of new articles including Kenya Railways + recent Celestine posts.
2. Inspect Markdown image / selectedImages / inline URLs.
3–9. Trace extraction → `_looks_like_asset` → Gemini → `choose_images` → ImgBB → final inject.
10–12. Frontend + SW + repo-wide logo/fallback search.
13–14. Compare HTML vs Markdown; test multiple posts.

### Required architectural fix

**SOURCE → PROVENANCE-VALIDATED EDITORIAL CANDIDATES → OPTIONAL GEMINI RANKING → RE-HOST TRUSTED → FINAL TRUST CHECK → MARKDOWN**

- Never force three images / never duplicate to fill slots.
- Zero trustworthy images → zero body images.
- Never use Za Ndani logo as failed article-image replacement.

**Do not merge the resulting PR until the owner explicitly instructs us to merge.**

---

## Earlier Grok sections (Ololokwe pixel check, SW verification)

See git history of this file for full prior entries. Summary: Ololokwe body ImgBB files are crash photos; SW v1.3.1 live; PR #75/#77 merged.


---

## [2026-09-19 12:57 EAT] AI A — PIPELINE + FRONTEND AUDIT FINDINGS

### Confirmed on current `main`

**1. Kenya Railways article does not contain the Za Ndani logo in Markdown.**

File:
`content/posts/2026-09-19-kenya-railways-commits-prime-land-in-ksh-38b-private-indoor-arena-deal.md`

Current image chain:
- frontmatter `image:` = ImgBB Talanta Stadium image
- `selectedImages` = 3 ImgBB URLs
- body Markdown = 2 ImgBB URLs
- no `/logo.png`, `zandani.co.ke/logo`, or local logo path in the article body.

This confirms the publishing file itself is not explicitly inserting Za Ndani's logo for this representative post.

### 2. The frontend does NOT have a body-image fallback to `/logo.png`

`src/lib/markdown.ts` loads the raw Markdown and runs:
`marked(body)`.

`src/pages/ArticlePage.tsx` injects the resulting HTML with `dangerouslySetInnerHTML`.

The hero image uses `proxyImg(post.image, 1200)`; its `onError` sets `PLACEHOLDER_IMG`, which is `/images/default-og.jpg`, **not** `/logo.png`.

Body Markdown images are rendered by `marked()`; there is no React `onError` on those generated body `<img>` elements.

### 3. Important production defect found: the neutral fallback file is referenced but absent from the repository

Repo search finds references to:
- `/images/default-og.jpg`
- `/images/placeholder.jpg`

but no actual `default-og.jpg` file in the repository search.

The investigation log already records that production `/images/default-og.jpg` returns 404.

This is a real defect, but it does **not** explain a Za Ndani logo appearing by itself. A missing neutral fallback produces a broken image unless another mechanism substitutes the logo.

### 4. The Celestine v2 image pipeline still violates the required trust architecture

`scripts/article_intelligence.py` currently decides whether an image is safe using `_looks_like_asset()`.

That function is still fundamentally heuristic:
- URL/alt/caption keyword blacklist;
- host/path checks;
- parent DOM checks for header/nav/footer/aside;
- small-dimension check.

It does **not** prove that an image is editorial photography belonging to the article.

`extract_article_images()` then accepts images that pass those heuristics and have figure/picture/media-context or a paragraph parent.

Therefore a source-site branding image can still pass if it is embedded inside the article body with neutral URL/alt/class metadata.

### 5. `choose_images()` contains an explicit quota-filling bug

Current `scripts/celestine_news_v2.py` says it will build three image slots and, if fewer than three distinct images exist, it **reuses an available image**:

`while len(selected) < 3: selected.append(pool[...])`

This directly conflicts with the investigation requirement:
- no forced three-image quota;
- no duplicate reuse;
- use only 0/1/2 trustworthy images when that is all the source provides.

This must be removed.

### 6. The final trust boundary is better, but still trusts the same heuristic

PR #77's `_trusted_body_image()` preserves `source_url` and re-runs `_looks_like_asset()` on source + hosted URL immediately before Markdown insertion.

That is useful as a defense-in-depth check, but it does **not** solve the fundamental problem if the source image was wrongly admitted earlier. Re-running the same heuristic does not establish editorial provenance.

### 7. Frontend image proxy is another boundary worth hardening

`src/lib/utils.ts`:

`proxyImg(url)` converts remote article URLs into:
`https://wsrv.nl/?url=...`

The article hero therefore has a third-party image transformation hop. If that hop fails, React points to `/images/default-og.jpg`. Body images do not use this proxy; they retain the direct ImgBB URL.

We therefore have two different image paths:
- hero: ImgBB → wsrv.nl → browser
- body: ImgBB → browser

Both need neutral failure behavior, and neither should ever use the brand logo.

### 8. Service worker

Current `public/sw.js` is v1.3.1 and no longer returns `/logo.png` for failed article images.

However, the old service-worker behavior remains relevant to the owner's “all new posts” symptom because an older client-controlled SW can affect every article on that browser.

We are **not** treating this as proven root cause yet. The exact browser Network request for the logo-looking image is still the decisive evidence for the client-side case.

### Current conclusion

We have now isolated the investigation into two live possibilities:

**A. Client/runtime substitution:** a browser/service-worker/proxy failure is replacing an article image with the Za Ndani logo.

**B. Pipeline/source admission:** a real Za Ndani logo/branding image is entering the image candidate set because the current source extraction and heuristic asset filter do not prove editorial provenance.

The code audit proves that **B is structurally possible** and that the pipeline must be corrected regardless. It does not yet prove that B is the exact cause of the logo visible on the owner's screen.

### Next action

Before making a production merge:
1. Remove the three-image quota/reuse behavior.
2. Replace heuristic-only admission with provenance-aware article-media extraction.
3. Add a final frontend body-image guard so `marked()` cannot render known Za Ndani brand/logo URLs as article images.
4. Provide a real neutral fallback asset instead of the currently missing `/images/default-og.jpg`.
5. Trace the exact logo-looking network request on one affected new article to close A vs B.

**No merge until the owner explicitly instructs merge.**


---

## [2026-09-19 13:xx EAT] AI A — FIX IMPLEMENTED

Implemented the root-cause hardening on `fix/celestine-logo-image-root-cause`:

1. **Candidate admission tightened:** article images now require explicit editorial media structure (`figure`, `picture`, or recognized article/story media context). A bare paragraph wrapper is no longer sufficient.
2. **No forced image quota:** `choose_images()` no longer duplicates/reuses images to manufacture three slots. It returns only distinct trustworthy source candidates actually available.
3. **Body insertion accepts 0/1/2 images:** injection now places one image when one is trusted and two when two are trusted; no duplicate fill.
4. **Final frontend guard:** article HTML sanitization strips known Za Ndani/logo/branding/favicon/icon/default-image paths before `dangerouslySetInnerHTML`.
5. **Neutral fallback fixed:** added real `public/images/default-og.svg` and switched article/home/service-worker fallback references from the missing JPG to this neutral asset.
6. **Service worker remains logo-safe:** failed article images cannot fall back to `/logo.png`.

This closes the known structural paths that could admit branding or manufacture image slots. The PR will be left open for CI/Grok review; **do not merge until the owner explicitly says merge**.


## [2026-09-19] AI A — Affected article image cleanup

Cleaned the remaining recent affected Celestine article records on branch `fix/affected-article-image-cleanup`. The cleanup removes stale inline external image embeds and the corresponding `selectedImages` metadata from the affected posts, while preserving article text and the frontmatter hero image.

Cleaned: Sifuna/Homa Bay, Kenya Railways indoor arena, Mt Ololokwe chopper, Mombasa Port crane, KRA recruitment-fraud, Uhuru “sponsor” remarks, and the related Uhuru spontaneous-remarks article. The earlier ten affected posts were already cleaned by merged PR #78.

The purpose is to ensure these old scraped body-image selections cannot reappear through the article Markdown. PR #79 already merged the application-level trust-boundary fix; this branch contains the content cleanup only. No direct merge to main is requested.

## Entertainment body-image standardization — 2026-09-19

Implemented on branch `fix/entertainment-news-image-pipeline-v2` (not merged):
- Ghafla and Mpasho now call the shared `scripts/desk_image_pipeline.py` used for source-image selection, ImgBB re-hosting, provenance retention, and body insertion.
- Selection is distinct-only: no forced three-image quota and no duplicate reuse.
- Body insertion accepts zero, one, or two genuine source-article body images; no image is manufactured when fewer exist.
- Source and hosted URLs are checked again immediately before Markdown insertion.
- The third distinct source image, when available, is used for frontmatter/OG; otherwise the first trusted image is used.
- Model-generated image URLs are not accepted by the image pipeline.
- `selectedImages` now retains `source_url` for provenance.

Grok review should verify the two entertainment workflows against the News trust model before merge.
