import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Amara Ndlovu",
        "category": "Africa",
        "source_url": "https://eacpost.com/",
        "source_domain": "eacpost.com",
        "memory_file": ".github/memory_amara.json",
        "role": "East Africa correspondent",
        "audience": "Kenyan and East African readers following regional news",
        "topic_terms": ["africa", "east africa", "tanzania", "uganda", "rwanda", "somalia", "ethiopia", "burundi", "south africa"],
        "path_hints": ["east-africa", "tanzania", "uganda", "rwanda", "africa", "/20"],
    })
