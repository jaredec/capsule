"""Daily trend fetcher.

Asks Claude (with web search) for today's biggest viral moment on a given
platform, parses the JSON response, and upserts it into Supabase.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone

import anthropic
from supabase import create_client

MODEL = "claude-sonnet-4-6"
PLATFORM = os.environ.get("PLATFORM", "x")

PROMPT_TEMPLATE = """Find the single biggest viral moment on {platform_name} today ({date}).

What counts as a "viral moment":
- A specific post, video, tweet, meme, or cultural moment that lots of people
  are reacting to, sharing, or talking about.
- Internet culture, fandoms, sports moments, memes, drama, weird viral clips —
  all fair game.

What does NOT count:
- Straight news headlines (elections, policy, wars, deaths) UNLESS the moment
  itself became a viral piece of content (e.g., a memeable clip, a reaction
  that took over the platform).
- Generic topics or hashtags without a specific moment behind them.

Use the web_search tool to figure out what is actually trending right now.
Then return ONLY a JSON object (no prose, no markdown) with this shape:

{{
  "title": "short headline, ~10 words max",
  "description": "2-4 sentences explaining what the moment is and why it went viral",
  "link": "URL to the original post or a strong source, or null",
  "image_url": "URL to a representative image/screenshot, or null"
}}

If you genuinely can't find one clear viral moment for today, return:
{{"title": null, "description": null, "link": null, "image_url": null}}
"""

PLATFORM_NAMES = {"x": "X (Twitter)"}


def extract_json(text: str) -> dict:
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
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


def main() -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    print(f"[{today}] fetching trend for platform={PLATFORM}")

    payload = fetch_trend(PLATFORM, today)
    if not payload.get("title"):
        print("No viral moment identified for today; skipping insert.")
        return 0

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    row = {
        "date": today,
        "platform": PLATFORM,
        "title": payload["title"],
        "description": payload.get("description") or "",
        "link": payload.get("link"),
        "image_url": payload.get("image_url"),
    }
    res = supabase.table("trends").upsert(row, on_conflict="date,platform").execute()
    print(f"upserted: {res.data}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
