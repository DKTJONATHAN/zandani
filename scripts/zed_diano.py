import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Zed Mogaka",
        "category": "Entertainment",
        "source_url": "https://www.vantageke.com/category/entertainment/lifestyle-culture",
        "source_domain": "vantageke.com",
        "memory_file": ".github/memory_georgediano.json",
        "role": "entertainment desk writer covering George Diano and Kenyan showbiz",
        "audience": "Kenyan entertainment readers",
        "topic_terms": ["diano", "george diano"],
        "path_hints": ["celebrity", "entertainment", "music", "video", "artist", "/20"],
    })
