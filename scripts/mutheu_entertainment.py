#!/usr/bin/env python3
"""Mutheu Ann — straight entertainment reporter (Pulse Live KE). No commentary."""
import os, sys, json, re, time, random, hashlib, base64, itertools, datetime, urllib.parse
import requests
from dateutil import parser as date_parser
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types

try:
    from voice_guard import news_prompt, should_skip_story, strip_banned, inject_know_if_missing, seo_fields, polish_body, model_skipped, is_fresh_enough, mentions_stale_year
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from voice_guard import news_prompt, should_skip_story, strip_banned, inject_know_if_missing, seo_fields, polish_body, model_skipped, is_fresh_enough, mentions_stale_year


AUTHOR_NAME = "Mutheu Ann"
AUTHOR_SLUG = "mutheu-ann"
CATEGORY = "Entertainment"
SITE_BASE_URL = "https://zandani.co.ke"
SOURCE_URL = "https://nation.africa/kenya/life-style/entertainment"
SOURCE_DOMAIN = "nation.africa"
SOURCE_URLS = [
    "https://nation.africa/kenya/life-style/entertainment",
    "https://www.pulselive.co.ke/articles/entertainment",
]
POSTS_DIR = os.environ.get("POSTS_DIR", "content/posts")
MEMORY_FILE = os.environ.get("MEMORY_FILE", ".github/memory_mutheu.json")
MAX_CANDIDATES = 25
MAX_SCRAPE_TRIES = 10
FRESH_HOURS = 12

MODELS_TO_TRY = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]

UNSPLASH_FALLBACKS = [
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200",
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200",
]

BANNED_PHRASES = [
    "sasa basi", "melting the pot", "spill the tea", "tea is hot", "grab your popcorn",
    "buckle up", "breaking news", "dive in", "delve into", "moreover", "furthermore",
    "in conclusion", "it's worth noting", "a testament to", "navigating the landscape",
    "in today's digital age", "tapestry", "game-changer", "stay tuned", "unpack",
    "is the central subject of the update", "central subject of the update",
    "central to this update", "what this means for kenyans", "what this means for kenya",
    "key takeaway", "search-ready summary",
]

STYLE_PRESETS = [
    {"name": "Hard News Lead", "lead_style": "Who did what, where, when.",
     "tone": "Neutral wire-service. No opinion.", "structure": "Lead, facts by importance, quotes, status"},
    {"name": "Event Report", "lead_style": "Open with the event and principal actor.",
     "tone": "Factual, clipped.", "structure": "Lead, sequence, confirmation, numbers"},
    {"name": "Statement Report", "lead_style": "Official action or statement first.",
     "tone": "Neutral, attribution-heavy.", "structure": "Lead, quote/order, background, response"},
]

now_utc = datetime.datetime.utcnow()
now_eat = now_utc + datetime.timedelta(hours=3)
publish_ts = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
today_str = now_eat.strftime("%Y-%m-%d")
full_date_str = now_eat.strftime("%A, %B %d, %Y")

# NOTE: This restore is incomplete - the full 17KB file must replace this.
# Stopping to use the zip file via a complete push.
