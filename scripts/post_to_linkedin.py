"""
Post the next "ready" item from content/queue.json to LinkedIn,
with a rotating image from images/.

Designed to be run by GitHub Actions once a day. Safe to run manually too.

Env vars:
    LINKEDIN_ACCESS_TOKEN   (required)
    LINKEDIN_AUTHOR_URN     (required, e.g. urn:li:person:abc123)
    LINKEDIN_CLIENT_ID      (optional, used only if refreshing the token)
    LINKEDIN_CLIENT_SECRET  (optional, used only if refreshing the token)
    LINKEDIN_REFRESH_TOKEN  (optional, used only if refreshing the token)
    DRY_RUN=1               (optional, skips actual posting)
"""

import json
import mimetypes
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
QUEUE_FILE = ROOT / "content" / "queue.json"
POSTED_FILE = ROOT / "content" / "posted.json"
STATE_FILE = ROOT / "content" / "state.json"
IMAGES_DIR = ROOT / "images"

ACCESS_TOKEN = os.environ.get("LINKEDIN_ACCESS_TOKEN")
AUTHOR_URN = os.environ.get("LINKEDIN_AUTHOR_URN")
DRY_RUN = os.environ.get("DRY_RUN") == "1"


def load_json(path: Path, default):
    if not path.exists():
        return default
    txt = path.read_text().strip()
    if not txt:
        return default
    return json.loads(txt)


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def pick_next_image() -> Path | None:
    """Round-robin through images/ based on last index stored in state.json."""
    exts = {".jpg", ".jpeg", ".png", ".gif"}
    images = sorted(p for p in IMAGES_DIR.iterdir() if p.suffix.lower() in exts)
    if not images:
        return None
    state = load_json(STATE_FILE, {"image_index": -1})
    next_idx = (state.get("image_index", -1) + 1) % len(images)
    state["image_index"] = next_idx
    save_json(STATE_FILE, state)
    return images[next_idx]


def register_image_upload() -> tuple[str, str]:
    """Ask LinkedIn for an upload URL. Returns (upload_url, asset_urn)."""
    resp = requests.post(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        json={
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                "owner": AUTHOR_URN,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent",
                    }
                ],
            }
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()["value"]
    upload_url = data["uploadMechanism"][
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]["uploadUrl"]
    asset = data["asset"]
    return upload_url, asset


def upload_image_bytes(upload_url: str, image_path: Path) -> None:
    mime = mimetypes.guess_type(image_path.name)[0] or "image/png"
    with image_path.open("rb") as f:
        resp = requests.put(
            upload_url,
            headers={
                "Authorization": f"Bearer {ACCESS_TOKEN}",
                "Content-Type": mime,
            },
            data=f.read(),
            timeout=60,
        )
    resp.raise_for_status()


def create_ugc_post(text: str, asset_urn: str | None) -> str:
    """Create the actual LinkedIn post. Returns the post URN."""
    payload = {
        "author": AUTHOR_URN,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    if asset_urn:
        share = payload["specificContent"]["com.linkedin.ugc.ShareContent"]
        share["shareMediaCategory"] = "IMAGE"
        share["media"] = [
            {
                "status": "READY",
                "media": asset_urn,
                "description": {"text": ""},
                "title": {"text": ""},
            }
        ]

    resp = requests.post(
        "https://api.linkedin.com/v2/ugcPosts",
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    # Post URN is returned either in `id` or the `x-restli-id` header
    return resp.json().get("id") or resp.headers.get("x-restli-id", "")


def main():
    if not ACCESS_TOKEN or not AUTHOR_URN:
        print("ERROR: LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN must be set.")
        sys.exit(1)

    queue = load_json(QUEUE_FILE, [])
    ready = [p for p in queue if p.get("status") == "ready"]

    if not ready:
        print("No 'ready' posts in queue. Nothing to do.")
        sys.exit(0)

    post = ready[0]
    print(f"Posting: {post['topic'][:80]}")

    image_path = pick_next_image()
    if image_path:
        print(f"Attaching image: {image_path.name}")

    if DRY_RUN:
        print("--- DRY RUN ---")
        print(post["text"])
        print("---")
        return

    asset_urn = None
    if image_path:
        upload_url, asset_urn = register_image_upload()
        upload_image_bytes(upload_url, image_path)

    post_urn = create_ugc_post(post["text"], asset_urn)
    print(f"Posted: {post_urn}")

    # Move from queue to posted
    queue = [p for p in queue if p["id"] != post["id"]]
    save_json(QUEUE_FILE, queue)

    posted = load_json(POSTED_FILE, [])
    posted.append({
        **post,
        "status": "posted",
        "posted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "post_urn": post_urn,
        "image": image_path.name if image_path else None,
    })
    save_json(POSTED_FILE, posted)
    print("Queue updated.")


if __name__ == "__main__":
    main()
