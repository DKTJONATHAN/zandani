#!/usr/bin/env python3
"""Martin Kihara — Mpasho desk.
Mpasho-specific Next.js/RSC scrape + Za News GAP writer/image architecture.
"""
from __future__ import annotations
import datetime, hashlib, json, os, re, sys, urllib.parse, requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser
from playwright.sync_api import sync_playwright
from article_intelligence import extract_article_images
from desk_writer import generate_article, record_angle
from desk_image_pipeline import prepare_featured, prepare_images, inject_images, selected_images_json
from voice_guard import mentions_stale_year

AUTHOR="Martin Kihara"; CATEGORY="Showbiz"; DOMAIN="mpasho.co.ke"
LISTINGS=["https://www.mpasho.co.ke/"]
POSTS=os.environ.get("POSTS_DIR","content/posts"); MEMORY=os.environ.get("MEMORY_FILE",".github/memory_martin_mpasho.json")
FRESH=int(os.environ.get("FRESH_HOURS","24")); MAX=30
HEAD={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36","Accept":"text/html,application/xhtml+xml"}

def memory():
    try:
        with open(MEMORY,encoding="utf-8") as f: m=json.load(f)
        if isinstance(m,dict): return m
    except Exception: pass
    return {"published_hashes":[],"urls":[],"published_angles":[],"style_history":[],"recent_stories":[]}

def save(m):
    os.makedirs(os.path.dirname(MEMORY) or ".",exist_ok=True)
    for k,n in (("published_hashes",500),("urls",500),("published_angles",100),("style_history",30),("recent_stories",200)): m[k]=m.get(k,[])[-n:]
    with open(MEMORY,"w",encoding="utf-8") as f: json.dump(m,f,indent=2)

def story_key(url):
    p=urllib.parse.urlparse(url).path
    m=re.search(r"/(20\d{2}-\d{2}-\d{2}-[a-z0-9-]{10,})",p)
    return m.group(1) if m else p.rstrip("/").split("/")[-1]

def article_path(url):
    p=urllib.parse.urlparse(url).path.lower()
    if any(x in p for x in ("/author/","/tag/","/category/","/page/","/feed","/search","/about","/contact")): return False
    return bool(re.search(r"/20\d{2}-\d{2}-\d{2}-[a-z0-9-]{10,}",p)) or any(x in p for x in ("/entertainment/","/relationships/","/exclusives/"))

def candidates():
    out=[]; seen=set()
    for listing in LISTINGS:
        try:
            r=requests.get(listing,headers=HEAD,timeout=25); r.raise_for_status()
            soup=BeautifulSoup(r.text,"html.parser")
            for a in soup.select("a[href]"):
                href=urllib.parse.urljoin(listing,(a.get("href") or "").strip())
                parsed=urllib.parse.urlparse(href)
                if parsed.netloc!=DOMAIN or not article_path(href): continue
                # Mpasho is the discovery source; this desk publishes entertainment only.
                if not parsed.path.lower().startswith("/entertainment/"): continue
                k=story_key(href)
                if k in seen: continue
                seen.add(k); out.append(href)
        except Exception as e: print("Mpasho listing failed:",listing,e)
    # Mpasho frequently returns 403 to plain HTTP clients on some sections.
    # Always give the browser a chance for each listing that failed above,
    # rather than falling back only when the entire candidate set is empty.
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            page=b.new_page(user_agent=HEAD["User-Agent"],viewport={"width":1280,"height":900})
            for listing in LISTINGS:
                try:
                    page.goto(listing,wait_until="domcontentloaded",timeout=45000); page.wait_for_timeout(1800)
                    soup=BeautifulSoup(page.content(),"html.parser")
                    for a in soup.select("a[href]"):
                        href=urllib.parse.urljoin(listing,(a.get("href") or "").strip())
                        parsed=urllib.parse.urlparse(href)
                        if parsed.netloc==DOMAIN and article_path(href) and parsed.path.lower().startswith("/entertainment/") and story_key(href) not in seen:
                            seen.add(story_key(href)); out.append(href)
                except Exception as e:
                    print("Mpasho browser listing failed:",listing,e)
            b.close()
    except Exception as e: print("Mpasho Playwright listing fallback failed:",e)
    return out[:MAX]

def publish_dt(html):
    patterns=[r'datePublished\\?":\\?"([^"\\]+)',r'"datePublished":"([^"]+)"']
    for pat in patterns:
        m=re.search(pat,html)
        if m:
            try: return date_parser.parse(m.group(1))
            except Exception: pass
    soup=BeautifulSoup(html,"html.parser")
    for prop in ("article:published_time","og:published_time"):
        t=soup.find("meta",property=prop)
        if t and t.get("content"):
            try:return date_parser.parse(t["content"])
            except Exception:pass
    return None

def scrape(url):
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            page=b.new_page(user_agent=HEAD["User-Agent"],viewport={"width":1280,"height":900})
            page.goto(url,wait_until="domcontentloaded",timeout=45000); page.wait_for_timeout(2200)
            html=page.content(); b.close()
        soup=BeautifulSoup(html,"html.parser")
        dt=publish_dt(html)
        if dt:
            if dt.tzinfo is None: dt=dt.replace(tzinfo=datetime.timezone.utc)
            age=(datetime.datetime.now(datetime.timezone.utc)-dt).total_seconds()/3600
            if age>FRESH: return None
        title=(soup.find("meta",property="og:title") or {}).get("content","").strip()
        if not title and soup.title: title=soup.title.get_text(" ",strip=True)
        root=None
        for sel in ["article","main article",".article-content",".post-content","main"]:
            root=soup.select_one(sel)
            if root and len(root.get_text(" ",strip=True))>400: break
        if root is None: root=soup
        paras=[p.get_text(" ",strip=True) for p in root.find_all("p") if len(p.get_text(" ",strip=True))>=35]
        body="\n\n".join(paras)
        if len(body)<500:
            # Next.js RSC fallback: extract long prose strings from self.__next_f payload.
            prose=re.findall(r'([A-Z][^"<>]{100,900}?[.!?])',html)
            seen=set(); chunks=[]
            for x in prose:
                x=re.sub(r"\\u[0-9a-fA-F]{4}", " ", x).strip()
                if len(x)<100 or x[:80].lower() in seen or any(z in x.lower() for z in ("static/chunks","className","self.__next_f","radio africa","http://","https://")): continue
                seen.add(x[:80].lower()); chunks.append(x)
            body="\n\n".join(chunks)
        if len(body)<500:return None
        featured=""
        for prop in ("og:image","twitter:image","twitter:image:src"):
            t=soup.find("meta",property=prop) or soup.find("meta",attrs={"name":prop})
            if t and t.get("content"): featured=urllib.parse.urljoin(url,t["content"].split("?")[0]); break
        images=extract_article_images(soup,url,root,limit=12)
        if mentions_stale_year(body,datetime.datetime.now().year): return None
        return {"url":url,"title":title,"body":body[:18000],"images":images,"featured":featured}
    except Exception as e: print("Mpasho scrape failed:",url,e); return None

def slug(s):return re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")[:90]

def publish(result,src):
    featured=prepare_featured(src.get("featured",""),src["url"])
    if not featured: raise RuntimeError("No verified Mpasho OG image could be hosted")
    body=inject_images(result["body"],prepare_images(src.get("images",[]),src["url"],src.get("featured","")))
    now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    s=slug(result["title"]); path=os.path.join(POSTS,f"{now[:10]}-{s}.md"); os.makedirs(POSTS,exist_ok=True)
    description=re.sub(r"\\s+"," ",body)[:155].replace('"',"'")
    angle=str(result["analysis"].get("chosen_angle_gap","")).replace('"',"'")[:300]
    angle_type=str(result["analysis"].get("angle_type","")).replace('"',"'")[:80]
    # Recompute body image metadata from the inserted Markdown URLs.
    used=[]
    for u in re.findall(r"!\[[^\]]*\]\((https?://[^)]+)\)",body):
        used.append({"url":u,"source_url":"","alt":"Mpasho story image","reason":"Inserted from verified Mpasho article-body image"})
    fm=f'''---
title: "{result["title"].replace('"',"'")}"
slug: "{s}"
description: "{description}"
excerpt: "{description}"
date: {now}
dateModified: {now}
author: "{AUTHOR}"
category: "{CATEGORY}"
image: "{featured}"
selectedImages: {json.dumps(used,ensure_ascii=False)}
readTime: {max(3,len(body.split())//180)}
source: "{src["url"]}"
stylePreset: "{result["style"]["name"]}"
editorialAngle: "{angle}"
angleType: "{angle_type}"
schema: "NewsArticle"
---

{body}
'''
    with open(path,"w",encoding="utf-8") as f:f.write(fm)
    return path

def main():
    m=memory()
    for url in candidates():
        if url in m.get("urls",[]): continue
        src=scrape(url)
        if not src: continue
        try:
            result=generate_article(src,m,AUTHOR,"showbiz correspondent",CATEGORY)
            digest=hashlib.sha256((result["title"]+"|"+story_key(url)).encode()).hexdigest()
            if digest in m.get("published_hashes",[]): continue
            path=publish(result,src); record_angle(m,result,src["url"])
            m.setdefault("published_hashes",[]).append(digest); m.setdefault("urls",[]).append(url)
            m.setdefault("recent_stories",[]).append({"key":story_key(url),"ts":datetime.datetime.now(datetime.timezone.utc).isoformat()})
            save(m); print("Published Mpasho:",path); return 0
        except Exception as e: print("Mpasho candidate rejected:",e)
    print("No eligible Mpasho story"); return 0
if __name__=="__main__":sys.exit(main())
