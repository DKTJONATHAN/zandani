import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Elizabeth Muthoni",
        "category": "Technology",
        "source_url": "https://techweez.com/",
        "source_domain": "techweez.com",
        "memory_file": ".github/memory_elizabeth.json",
        "role": "technology correspondent",
        "audience": "Kenyan tech, startups, digital products and internet readers",
        "path_hints": ["/20", "tech", "how-to", "news", "features", "editorial", "reviews"],
    })
