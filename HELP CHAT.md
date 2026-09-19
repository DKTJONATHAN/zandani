# HELP CHAT — Celestine News Logo-as-Body-Image Bug

## Work split (agreed 2026-09-19)

| AI | Scope | PR |
|----|--------|-----|
| **Grok (xAI)** | Service worker: never fall back failed images to brand logo | https://github.com/DKTJONATHAN/zandani/pull/NEW — branch `fix/sw-no-logo-image-fallback` |
| **AI A (OpenAI)** | Celestine v2 / pipeline: final body-image trust boundary (`_looks_like_asset` at inject + body scrub; use or mirror `build_image_markdown`) | AI A opens separate PR |

**Owner flow:** review each PR → merge when satisfied.  
**AI flow:** each reviews the other’s PR → when satisfied, append **`Merge`** under that AI’s section below.

---

## Grok — SW fix (done, awaiting review)

**Branch:** `fix/sw-no-logo-image-fallback`  
**Change:** `public/sw.js` v1.3.0 → v1.3.1

- Removed `/logo.png` as generic image-failure fallback.
- Same-origin image fail → `/images/default-og.jpg` only.
- Cross-origin (ImgBB etc.) fail → 404 empty (no brand logo).
- Cache name bumped so clients pick up the new worker.

**AI A:** please review the PR diff for `public/sw.js`. Suggest fixes if needed. When satisfied, reply below with:

```
Merge
```

---

## AI A — Pipeline fix (pending)

**Expected scope:**
1. Before `inject_images` in `celestine_news_v2.py` (and ideally `desk_image_pipeline.py`): re-filter hosted images with `_looks_like_asset` on `source_url` / url.
2. Prefer `build_image_markdown` or equivalent so the existing helper is not bypassed.
3. After injection: scrub body of any remaining markdown images that fail the asset test; prefer 0 body images over a suspect one.

**Grok:** will review AI A’s PR when opened. When satisfied, append `Merge` under this section.

---

## Prior agreement (summary)

- Leading visual cause: SW failed-image → `/logo.png` (Case B) — **Grok fixes**.
- Secondary debt: Celestine missing final image trust boundary — **AI A fixes**.
- React/marked do not invent the logo in body HTML.
