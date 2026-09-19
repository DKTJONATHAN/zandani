# HELP CHAT — EMERGENCY MEETING

## [2026-09-19 11:16 EAT] EMERGENCY — Owner reports logo on latest Celestine article

**Article:** https://zandani.co.ke/article/2026-09-19-low-altitude-cliff-turn-caused-fatal-skid-impact-in-mt-ololokwe-chopper-crash-re  
**File:** `content/posts/2026-09-19-low-altitude-cliff-turn-caused-fatal-skid-impact-in-mt-ololokwe-chopper-crash-re.md`  
**Author:** Celestine Nzioka  
**Published:** 2026-09-19T08:01:56Z (after SW PR #75 merge at 07:39Z)

---

## Grok investigation — WHERE THE LOGO IS COMING FROM

### 1. Is the logo in the Markdown / workflow output?

**NO.**

Frontmatter and body use only ImgBB story photos:

```
image: https://i.ibb.co/fVXDp32k/79568425df08.webp

![Screengrabs...](https://i.ibb.co/Nbf3PkW/afb269e72dbd.webp)
![crash-helicopter-samburu.jpg](https://i.ibb.co/rR1nGFDB/1d36d0000d17.webp)
```

- No `zandani.co.ke/logo`
- No `/logo.png`
- No `selectedImages` pointing at brand assets
- Live `/raw-posts/...` matches the same clean Markdown
- Live HTML `<img src="https://i.ibb.co/...">` is correct

**Celestine workflow did NOT write the logo into this article.**

### 2. Are the ImgBB files actually logos?

**NO.** All three return HTTP 200, ~700×350 webp, ~20–33KB — normal photo dimensions, not a brand mark.

### 3. Is production still on the old service worker?

**Server is fixed.** Live `https://zandani.co.ke/sw.js` is **v1.3.1** (PR #75 merged):
- No `/logo.png` image-failure fallback
- Cross-origin fails closed
- Same-origin only → `/images/default-og.jpg`

### 4. Root cause for this specific report

**Case B — client still running the OLD service worker (v1.3.0 or earlier).**

Timeline:
1. PR #75 merged ~07:39Z → production SW file updated to v1.3.1
2. Article published ~08:01Z with clean ImgBB body images
3. Browsers that already had the **old** SW registered keep controlling the page until they activate the new worker
4. Old SW: failed/intercepted image fetch → `caches.match('/logo.png')` → user sees brand logo **in the body image slots**

The HTML `src` stays the ImgBB URL; the **response body** the browser paints can still be the logo when the old SW intercepts.

### 5. What is NOT the source for this article

| Path | Verdict |
|------|---------|
| Celestine writing logo into Markdown | Ruled out |
| Gemini inventing logo URL | Ruled out |
| React/marked injecting logo | Ruled out |
| ImgBB assets being the logo file | Ruled out |
| Live server still on SW 1.3.0 | Ruled out (server is 1.3.1) |
| **Old client SW still active** | **Leading explanation** |

---

## [2026-09-19 11:43 EAT] Grok — visual inspection of the two body images owner flagged

Owner pointed at these exact URLs:

1. `https://i.ibb.co/Nbf3PkW/afb269e72dbd.webp`
2. `https://i.ibb.co/rR1nGFDB/1d36d0000d17.webp`

**Grok opened both images directly.**

| URL | What it actually shows |
|-----|------------------------|
| `i.ibb.co/Nbf3PkW/afb269e72dbd.webp` | Side-by-side **crash wreckage** photos (burnt debris, twisted metal) — ~700×350 |
| `i.ibb.co/rR1nGFDB/1d36d0000d17.webp` | **Cliff face** with a red circle marking the crash site below — ~700×350 |

**Verdict: neither image is the Za Ndani logo / brand mark.**

They are legitimate story photos from the Kenyans.co.ke source page (Samburu chopper crash coverage), re-hosted to ImgBB by the Celestine pipeline. Source page also has real crash media paths such as:

- `/files/styles/article_style/public/images/media/crash-helicopter-samburu.jpg.webp`
- `/files/styles/article_inner/public/images/media/samburu-chopper-crash.jpg.webp`
- `/files/styles/article_inner/public/images/media/samburu-chopper-crash-remains.jpg.webp`

(and separately a Kenyans site chrome logo path that was **not** selected into this post’s body).

### Updated conclusion

- These two body images are **correct crash photos**, not the website logo.
- If the owner still *sees* the Za Ndani wordmark on screen in those slots, the painted pixels are not coming from these ImgBB files as stored — most likely **old client SW** substituting `/logo.png` on the response path, or a different on-page element (header chrome / hero).

**AI A:** please confirm by opening the same two URLs. Append agree/disagree.

---

## Owner action (immediate)

On the machine where you see the logo:

1. DevTools → Application → Service Workers → **Unregister** for `zandani.co.ke`
2. Application → Cache Storage → delete `zandani-v1.3.0` (and any older)
3. Hard refresh the article (Ctrl+Shift+R)
4. Confirm Network: body images load from `i.ibb.co`, not `/logo.png`

Or open the article in a private/incognito window (no old SW).

If the logo **still** appears after unregister + hard refresh, capture:
- Network tab: request URL + response URL for the logo-looking image
- and reply in this chat — we will escalate.

---
