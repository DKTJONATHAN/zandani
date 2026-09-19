#!/usr/bin/env python3
"""Wanjiku Kuria — Ghafla desk.
Ghafla-specific WordPress scrape + Za News GAP writer/image architecture.
"""
from __future__ import annotations
import datetime, hashlib, json, os, re, sys, urllib.parse, requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser
from playwright.sync_api import sync_playwright
from article_intelligence import extract_article_images
from desk_writer import generate_article, record_angle
from desk_image_pipeline import prepare_featured, prepare_images, inject_images, selected_images_json
from voice_guard import is_fresh_enough, mentions_stale_year, seo_fields

AUTHOR="Wanjiku Kuria"; CATEGORY="Gossip"; SOURCE="https://www.ghafla.co.ke/"; DOMAIN="ghafla.co.ke"
POSTS=os.environ.get("POSTS_DIR","content/posts"); MEMORY=os.environ.get("MEMORY_FILE",".github/memory_wanjiku.json")
FRESH=int(os.environ.get("FRESH_HOURS","24")); MAX=30; TRIES=12
HEAD={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36","Accept":"text/html,application/xhtml+xml"}

def memory():
    try:
        with open(MEMORY,encoding="utf-8") as f: m=json.load(f)
        if isinstance(m,dict): return m
    except Exception: pass
    return {"published_hashes":[],"urls":[],"published_angles":[],"style_history":[]}

def save(m):
    os.makedirs(os.path.dirname(MEMORY) or ".",exist_ok=True)
    for k,n in (("published_hashes",500),("urls",500),("published_angles",100),("style_history",30)): m[k]=m.get(k,[])[-n:]
    with open(MEMORY,"w",encoding="utf-8") as f: json.dump(m,f,indent=2)

def fetch(url):
    r=requests.get(url,headers=HEAD,timeout=25); r.raise_for_status(); return r.text

def article_link(href):
    p=urllib.parse.urlparse(href)
    if p.netloc and not p.netloc.endswith(DOMAIN): return False
    path=p.path.lower()
    if not path or path in ("/","/feed/") or any(x in path for x in ("/category/","/tag/","/author/","/page/","/search","/about","/contact","/privacy","/terms")): return False
    return True

def candidates():
    seen=set(); out=[]
    try: html=fetch(SOURCE)
    except Exception: html=""
    soup=BeautifulSoup(html,"html.parser")
    for a in soup.select("a[href]"):
        href=urllib.parse.urljoin(SOURCE,(a.get("href") or "").strip())
        if not article_link(href) or href in seen: continue
        title=a.get_text(" ",strip=True)
        if len(title)<20: continue
        seen.add(href); out.append(href)
    if len(out)<8:
        try:
            with sync_playwright() as p:
                b=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
                page=b.new_page(user_agent=HEAD["User-Agent"]); page.goto(SOURCE,wait_until="domcontentloaded",timeout=45000); page.wait_for_timeout(1800)
                soup=BeautifulSoup(page.content(),"html.parser"); b.close()
                for a in soup.select("a[href]"):
                    href=urllib.parse.urljoin(SOURCE,(a.get("href") or "").strip())
                    if article_link(href) and href not in seen and len(a.get_text(" ",strip=True))>=20:
                        seen.add(href); out.append(href)
        except Exception as e: print("Ghafla listing fallback:",e)
    return out[:MAX]

def scrape(url):
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            page=b.new_page(user_agent=HEAD["User-Agent"],viewport={"width":1280,"height":900})
            page.goto(url,wait_until="domcontentloaded",timeout=45000); page.wait_for_timeout(1200)
            html=page.content(); b.close()
        soup=BeautifulSoup(html,"html.parser")
        fresh,age=is_fresh_enough(soup,max_hours=FRESH)
        if not fresh: return None
        root=None
        for sel in ["article",".entry-content",".post-content",".article-content","main article",".content"]:
            root=soup.select_one(sel)
            if root and len(root.get_text(" ",strip=True))>500: break
        if root is None: root=soup
        paras=[p.get_text(" ",strip=True) for p in root.find_all("p") if len(p.get_text(" ",strip=True))>=35]
        body="\n\n".join(paras)
        if len(body)<500: return None
        title=""
        for prop in ("og:title","twitter:title"):
            t=soup.find("meta",property=prop) or soup.find("meta",attrs={"name":prop})
            if t and t.get("content"): title=t["content"].strip(); break
        if not title and soup.title: title=soup.title.get_text(" ",strip=True)
        featured=""
        for prop in ("og:image","twitter:image","twitter:image:src"):
            t=soup.find("meta",property=prop) or soup.find("meta",attrs={"name":prop})
            if t and t.get("content"): featured=urllib.parse.urljoin(url,t["content"].split("?")[0]); break
        images=extract_article_images(soup,url,root,limit=12)
        if mentions_stale_year(body,datetime.datetime.now().year): return None
        return {"url":url,"title":title,"body":body[:18000],"images":images,"featured":featured}
    except Exception as e:
        print("Ghafla scrape failed:",url,e); return None

def slug(s): return re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")[:90]

def publish(result,src):
    title=result["title"].strip(); body=result["body"].strip()
    featured=prepare_featured(src.get("featured",""),src["url"])
    body_images=prepare_images(src.get("images",[]),src["url"],src.get("featured",""))
    body=inject_images(body,body_images)
    if not featured: raise RuntimeError("No verified Ghafla OG image could be hosted")
    now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    seo=seo_fields(title,body,CATEGORY,AUTHOR); s=slug(seo["title"])
    path=os.path.join(POSTS,f"{now[:10]}-{s}.md"); os.makedirs(POSTS,exist_ok=True)
    fm=f'''---
title: "{seo["title"].replace('"',"'")}"
slug: "{s}"
description: "{seo["description"].replace('"',"'")}"
excerpt: "{seo["excerpt"].replace('"',"'")}"
date: {now}
dateModified: {now}
author: "{AUTHOR}"
category: "{CATEGORY}"
county: "{seo["county"]}"
image: "{featured}"
selectedImages: {selected_images_json(body_images)}
readTime: {max(3,len(body.split())//180)}
source: "{src["url"]}"
stylePreset: "{result["style"]["name"]}"
editorialAngle: "{str(result["analysis"].get("chosen_angle_gap","")).replace('"',"'")[:300]}"
angleType: "{str(result["analysis"].get("angle_type","")).replace('"',"'")[:80]}"
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
            result=generate_article(src,m,AUTHOR,"entertainment and gossip correspondent",CATEGORY)
            digest=hashlib.sha256((result["title"]+"|"+src["url"]).encode()).hexdigest()
            if digest in m.get("published_hashes",[]): continue
            path=publish(result,src); record_angle(m,result,src["url"])
            m.setdefault("published_hashes",[]).append(digest); m.setdefault("urls",[]).append(url); save(m)
            print("Published Ghafla:",path); return 0
        except Exception as e: print("Ghafla candidate rejected:",e)
    print("No eligible Ghafla story"); return 0
if __name__=="__main__": sys.exit(main())
