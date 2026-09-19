import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

if __name__ == "__main__":
    run_writer({
        "author_name": "Mutheu Ann",
        "category": "Entertainment",
        "source_url": "https://www.pulse.co.ke/entertainment",
        "source_domain": "pulse.co.ke",
        "memory_file": ".github/memory_mutheu.json",
        "role": "entertainment correspondent",
        "audience": "Kenyan entertainment, music, film and celebrity readers",
        "path_hints": ["/story/"],
    })
