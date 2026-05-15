# Capsule

A daily archive of the biggest viral moment on the internet. Each day a cron job asks Claude (with web search) what the single biggest viral moment was on a given platform, stores it in Supabase, and renders it on a calendar.

MVP: X only. More platforms later.

## Stack

- **Frontend**: Next.js 15 (App Router) on Vercel
- **DB**: Supabase Postgres
- **Cron**: GitHub Actions, daily at 06:00 UTC
- **Research**: Anthropic API (`claude-sonnet-4-6`) with the `web_search` tool

## Layout

```
capsule/
├── frontend/                  # Next.js calendar UI
├── backend/
│   ├── fetch_daily_trend.py   # cron entrypoint
│   ├── schema.sql             # run once in Supabase
│   └── requirements.txt
└── .github/workflows/
    └── fetch_daily_trend.yml  # daily cron
```

## Setup

1. **Supabase** — create a project, run `backend/schema.sql` in the SQL editor.
2. **GitHub secrets** — add `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` to the repo's Actions secrets.
3. **Frontend env** — set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
4. **First run** — trigger the workflow manually in the Actions tab to seed today.

## Local dev

```bash
# frontend
cd frontend
npm install
cp .env.example .env.local   # fill in values
npm run dev

# backend (manual test)
cd backend
pip install -r requirements.txt
cp .env.example .env         # fill in values
export $(cat .env | xargs) && python fetch_daily_trend.py
```
