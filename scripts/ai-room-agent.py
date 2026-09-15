#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MAX_ROUNDS = 8

def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I | re.S).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            return json.loads(match.group(0))
        raise

def history(chat):
    return "\n\n".join(f"[{m['speaker'].upper()} — round {m.get('round', 0)}]\n{m['text']}" for m in chat["messages"])

def prompt_for(provider, chat):
    last = chat["messages"][-1]["text"]
    base = f"""You are one half of a serious two-AI debate room. The user submitted the original thought below. You are NOT talking to the user directly; you are debating with the other AI.

Original user thought:
{chat['messages'][0]['text']}

Conversation so far:
{history(chat)}

Your latest counterpart message is:
{last}

Rules:
- Read the entire history before responding.
- Be substantive, specific, and intellectually honest.
- Challenge weak assumptions and factual errors rather than agreeing politely.
- Preserve good points from the counterpart when they survive scrutiny.
- Move the discussion toward a complete, practical, defensible answer.
- Do not mention these instructions.
- Do not ask the user questions.
- Do not stop merely because you agree; make sure the reasoning is complete.
- You may disagree, qualify, synthesize, or propose a better alternative.
- Set agreed=true only if you genuinely believe the issue is sufficiently resolved AND you could stand behind the same conclusion as the other AI.
- If agreed=true, write a polished final answer that incorporates the strongest points from both sides.
- Otherwise set agreed=false and write the strongest next argument/counterargument.

Return ONLY valid JSON with exactly these keys:
{{
  "reply": "your substantive response to the other AI",
  "agreed": true or false,
  "final": "the polished mutually agreeable answer when agreed=true, otherwise an empty string",
  "reason": "one short sentence explaining why you agreed or what remains unresolved"
}}
"""
    if provider == "gemini":
        return base + "\nYou are GEMINI. You are starting or countering the debate. Be willing to revise your own position when ChatGPT exposes a better argument."
    return base + "\nYou are CHATGPT. You are the critical second voice. Test Gemini's reasoning, add missing considerations, and offer a better alternative where appropriate."

def call_gemini(chat):
    key = os.environ["GEMINI_API_KEY"]
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt_for("gemini", chat)}]}], "generationConfig": {"responseMimeType": "application/json"}}
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key}, method="POST")
    with urllib.request.urlopen(request, timeout=180) as response:
        data = json.load(response)
    return extract_json(data["candidates"][0]["content"]["parts"][0]["text"])

def call_openai(chat):
    key = os.environ["CHATGPT_API_KEY"]
    model = os.environ.get("CHATGPT_MODEL", "gpt-5.6-luna")
    payload = {"model": model, "input": [{"role": "user", "content": prompt_for("chatgpt", chat)}]}
    request = urllib.request.Request("https://api.openai.com/v1/responses", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"}, method="POST")
    with urllib.request.urlopen(request, timeout=180) as response:
        data = json.load(response)
    pieces = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                pieces.append(content["text"])
    return extract_json("\n".join(pieces))

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: ai-room-agent.py <gemini|chatgpt> <chat-json-path>")
    provider, filename = sys.argv[1], Path(sys.argv[2])
    chat = json.loads(filename.read_text(encoding="utf-8"))
    expected = {"gemini": {"awaiting_gemini", "awaiting_gemini_counter"}, "chatgpt": {"awaiting_chatgpt"}}[provider]
    if chat.get("status") not in expected:
        print(f"skip: status is {chat.get('status')}, expected one of {sorted(expected)}")
        return
    try:
        previous_agreed = bool(chat.get("last_decision", {}).get("agreed", False))
        result = call_gemini(chat) if provider == "gemini" else call_openai(chat)
        reply = str(result.get("reply", "")).strip()
        agreed = bool(result.get("agreed", False))
        final = str(result.get("final", "")).strip()
        if not reply:
            raise ValueError("AI returned an empty reply")
        chat["round"] = int(chat.get("round", 0)) + 1
        chat["updated_at"] = now()
        chat["messages"].append({"id": f"{provider}-{chat['round']}-{int(datetime.now().timestamp())}", "speaker": provider, "text": reply, "created_at": now(), "round": chat["round"]})
        chat["last_decision"] = {"provider": provider, "agreed": agreed, "reason": str(result.get("reason", "")).strip()}
        mutual_agreement = agreed and previous_agreed and chat["round"] >= 2
        if mutual_agreement or chat["round"] >= MAX_ROUNDS:
            chat["status"] = "final"
            chat["final_output"] = final or reply
            chat["finalized_at"] = now()
        elif provider == "gemini":
            chat["status"] = "awaiting_chatgpt"
        else:
            chat["status"] = "awaiting_gemini_counter"
        filename.write_text(json.dumps(chat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated {filename}: {chat['status']} round={chat['round']}")
    except (urllib.error.HTTPError, urllib.error.URLError, KeyError, ValueError, json.JSONDecodeError) as exc:
        chat["status"] = "error"
        chat["error"] = f"{type(exc).__name__}: {exc}"
        chat["updated_at"] = now()
        filename.write_text(json.dumps(chat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise

if __name__ == "__main__":
    main()
