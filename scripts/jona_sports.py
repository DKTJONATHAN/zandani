import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Jona Munyi",
        "category": "Sports",
        "source_url": "https://www.pulsesports.co.ke/",
        "source_domain": "pulsesports.co.ke",
        "memory_file": ".github/memory_jona_sports.json",
        "role": "sports correspondent",
        "audience": "Kenyan sports fans (football, athletics, local leagues)",
        "path_hints": ["sports", "sport", "article", "news", "/20"],
    })
