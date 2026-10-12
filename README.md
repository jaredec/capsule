# capsule

An archive of the internet's daily pulse. Capsule is a calendar where every day holds what controlled the feed that day: the meme, clip or moment a normal person would have seen reposted or heard about. Filter by platform: X, TikTok, Instagram, Reddit, YouTube.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

The home page shows the latest archived month. Click a day for details, or go to `/day/YYYY-MM-DD`. Month pages live at `/YYYY/MM`, and `?platform=x` filters any calendar view.

## Layout

```
data/days/<date>.json      the published picks, one file per UTC day
data/signals/<date>.json   raw daily signals the picks were made from
data/picks/<date>.json     editor picks (input to `npm run curate`)
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

`pulse = 0.4·reach + 0.35·dominance + 0.25·memeability`. Sports, tech, politics and news are multiplied by 0.55, or by 0.9 when they crossed over into general meme culture. The rule lives in `scoreStory()` in `scripts/lib/pick.ts`, and the editorial prompt sits next to it.

## The automated pipeline (cheap by design)

`npm run collect` doesn't pay for X API reads. Steps 1 and 3 below are free; only step 2 costs money.

1. **Gather (free).** Google News RSS searches for "went viral", memes, "the internet reacts" and similar, limited to the target day and the day after. Junk like meme-coin prices and evergreen listicles is filtered out. It also pulls the most-read Wikipedia pages and flags *breakouts*: pages that weren't in the top 1000 on the prior three days, a good "normies looked this up" signal. For recent days it adds Google's trending searches. Everything is saved to `data/signals/`. All of these sources take a date, which is what makes backfills cheap.
2. **Pick (one cheap LLM call).** About 12k tokens of headlines go to a small model, which clusters them into stories and scores them with the rubric. It can only cite headline IDs from the snapshot, so references can't be invented.
3. **Enrich (free).** Resolves the real article URLs, pulls the X, TikTok and Instagram posts embedded in those articles, and reads likes and replies from X's public embed endpoint. The featured post is the most-liked one from that day.

Cost per day is one call of roughly 12k input and 1k output tokens:

| Model | Approx. per day | Full-year backfill |
| --- | --- | --- |
| `gemini-3.5-flash-lite` (default if `GEMINI_API_KEY` is set) | free tier, or ~$0.006 paid | ~$2 |
| `grok-4.3` (`XAI_API_KEY`) | ~$0.018 | ~$7 |

```bash
cp .env.example .env.local      # add one key
set -a; . ./.env.local; set +a

npm run collect                                         # the last two complete days (UTC)
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

Write `data/picks/<date>.json` with your stories (same fields the model returns, citing headline IDs from that day's signals), then run `npm run curate -- data/picks/<date>.json`. Curated days (`collectedBy` other than `pulse:*`) are never overwritten by the collector.

### GitHub Actions

Add one model key as a repository secret (`GEMINI_API_KEY`, `XAI_API_KEY` or `OPENAI_API_KEY`). You can optionally set `LLM_PROVIDER` and `LLM_MODEL` as repository variables.

- **Collect daily pulse** runs at 06:17 and 18:17 UTC and re-settles the last two complete days, because coverage trails the moment.
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
      "pulse": { "score": 8.4, "reach": 9, "dominance": 8, "memeability": 8, "category": "brands", "crossover": false },
      "collectedBy": "pulse:gemini-3.5-flash-lite",
      "collectedAt": "2026-10-08T06:17:00Z"
    }
  ]
}
```

The schema lives in `src/lib/schema.ts` and is enforced by `npm run validate-data`.
