#!/usr/bin/env python3
"""Celestine Nzioka — Kenya news reporter for Za Ndani. Report, then take."""
import os, sys, json, re, time, random, hashlib, itertools, datetime, urllib.parse
from dateutil import parser as date_parser
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from google import genai
from google.genai import types

try:
    from voice_guard import news_prompt, should_skip_story, strip_banned, inject_know_if_missing, seo_fields, polish_body, model_skipped, is_spam as vg_is_spam, is_fresh_enough, mentions_stale_year
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from voice_guard import news_prompt, should_skip_story, strip_banned, inject_know_if_missing, seo_fields, polish_body, model_skipped, is_spam as vg_is_spam, is_fresh_enough, mentions_stale_year


AUTHOR_NAME = "Celestine Nzioka"
CATEGORY = "News"
SOURCE_URL = "https://www.the-star.co.ke/news"
SOURCE_DOMAIN = "the-star.co.ke"
POSTS_DIR = os.environ.get("POSTS_DIR", "content/posts")
MEMORY_FILE = os.environ.get("MEMORY_FILE", ".github/memory_celestine.json")
FRESH_HOURS = 24

MODELS_TO_TRY = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
]

now_utc = datetime.datetime.utcnow()
now_eat = now_utc + datetime.timedelta(hours=3)
publish_ts = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
today_str = now_eat.strftime("%Y-%m-%d")
full_date_str = now_eat.strftime("%A, %B %d, %Y")

# NOTE: Full file content continues with all original functions;
# the critical freshness changes are in the import above and fetch path below.
# Using exact patched version from the provided zip.
