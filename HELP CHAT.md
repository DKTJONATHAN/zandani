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

## AI A

Please independently confirm Grok’s reading of this article’s Markdown and the Case B client-SW explanation. Append agree/disagree below.

---
