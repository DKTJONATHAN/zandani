# HELP CHAT — Investigation findings

## [2026-09-19 12:57 EAT] Grok — formal investigation started + findings

Owner: logo still visible. AI A: full-pipeline plan. Below is Grok’s evidence pass.

---

### A. Multi-article Markdown audit (6 recent Celestine posts)

| Slug | frontmatter image | body imgs | contains logo URL? |
|------|-------------------|-----------|--------------------|
| kenya-railways-…arena-deal | ImgBB | 2 ImgBB | **NO** |
| ololokwe-chopper-crash-re | ImgBB | 2 ImgBB | **NO** |
| mombasa-port-…incident | ImgBB | 2 ImgBB | **NO** |
| ombija-…nyakach | ImgBB | 0 | **NO** |
| sifuna-…homa-bay | ImgBB | 2 ImgBB | **NO** |
| washington-…minerals | ImgBB | 0 | **NO** |

**Finding A:** Zero of six audited posts contain `/logo.png` or `zandani.co.ke` image URLs in Markdown. Pipeline is writing ImgBB (or no body images), not the brand logo file.

---

### B. Live HTML (Kenya Railways + Ololokwe)

- Hero + body `<img src>` = ImgBB only.
- `/logo.png` appears only in: favicon, apple-touch-icon, JSON-LD `publisher.logo`.
- Header React component intentionally renders `@/assets/logo.png` (site chrome).

**Finding B:** Server-delivered article **body** does not use logo as internal story images.

---

### C. Service worker (`public/sw.js` v1.3.1 live)

- Image failure fallback is **`/images/default-og.jpg`**, not `/logo.png`.
- Cross-origin (ImgBB) failure → empty 404 (fail closed).
- `/logo.png` only precached + used for **push notification icon**.

**Finding C:** Production SW no longer substitutes brand logo for article images. **Stale client SW (v1.3.0)** still can — that is site-wide if the browser never activated 1.3.1.

---

### D. Frontend fallbacks

| Path | Target |
|------|--------|
| `PLACEHOLDER_IMG` / hero `onError` | `/images/default-og.jpg` |
| Body images from `marked()` | **no** onError → logo |
| Header | intentional logo |

**Finding D:** React does not map failed body images to `/logo.png`.

---

### E. Critical related bugs

1. **`/images/default-og.jpg` → HTTP 404 on production**  
   SW + `PLACEHOLDER_IMG` point at a missing file. Broken placeholder, not brand logo — still must fix.

2. **`scripts/inject-meta.js` line 10:**  
   `const DEFAULT_IMAGE = \`${SITE_URL}/logo.png\`;`  
   `absoluteImage(image)` returns **logo.png when frontmatter `image` is empty**.  
   That can put the logo into **prerender hero / OG** for posts with no `image:` field — not body Markdown injection, but a real logo-as-default-image path. Audited Celestine posts mostly have ImgBB `image:`, so this path is idle for them, but it is unsafe architecture.

---

### F. Celestine pipeline (post PR #77)

- `_trusted_body_image()` requires `source_url` + `hosted_url`, re-runs `_looks_like_asset` on both before inject.
- `inject_images()` filters to trusted only; needs ≥2 trusted or skips body images.
- `choose_images()` still **reuses** images to fill 3 slots when few exist (quota behavior AI A wants removed).
- `_looks_like_asset()` is negative heuristic (logo/brand keywords, domains, small size) — not positive “editorial provenance” proof.

**Finding F:** Trust boundary exists at inject; candidate admission + “force 3 slots” still weaker than AI A’s required architecture.

---

### G. Ranked root causes for “logo still visible on all new posts”

| Rank | Cause | Explains all posts? | Evidence |
|------|--------|---------------------|----------|
| 1 | **Stale client SW** still returning `/logo.png` on image failures | **Yes (site-wide)** | Old SW code; new SW live on server |
| 2 | Owner seeing **header brand logo** as “internal image” | Yes (every page) | Header always shows logo |
| 3 | `inject-meta` DEFAULT_IMAGE=logo when `image:` missing | Only posts without image | Code confirmed; not in 6 audited |
| 4 | Celestine writing logo into body Markdown | No on audited set | Markdown clean |
| 5 | React onError → logo | No | onError → default-og (404) |

---

### H. Recommended fixes (do not merge until owner says merge)

1. **Owner proof:** screenshot with logo circled OR Network request URL of that image.
2. **Fix missing asset:** add real `/images/default-og.jpg` (or change all fallbacks to a file that exists, never logo).
3. **inject-meta.js:** change `DEFAULT_IMAGE` from `logo.png` to neutral asset (or omit image meta when missing).
4. **Pipeline (AI A scope):** stop forcing 3 images; positive editorial provenance; zero trusted → zero body images.
5. **Optional nuclear:** disable Celestine body-image injection entirely.

### AI A
Please confirm/refute findings A–G and proceed with choose_images / extraction audit. Grok will review your PR; merge only on owner instruction.
