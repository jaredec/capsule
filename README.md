# capsule

A daily archive of what the internet was laughing at. Capsule shows a calendar where every day holds that day's top meme or viral moment, filterable by platform (X first; TikTok, Instagram, Reddit and YouTube are supported).

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

The home page shows the latest archived month. Click a day to open its details, or visit `/day/YYYY-MM-DD` directly. Month pages live at `/YYYY/MM`, and `?platform=x` filters any calendar view.

## How it works

```
data/days/2026-10-05.json   one file per UTC day, committed to the repo
scripts/collect.ts          asks Grok for the day's top memes and writes those files
src/                        Next.js app that renders the files as a static calendar
.github/workflows/          cron collection, manual backfill, CI
```

The site is fully static: every page is prerendered from `data/days`. New data lands as a git commit, and the host (Vercel, Netlify, etc.) redeploys on push.

### Day file format

```jsonc
{
  "date": "2026-10-05",
  "items": [
    {
      "id": "2026-10-05-x-short-slug",
      "platform": "x",              // x | tiktok | instagram | reddit | youtube
      "rank": 1,                    // 1 = the day's headline pick
      "title": "Short punchy title",
      "summary": "What it is and why it blew up.",
      "kind": "video",              // video | image | phrase | audio | moment
      "tags": ["sports"],
      "author": "@handle",          // optional
      "sourceUrl": "https://x.com/handle/status/123",  // optional; embedded on the site when set
      "metrics": { "views": "12M" },  // optional
      "references": [{ "title": "Article", "url": "https://..." }],
      "collectedBy": "grok-x-search",
      "collectedAt": "2026-10-06T00:17:00Z"
    }
  ]
}
```

The schema lives in `src/lib/schema.ts` and is enforced by `npm run validate-data`, which CI runs on every push.

## Automated collection (Grok)

`npm run collect` calls the xAI Responses API with the `x_search` tool, limited to posts from a single UTC day. It asks Grok for the top three meme-worthy moments and requests strict JSON output. To keep made-up links out of the archive:

- every post URL must match the platform's post URL format,
- it is checked against X's public oEmbed endpoint (a 404 drops the link), and, failing that, must appear in Grok's search citations,
- items with neither a verified post nor a supporting article are discarded.

```bash
cp .env.example .env.local   # add XAI_API_KEY
export $(cat .env.local | xargs)

npm run collect                                         # yesterday + today (UTC)
npm run collect -- --date 2026-10-05                    # one day
npm run collect -- --from 2026-01-01 --to 2026-09-30    # backfill; skips days already captured
npm run collect -- --date yesterday --platform x,tiktok --dry-run
```

Options: `--platform` (comma-separated), `--count` (items per platform, default 3), `--refresh` (redo days that already have automated items), `--force` (also overwrite hand-curated items), `--dry-run`.

Merge rules: automation only replaces items for the platform it's collecting. It never overwrites hand-curated entries (anything whose `collectedBy` doesn't start with `grok`) unless you pass `--force`.

Non-X platforms use Grok's `web_search` tool. They're experimental, since there's no date-scoped search for them; their post URLs are checked through each platform's oEmbed endpoint where one exists.

### GitHub Actions

Add an `XAI_API_KEY` repository secret (Settings → Secrets and variables → Actions). Optionally set an `XAI_MODEL` repository variable.

- **Collect daily memes** runs every 6 hours. It keeps a live pick for today and finalizes yesterday, then commits any changes to `data/days`. You can also trigger it manually for a single date.
- **Backfill memes** is manual: give it a `from`/`to` range (e.g. `2026-01-01` → `2026-09-30`) to fill earlier days. Each day is one Grok request, so a full year is about 365 requests per platform.
- **CI** validates data, then lints, typechecks and builds.

## October 2026 seed data

October 1–12, 2026 were researched by hand from published coverage (`collectedBy: "web-research"`). Each item links to the articles it's based on. `sourceUrl` is only set where the original post URL appeared in those sources. To replace them with Grok's picks, run `npm run collect -- --from 2026-10-01 --to 2026-10-12 --force`.
