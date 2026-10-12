# capsule

An archive of the internet's daily pulse. Capsule is a calendar where every day holds what controlled the feed that day: the meme, clip or moment a normal person would have seen reposted or heard about. For now every pick is an X post; the platform dropdown is ready for TikTok, Instagram, Reddit and YouTube.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Days run midnight to midnight US Pacific time. The home page shows the latest archived month, with each day's pick shown as an image filling its cell, cropped to the part that matters; the author and title appear on hover. Click a day for details, or go to `/day/YYYY-MM-DD`. Month pages live at `/YYYY/MM`, and `?platform=x` filters any calendar view.

## Layout

```
data/days/<date>.json      the published picks, one file per Pacific day
data/signals/<date>.json   raw daily signals the picks were made from
data/picks/<date>.json     editor picks (input to `npm run curate`)
public/media/<date>/       self-hosted WebP image for each pick
scripts/collect.ts         automated pipeline: gather -> pick -> enrich -> write
scripts/curate.ts          editor override: you pick, the pipeline enriches
src/                       Next.js app; every page is prerendered from data/days
.github/workflows/         twice-daily collection, manual backfill, CI
```

New data lands as a git commit, and the host (Vercel, Netlify, etc.) redeploys on push.

## What counts as "the pulse"

Every candidate gets three 1–10 scores:

| Score | Question |
| --- | --- |
| reach | Did it escape its niche and reach normies? 10 = your aunt saw it. |
| dominance | How hard did it take over feeds: reposts, quote-posts, duets, outlets covering the reaction itself? |
| memeability | Did it spawn remixes, templates, catchphrases, reaction images? |

`pulse = 0.4·reach + 0.35·dominance + 0.25·memeability`. Sports, tech, politics and news are multiplied by 0.55, or by 0.9 when they crossed over into general meme culture. Celebrities count when they became the joke or did something non-fans reposted for the laugh, not for fan-account fare like red carpets, lip-syncs or thirst clips. The rule lives in `scoreStory()` in `scripts/lib/pick.ts`, and the editorial prompt sits next to it.

## The automated pipeline (cheap by design)

`npm run collect` doesn't pay for X API reads. Only step 2 below costs money; the rest is free.

1. **Gather (free).** Google News RSS searches for "went viral", memes, "the internet reacts" and similar, limited to the target day and the day after. Junk like meme-coin prices and evergreen listicles is filtered out. It also pulls the most-read Wikipedia pages and flags *breakouts*: pages that weren't in the top 1000 on the prior three days, a good "normies looked this up" signal. For recent days it adds Google's trending searches. Everything is saved to `data/signals/`. All of these sources take a date, which is what makes backfills cheap.
2. **Pick (one cheap LLM call).** About 12k tokens of headlines go to a small model, which clusters them into stories and scores them with the rubric. It can only cite headline IDs from the snapshot, so references can't be invented.
3. **Enrich (free).** Resolves the real article URLs, pulls the X posts embedded in those articles, and reads likes and replies from X's public embed endpoint. The featured post is the most-liked one from that day in English, then posts with no text, and posts in other languages only when nothing else is there, unless the editor pinned one.
4. **Media (free).** Each pick gets a still: the X post's photo, else a frame from its video, else a YouTube thumbnail (`maxresdefault` when the upload is HD) or the coverage's og:image (generic logos are skipped). For videos, ffmpeg samples 12 frames across the clip, drops blurred and blank ones, and asks the model (if a key is set) which frame shows the moment; without a key it takes the frame most like the rest, which skips title cards and cutaways. Stills are resized to a 720px WebP with sharp under `public/media/`. The image records a `crop` region (fractions of the image) that the calendar fills its 3:4 cells, square mobile thumbnails and 16:9 fallbacks with; by default it's the 3:4 window around the spot sharp's attention strategy finds most eye-catching. It also stores a snapshot of the post (name, handle, verified, avatar, text) so the calendar renders without X's embed script, and nothing breaks when X rotates CDN URLs. `npm run media -- 2026-10-05` (or no dates for all days, `--redo` to replace images) backfills existing days.

