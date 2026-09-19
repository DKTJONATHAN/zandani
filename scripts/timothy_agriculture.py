import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Timothy Muli",
        "category": "Agriculture",
        "source_url": "https://theorganicfarmer.org/",
        "source_domain": "theorganicfarmer.org",
        "memory_file": ".github/memory_agriculture.json",
        "role": "agriculture correspondent",
        "audience": "Kenyan farmers, agribusinesses and agriculture-policy readers",
        "topic_terms": ["agriculture", "farmer", "farm", "livestock", "crop", "maize", "milk", "dairy", "fertiliser", "fertilizer", "food production"],
        "path_hints": ["/news/", "agriculture", "farmer", "farm", "livestock", "crop", "food", "maize", "milk", "/20"],
    })
