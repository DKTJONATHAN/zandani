#!/usr/bin/env python3
"""Trusted source-image pipeline for Za Ndani desks.

Rules:
- OG image is extracted separately from the publisher's og:image/twitter:image.
- Body images come only from the article-body DOM, never listing/sidebar/branding assets.
- Every image is downloaded and decoded before publication.
- Every published image is re-hosted on ImgBB; no unverified hotlinks.
- Body insertion supports one or two genuine source images.
"""
from __future__ import annotations
import base64, io, json, os, re
import requests
try:
    from PIL import Image
except Exception:
    Image = None
from article_intelligence import _looks_like_asset

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36"

def _bad(url, alt="", caption=""):
    text=" ".join(str(x or "") for x in (url,alt,caption)).lower()
    blocked=("logo","site-logo","brand-logo","brandmark","wordmark","favicon","sprite",
             "tracking","pixel","placeholder","default-image","default-og","og-image",
             "og_image","social-share","whatsapp","facebook","twitter","telegram",
             "advert","banner-ad","masthead","header-image","avatar","icon","zandani")
    return not str(url or "").strip() or any(x in text for x in blocked) or _looks_like_asset(url,alt,caption)

def _download_image(url, source_url=""):
    h={"User-Agent":UA,"Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}
    if source_url: h["Referer"]=source_url
    r=requests.get(url,headers=h,timeout=25,allow_redirects=True)
    r.raise_for_status()
    ctype=(r.headers.get("content-type") or "").lower()
    raw=r.content
    if len(raw)<1000 or ("image" not in ctype and not raw.startswith((b"\xff\xd8",b"\x89PNG",b"RIFF"))):
        raise ValueError("not a valid image response")
    if Image is not None:
        im=Image.open(io.BytesIO(raw))
        im.verify()
        im=Image.open(io.BytesIO(raw))
        return raw, im.width, im.height
    return raw, 0, 0

def upload_to_imgbb(url, source_url=""):
    api=os.environ.get("IMGBB_API_KEY") or os.environ.get("IMGBB_KEY")
    if not api: return ""
    try:
        raw,w,h=_download_image(url,source_url)
        if w and h and (w<250 or h<150): raise ValueError("image dimensions too small")
        if Image is not None:
            im=Image.open(io.BytesIO(raw))
            if im.mode in ("RGBA","LA","P"): im=im.convert("RGB")
            if im.width>1600:
                ratio=1600/float(im.width)
                im=im.resize((1600,max(1,int(im.height*ratio))),Image.LANCZOS)
            buf=io.BytesIO(); im.save(buf,format="WEBP",quality=84,method=4)
            raw=buf.getvalue()
        res=requests.post("https://api.imgbb.com/1/upload",
                          data={"key":api,"image":base64.b64encode(raw).decode()},
                          timeout=35)
        res.raise_for_status()
        data=res.json().get("data") or {}
        hosted=data.get("url") or data.get("display_url") or ""
        if not hosted: return ""
        _download_image(hosted)
        return hosted
    except Exception as exc:
        print("image rejected:",url,exc)
        return ""

def prepare_featured(featured, source_url=""):
    if _bad(featured): return ""
    return upload_to_imgbb(featured,source_url)

def prepare_images(candidates, source_url="", featured=""):
    out=[]; seen=set(); featured_norm=str(featured or "").split("?")[0].rstrip("/").lower()
    for item in candidates or []:
        if not isinstance(item,dict): continue
        source=str(item.get("url") or "").strip()
        if not source or source in seen or source.split("?")[0].rstrip("/").lower()==featured_norm or _bad(source,item.get("alt",""),item.get("caption","")): continue
        seen.add(source)
        hosted=upload_to_imgbb(source,source_url)
        if not hosted: continue
        out.append({**item,"source_url":source,"url":hosted,
                    "selected_alt":str(item.get("alt") or item.get("caption") or "Story image").strip()[:180] or "Story image",
                    "reason":"Selected from the source article-body image set"})
        if len(out)>=3: break
    return out

def strip_generated_images(body):
    body=re.sub(r"!\[[^\]]*\]\([^)]*\)","",body or "")
    body=re.sub(r"<img\b[^>]*>","",body,flags=re.I)
    return re.sub(r"\n{3,}","\n\n",body).strip()

def inject_images(body, images):
    body=strip_generated_images(body)
    trusted=[]; seen=set()
    for x in images or []:
        u=x.get("url",""); s=x.get("source_url","")
        if not u or not s or u in seen or s in seen: continue
        if _bad(u,x.get("alt",""),x.get("caption","")): continue
        seen.add(u); seen.add(s); trusted.append(x)
    blocks=[p.strip() for p in body.split("\n\n") if p.strip()]
    if not trusted or not blocks: return body
    n=len(blocks)
    if n < 4:
        # Short stories still receive one genuine internal image.
        placements={max(1, min(n, round(n*0.5))): trusted[0]}
    else:
        first=max(2,min(n-1,round(n*0.30)))
        placements={first:trusted[0]}
        if len(trusted)>=2:
            second=max(first+2,min(n-1,round(n*0.65)))
            if second!=first: placements[second]=trusted[1]
    out=[]
    for i,p in enumerate(blocks,1):
        out.append(p)
        if i in placements:
            x=placements[i]
            alt=re.sub(r"[\[\]\r\n]","",x.get("selected_alt") or "Story image")[:180]
            out.append(f"![{alt}]({x['url']})")
    return "\n\n".join(out)

def selected_images_json(images):
    return json.dumps([{"url":x.get("url",""),"source_url":x.get("source_url",""),
                       "alt":x.get("selected_alt") or x.get("alt") or "Story image",
                       "reason":x.get("reason","Source article image")}
                      for x in images or []],ensure_ascii=False)