Cost per day is one call of roughly 12k input and 1k output tokens:

| Model | Approx. per day | Full-year backfill |
| --- | --- | --- |
| `gemini-3.5-flash-lite` (default if `GEMINI_API_KEY` is set) | free tier, or ~$0.006 paid | ~$2 |
| `grok-4.3` (`XAI_API_KEY`) | ~$0.018 | ~$7 |

```bash
cp .env.example .env.local      # add one key
set -a; . ./.env.local; set +a

npm run collect                                         # the last two complete days (Pacific)
npm run collect -- --date 2026-10-05
npm run collect -- --from 2026-01-01 --to 2026-09-30    # backfill; skips days already done
npm run collect -- --date 2026-10-05 --gather-only      # signals only, no key needed
```

Options:

- `--count` sets how many items to keep per day (default 3).
- `--refresh` redoes days that already have automated picks.
- `--force` also replaces curated days.
- `--regather` refetches signals even if a snapshot exists.
- `--dry-run` prints results without writing.

Any OpenAI-compatible endpoint works. Set `LLM_PROVIDER=gemini|xai|openai`, or `LLM_BASE_URL` with `LLM_MODEL` and `LLM_API_KEY`.

### Editor overrides

Write `data/picks/<date>.json` with your stories (same fields the model returns, citing headline IDs from that day's signals), then run `npm run curate -- data/picks/<date>.json`. A story can also set `sourceUrl` to pin the X post to feature, `imageUrl` to use a better still than the post's media (a photo instead of a screenshot of text, say), `frameAt` (seconds) to pick the exact video frame, and `crop` (`{ "x", "y", "w", "h" }` as fractions of the image) to choose what the calendar shows. `npm run media` also applies these, replacing the image when `imageUrl` or `frameAt` changes. Curated days (those with a picks file or items whose `collectedBy` isn't `pulse:*`) are never overwritten by the collector. A picks file with no stories marks a day where nothing broke through, so the collector leaves it empty.

### GitHub Actions

Add one model key as a repository secret (`GEMINI_API_KEY`, `XAI_API_KEY` or `OPENAI_API_KEY`). You can optionally set `LLM_PROVIDER` and `LLM_MODEL` as repository variables.

- **Collect daily pulse** runs at 09:17 and 21:17 UTC (just after Pacific midnight, and mid-afternoon PT) and re-settles the last two complete days, because coverage trails the moment.
- **Backfill pulse** is manual and takes a `from`/`to` range.
- **CI** validates data, then lints, typechecks and builds.

## Data format

```jsonc
{
  "date": "2026-10-07",
  "items": [
    {
      "id": "2026-10-07-x-short-slug",
      "platform": "x",              // x | tiktok | instagram | reddit | youtube
      "rank": 1,
      "title": "Short punchy title",
      "summary": "What happened and why it blew up.",
      "kind": "image",              // video | image | phrase | audio | moment
      "tags": ["amazon"],
      "author": "@handle",
      "sourceUrl": "https://x.com/handle/status/123",   // embedded on the site
      "metrics": { "likes": "72K", "replies": "377" },
      "references": [{ "title": "Article", "url": "https://..." }],
      "image": { "src": "/media/2026-10-07/2026-10-07-x-short-slug.webp", "width": 720, "height": 900, "from": "https://pbs.twimg.com/...", "crop": { "x": 0.2, "y": 0, "w": 0.6, "h": 1 } },
      "post": { "name": "Display Name", "handle": "@handle", "verified": true, "avatar": "/media/avatars/handle.webp", "text": "The post text" },
      "pulse": { "score": 8.4, "reach": 9, "dominance": 8, "memeability": 8, "category": "brands", "crossover": false },
      "collectedBy": "pulse:gemini-3.5-flash-lite",
      "collectedAt": "2026-10-08T06:17:00Z"
    }
  ]
}
```

The schema lives in `src/lib/schema.ts` and is enforced by `npm run validate-data`.
