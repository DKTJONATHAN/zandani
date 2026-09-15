# AI Debate Room storage

Each conversation is one JSON file under this directory.

A new user submission starts with `status: "awaiting_gemini"`. GitHub Actions then advances the same file through:

`awaiting_gemini` → `awaiting_chatgpt` → `awaiting_gemini_counter` → … → `final`

The UI never enables a new submission while the latest conversation is active. Gemini always receives the first AI turn.

The JSON file contains the original user thought, every AI turn, the current status, round number, and the final agreed output.
