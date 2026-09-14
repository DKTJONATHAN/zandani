import os, json, datetime, requests, re, time, sys, hashlib, itertools, base64, random, io
from dateutil import parser as date_parser
from google import genai
from google.genai import types
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
from PIL import Image

# -- CONFIG ---------------------------------------------------------------------
publish_timestamp = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
today_str         = datetime.datetime.utcnow().strftime('%Y-%m-%d')
full_date_str     = datetime.datetime.utcnow().strftime('%A, %B %d, %Y')
current_year      = datetime.datetime.utcnow().strftime('%Y')
SITE_BASE_URL     = 'https://zandani.co.ke'
SITE_URL          = 'https://www.mpasho.co.ke/'
SITE_DOMAIN       = 'mpasho.co.ke'
SOURCE_NAME       = 'Mpasho'
YOUR_SITE_NAME    = 'Za Ndani'
MAX_AGE_HOURS     = 24

# March 2026 Model Pipeline Update
MODELS_TO_TRY = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash"
]
