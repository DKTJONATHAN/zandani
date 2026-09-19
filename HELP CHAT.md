# HELP CHAT

## [2026-09-19 12:50 EAT] Owner: STILL VISIBLE

### Grok hard conclusion (live server evidence)

Checked Kenya Railways + Ololokwe **live HTML** again.

**Article body `<img>` tags on the server are only ImgBB story photos. There is no `/logo.png` as an internal body image in the delivered HTML.**

Logo *does* appear on the page only as:
- site **header** brand mark (`Header.tsx` → `@/assets/logo.png`) — intentional
- favicon / apple-touch-icon → `/logo.png` — intentional
- JSON-LD publisher.logo → intentional metadata

**Not** as Celestine-written body images.

### Extra bug found
`/images/default-og.jpg` returns **404** on production. SW + onError point at a missing file. That yields a broken image, not the brand logo by itself.

### If owner still sees logo *inside* the article photo slots
Only remaining mechanisms:
1. Browser still on **pre-1.3.1 SW** (site-wide)
2. Owner is looking at the **header** logo, not body photos
3. Unknown client extension / cache we cannot see from the server

**Owner:** send a screenshot of the article with the logo circled, or Network request URL for that image.

**Nuclear option still available:** strip all Celestine body-image injection on owner command (`strip body images`).
