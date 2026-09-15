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

BANNED_PHRASES = [
    'sasa basi', 'melting the pot', 'spill the tea', 'tea is hot',
    'grab your popcorn', 'buckle up', 'breaking news', 'dive in',
    'delve into', 'moreover', 'furthermore', 'in conclusion',
    "it's worth noting", 'a testament to', 'navigating the landscape',
    "in today's digital age", 'tapestry', 'shocking', 'massive',
    'jaw-dropping', 'explosive', 'you won\'t believe', 'what happened next',
    'read on', 'netizens', 'social media is buzzing'
]

BANNED_URL_PATHS = [
    '/author/', '/tag/', '/page/', '/feed/', '/comment-',
    '/category/', '/terms', '/about', '/privacy', '/contact',
    '/advertise', '/policy', '/disclaimer'
]

HYPE_TITLE_WORDS = [
    'shocking', 'massive', 'explosive', 'heartbreaking', 'urgent',
    'breaking news', 'drama', 'truth', 'full story', 'revealed',
    'exposed', 'uncovered', 'stuns', 'sparks fresh chatter'
]

GENERIC_FILLER_PATTERNS = [
    r'what this means for kenyans',
    r'key facts',
    r'faq',
    r'follow official updates',
    r'verify changes through official channels',
]

# -- STYLE PRESETS --------------------------------------------------------------
STYLE_PRESETS = {
    "reported_news": {
        "name": "reported_news",
        "format": "straight entertainment news",
        "lead_style": "one clear sentence answering who, what, where, when, and why it matters",
        "tone": "calm, specific, newsroom-clean, Kenyan reader aware",
        "angle": "lead with the verifiable development and its immediate context",
        "structure": "lede -> confirmed facts -> relevant context -> reaction only if sourced -> next known step",
        "sentence_mix": "mostly concise sentences with one context sentence per section",
        "closing": "end on the latest verified status, not a teaser"
    },
    "context_brief": {
        "name": "context_brief",
        "format": "explainer / backgrounder",
        "lead_style": "context first, then the latest development in the same paragraph",
        "tone": "authoritative, plain-spoken, useful",
        "angle": "explain why the development matters without overstating certainty",
        "structure": "why it matters -> latest development -> background -> known impact -> what remains unclear",
        "sentence_mix": "medium-length sentences with no rhetorical questions",
        "closing": "state what is confirmed and what readers should watch next"
    },
    "timeline_brief": {
        "name": "timeline_brief",
        "format": "chronological narrative",
        "lead_style": "open with the latest confirmed point, then move backward only where useful",
        "tone": "precise, chronological, restrained",
        "angle": "show the sequence of confirmed events that explains the update",
        "structure": "latest status -> timeline -> context -> unresolved questions",
        "sentence_mix": "short factual sentences for sequence, longer sentences for context",
        "closing": "where things stand right now"
    },
    "reaction_context": {
        "name": "reaction_context",
        "format": "reaction / opinion roundup",
        "lead_style": "summarize the verified development before describing reaction",
        "tone": "measured, conversational, source-aware",
        "angle": "explain the range of public response without treating chatter as fact",
        "structure": "event summary -> sourced reaction -> context -> what is confirmed",
        "sentence_mix": "varied but restrained, no quote-heavy imitation",
        "closing": "return to the confirmed facts"
    },
    "profile_led": {
        "name": "profile_led",
        "format": "profile / character-led feature",
        "lead_style": "introduce the key person as if the reader has never heard of them",
        "tone": "feature magazine - warm, professional, fair",
        "angle": "who the person is and why this verified development matters",
        "structure": "person intro -> why they're in the news -> background -> current story -> significance",
        "sentence_mix": "longer flowing sentences broken by short punchy standalone facts",
        "closing": "what is known about the person's current trajectory"
    }
}
PRESET_NAMES = list(STYLE_PRESETS.keys())
