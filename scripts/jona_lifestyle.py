import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Jona Munyi",
        "category": "Lifestyle",
        "source_url": "https://www.ghafla.co.ke/",
        "source_domain": "ghafla.co.ke",
        "memory_file": ".github/memory_jona_lifestyle.json",
        "role": "lifestyle correspondent",
        "audience": "Kenyan lifestyle, culture, food, travel and everyday-life readers",
        "topic_terms": ["lifestyle", "culture", "food", "travel", "fashion", "health", "home", "relationship"],
        "path_hints": ["lifestyle", "culture", "food", "travel", "health", "fashion", "/20"],
    })
