import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Jaj",
        "category": "Opinions",
        "source_url": "https://www.udanews.co.ke/",
        "source_domain": "udanews.co.ke",
        "memory_file": ".github/memory_jaj.json",
        "role": "opinion columnist",
        "audience": "Kenyan readers following public debate and civic life",
        "path_hints": ["opinion", "blogs-opinion", "opinions", "/20"],
        "opinion_mode": True,
    })
