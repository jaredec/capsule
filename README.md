# Capsule

A daily archive of the biggest viral moment on the internet. Each day a cron job asks Claude (with web search) what the single biggest viral moment was on a given platform, appends it to a JSON file in this repo, and commits. Vercel auto-redeploys.

MVP: X only. More platforms later.

## Stack

- **Frontend**: Next.js 15 (App Router) on Vercel — fully static, reads `frontend/data/trends.json` at build time
- **Cron**: GitHub Actions, daily at 06:00 UTC — runs the Python script, commits the updated JSON
- **Research**: Anthropic API (`claude-sonnet-4-6`) with the `web_search` tool

No database. The git history is the audit log.

## Layout

```
capsule/
├── frontend/
│   ├── data/trends.json       # the entire dataset
│   └── ...                    # Next.js app
├── backend/
│   ├── fetch_daily_trend.py   # cron entrypoint
│   └── requirements.txt
└── .github/workflows/
    └── fetch_daily_trend.yml  # daily cron
```

## Setup

1. **GitHub secret** — repo Settings → Secrets and variables → Actions → add `ANTHROPIC_API_KEY`.
2. **First run** — Actions tab → "Capsule Daily Trend Fetcher" → "Run workflow". If a new commit lands on `main` with an entry in `frontend/data/trends.json`, the pipeline works.
3. **Vercel** — import the repo, set root directory to `frontend`, deploy. No env vars needed.

## Local dev

```bash
# frontend
cd frontend
npm install
npm run dev

# backend (manual test — will write to frontend/data/trends.json)
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python fetch_daily_trend.py
```
