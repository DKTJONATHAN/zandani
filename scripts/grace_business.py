import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Grace Wambui",
        "category": "Business",
        "source_url": "https://kenyanwallstreet.com/",
        "source_domain": "kenyanwallstreet.com",
        "memory_file": ".github/memory_business.json",
        "role": "business correspondent",
        "audience": "Kenyan business, markets, investing and enterprise readers",
        "path_hints": ["news", "business", "markets", "banking", "companies", "finance", "investing", "2026", "/20"],
    })
