import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Zed Mogaka",
        "category": "Entertainment",
        "source_url": "https://www.ghafla.co.ke/",
        "source_domain": "ghafla.co.ke",
        "memory_file": ".github/memory_georgediano.json",
        "role": "entertainment desk writer covering George Diano and related Kenyan showbiz",
        "audience": "Kenyan entertainment readers following George Diano and the local scene",
        "path_hints": ["article", "news", "story", "post", "/20", "celebrity"],
    })
