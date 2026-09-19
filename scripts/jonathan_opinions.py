import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Jonathan Mwaniki",
        "category": "Opinions",
        "source_url": "https://www.theelephant.info/opinion/",
        "source_domain": "theelephant.info",
        "memory_file": ".github/memory_jonathan.json",
        "role": "opinion columnist",
        "audience": "Kenyan readers who follow public debate",
        "path_hints": ["opinion", "blogs-opinion", "opinions", "/20"],
        "opinion_mode": True,
    })
