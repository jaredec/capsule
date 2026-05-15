-- Run this once in Supabase SQL editor.

create table if not exists public.trends (
  id          bigserial primary key,
  date        date not null,
  platform    text not null,
  title       text not null,
  description text not null default '',
  link        text,
  image_url   text,
  created_at  timestamptz not null default now(),
  unique (date, platform)
);

create index if not exists trends_platform_date_idx
  on public.trends (platform, date desc);

alter table public.trends enable row level security;

create policy "trends are readable by anon"
  on public.trends for select
  to anon
  using (true);
