import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Amara Ndlovu",
        "category": "Africa",
        "source_url": "https://www.pulse.co.ke/news",
        "source_domain": "pulse.co.ke",
        "memory_file": ".github/memory_amara.json",
        "role": "East Africa correspondent",
        "audience": "Kenyan and East African readers following regional news",
        "path_hints": ["article", "news", "story", "post", "/20", "east-africa", "tanzania", "uganda", "rwanda"],
    })
