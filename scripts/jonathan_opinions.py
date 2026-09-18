import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from writer_core import run_writer

OPINION_STYLES = [
    {"name": "Argument", "format": "Opinion argument", "lead_style": "State the claim in the first line", "tone": "Firm, fair, sharp", "angle": "Why this matters to Kenya now", "structure": "Claim, three supports, counterpoint, close", "sentence_mix": "Short punches with one longer paragraph", "closing": "A clear call or question"},
    {"name": "Field Note", "format": "Grounded observation", "lead_style": "Open with a concrete Kenyan scene", "tone": "Observant, measured", "angle": "What the ground says vs the noise", "structure": "Scene, context, stakes, takeaway", "sentence_mix": "Medium, concrete", "closing": "Quiet but firm closer"},
    {"name": "Accountability", "format": "Accountability piece", "lead_style": "Name the decision and who owns it", "tone": "Direct, civic", "angle": "Who benefits and who pays", "structure": "Decision, evidence, impact, demand", "sentence_mix": "Short and medium", "closing": "Accountability question"},
    {"name": "Contrast", "format": "Compare and contrast", "lead_style": "Two paths Kenya could take", "tone": "Analytical", "angle": "Trade-offs without hedging", "structure": "Fork, path A, path B, verdict", "sentence_mix": "Medium", "closing": "Choose a side cleanly"},
]

if __name__ == "__main__":
    run_writer({
        "author_name": "Jonathan Mwaniki",
        "category": "Opinions",
        "source_url": "https://www.kenyans.co.ke/",
        "source_domain": "kenyans.co.ke",
        "memory_file": ".github/memory_jonathan.json",
        "role": "opinion columnist",
        "audience": "Kenyan readers who follow public debate",
        "styles": OPINION_STYLES,
        "path_hints": ["blogs-opinion", "opinion", "article", "/20"],
        "opinion_mode": True,
    })
