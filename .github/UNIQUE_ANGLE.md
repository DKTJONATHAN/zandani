# Za Ndani unique-angle rule

Do not file a story whose first 80 words could run on Nation, Standard, Citizen or Tuko with a logo swap.

The live Gemini instruction lives in `scripts/voice_guard.py` (`news_prompt`).
Gemini must return analysis JSON, then a gap-filled article. Empty gap = skip.

## Before writing
1. Search the exact event on those four desks.
2. They all said X.
3. We will say Y. Y is not X reordered.
4. If you cannot write Y, skip.

## Allowed Y
- What it costs a reader in Nairobi this week
- What the gazette, circular, fixture list or contract actually changes
- The official sentence that does not match the last one
- The question the presser did not take
- Second-day consequence, not day-one facts
