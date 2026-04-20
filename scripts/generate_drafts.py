"""
Batch draft LinkedIn posts from a topics file.

Reads `content/topics.md` where each non-empty, non-comment line is a topic.
Calls Claude to draft a post per topic. Appends drafts to `content/queue.json`
with `status: "draft"`.

You then open queue.json in your editor, read the drafts, tweak them, and
change each item's status from "draft" to "ready". Only "ready" items get
posted by the daily job.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python scripts/generate_drafts.py
    python scripts/generate_drafts.py --style voice.md   # optional voice guide
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
TOPICS_FILE = ROOT / "content" / "topics.md"
QUEUE_FILE = ROOT / "content" / "queue.json"

DEFAULT_VOICE = """\
Write in British English. Direct, clear, conversational tone.
Short paragraphs. Plain language. No fluff, no hype.
Sound like a smart colleague, not a corporate brochure.
No emojis unless the topic really calls for one. Max one.
No em dashes. Avoid overblown words like "crucial", "vital",
"unlock", "unleash", "dive", "delve", "journey", "navigate".
"""

SYSTEM_PROMPT = """\
You are drafting a single LinkedIn post. Rules:
- 700-1200 characters (LinkedIn shows ~210 chars before "see more" - hook hard).
- Open with a sharp hook. Earn the click to "see more".
- One idea per post. No listicles unless the topic is naturally a list.
- Line breaks between beats. Do not use markdown headers.
- No hashtags unless I tell you otherwise. If including, max 3, at the end.
- Do not write the post title or any preamble. Output ONLY the post body.
"""


def load_topics() -> list[str]:
    if not TOPICS_FILE.exists():
        print(f"ERROR: {TOPICS_FILE} not found.")
        sys.exit(1)
    lines = TOPICS_FILE.read_text().splitlines()
    return [l.strip() for l in lines if l.strip() and not l.strip().startswith("#")]


def load_queue() -> list[dict]:
    if not QUEUE_FILE.exists():
        return []
    return json.loads(QUEUE_FILE.read_text() or "[]")


def save_queue(queue: list[dict]) -> None:
    QUEUE_FILE.write_text(json.dumps(queue, indent=2, ensure_ascii=False) + "\n")


def draft_post(topic: str, voice: str, api_key: str) -> str:
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT + "\n\nVOICE GUIDE:\n" + voice,
            "messages": [
                {"role": "user", "content": f"Draft a LinkedIn post on: {topic}"}
            ],
        },
        timeout=60,
    )
    resp.raise_for_status()
    body = resp.json()
    text_blocks = [b["text"] for b in body["content"] if b["type"] == "text"]
    return "\n".join(text_blocks).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--style", help="Path to a markdown file describing your voice.")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: set ANTHROPIC_API_KEY env var.")
        sys.exit(1)

    voice = DEFAULT_VOICE
    if args.style:
        voice = Path(args.style).read_text()

    topics = load_topics()
    if not topics:
        print("No topics found in content/topics.md. Add some and re-run.")
        sys.exit(0)

    queue = load_queue()
    existing_topics = {item.get("topic") for item in queue}
    new_topics = [t for t in topics if t not in existing_topics]

    if not new_topics:
        print("All topics already drafted. Nothing to do.")
        return

    print(f"Drafting {len(new_topics)} post(s)...")
    for i, topic in enumerate(new_topics, 1):
        print(f"  [{i}/{len(new_topics)}] {topic[:60]}")
        text = draft_post(topic, voice, api_key)
        queue.append({
            "id": str(uuid.uuid4())[:8],
            "topic": topic,
            "text": text,
            "status": "draft",  # change to "ready" once you've reviewed
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })

    save_queue(queue)
    print(f"\nDone. {len(new_topics)} drafts added to {QUEUE_FILE.relative_to(ROOT)}.")
    print("Open it, edit the text as you like, then change status to \"ready\"")
    print("for each post you want published.")


if __name__ == "__main__":
    main()
