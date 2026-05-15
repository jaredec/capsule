"""Daily trend fetcher.

Asks Claude (with web search) for today's biggest viral moment on a given
platform, then writes the result into frontend/data/trends.json.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

MODEL = "claude-sonnet-4-6"
PLATFORM = os.environ.get("PLATFORM", "x")

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = REPO_ROOT / "frontend" / "data" / "trends.json"

PROMPT_TEMPLATE = """Find the single biggest viral moment on {platform_name} on {date}, scoped to the US audience.

Scope: US-anchored virality only.
- The moment should have dominated American X timelines that day.
- Reject moments that were big only regionally outside the US (e.g., huge in India,
  Korea, Brazil but barely a ripple in the US). If unsure, prefer something with
  English-language coverage in mainstream US outlets.

What counts as a "viral moment":
- A specific post, video, tweet, meme, or cultural moment lots of Americans
  reacted to, shared, or talked about.
- Internet culture, fandoms, sports moments, memes, drama, viral clips —
  all fair game.

What does NOT count:
- Straight news headlines (elections, policy, wars, deaths) UNLESS the moment
  itself became a viral piece of content (e.g., a memeable clip, a reaction
  that took over the platform).
- Generic topics or hashtags without a specific moment behind them.
- Fake/parody-account claims that didn't actually pan out (e.g., a hoax
  "announcement" from a Pop Crave clone). If the post is fake or a known
  misinformation account, skip it.

Use the web_search tool to figure out what is actually trending. Prefer
sources like Know Your Meme, US-based pop culture sites, and US news outlets
covering an X moment over generic SEO-bait listicles.

Then return ONLY a JSON object (no prose, no markdown) with this shape:

{{
  "title": "short headline, ~10 words max",
  "description": "2-4 sentences explaining what the moment is and why it went viral",
  "link": "URL to the original post or a strong source, or null",
  "image_url": "URL to a representative image/screenshot, or null"
}}

If you genuinely can't find one clear US viral moment for today, return:
{{"title": null, "description": null, "link": null, "image_url": null}}
"""

PLATFORM_NAMES = {"x": "X (Twitter)"}


def extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text.strip(), re.DOTALL)
    if not m:
        raise ValueError(f"No JSON found in response: {text[:500]}")
    return json.loads(m.group(0))


def fetch_trend(platform: str, date: str) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    prompt = PROMPT_TEMPLATE.format(
        platform_name=PLATFORM_NAMES.get(platform, platform),
        date=date,
    )
    resp = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
        messages=[{"role": "user", "content": prompt}],
    )
    text_blocks = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
    if not text_blocks:
        raise RuntimeError("No text blocks in response")
    return extract_json(text_blocks[-1])


def load_trends() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def save_trends(trends: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(trends, indent=2) + "\n")


def main() -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    print(f"[{today}] fetching trend for platform={PLATFORM}")

    payload = fetch_trend(PLATFORM, today)
    if not payload.get("title"):
        print("No viral moment identified for today; skipping.")
        return 0

    trends = load_trends()
    trends = [t for t in trends if not (t["date"] == today and t["platform"] == PLATFORM)]
    trends.append({
        "date": today,
        "platform": PLATFORM,
        "title": payload["title"],
        "description": payload.get("description") or "",
        "link": payload.get("link"),
        "image_url": payload.get("image_url"),
    })
    trends.sort(key=lambda t: (t["date"], t["platform"]), reverse=True)
    save_trends(trends)
    print(f"wrote {len(trends)} trends to {DATA_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
