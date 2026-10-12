"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTH_NAMES, WEEKDAYS_SHORT, formatLongDate, monthGrid, parseIsoDate } from "@/lib/dates";
import { usePlatformFilter, useToday } from "@/lib/hooks";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORMS, type Item, type Platform } from "@/lib/schema";
import { FittedImage } from "./FittedImage";
import { ItemDetail } from "./ItemDetail";

type Props = {
  year: number;
  month: number;
  itemsByDate: Record<string, Item[]>;
  prevHref: string | null;
  nextHref: string | null;
};

type DayState = "archived" | "filtered" | "today" | "future" | "missing" | "unknown";

function dayState(date: string, hasVisible: boolean, hasAny: boolean, today: string | null): DayState {
  if (hasVisible) return "archived";
  if (hasAny) return "filtered";
  if (!today) return "unknown";
  if (date === today) return "today";
  return date > today ? "future" : "missing";
}

export function Calendar({ year, month, itemsByDate, prevHref, nextHref }: Props) {
  const today = useToday();
  const [platform, setPlatform] = usePlatformFilter();
  const [selected, setSelected] = useState<string | null>(null);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  const visible = useMemo(() => {
    const out: Record<string, Item[]> = {};
    for (const [date, items] of Object.entries(itemsByDate)) {
      const filtered = platform ? items.filter((i) => i.platform === platform) : items;
      if (filtered.length > 0) out[date] = filtered;
    }
    return out;
  }, [itemsByDate, platform]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
    for (const items of Object.values(itemsByDate)) {
      for (const p of new Set(items.map((i) => i.platform))) c[p]++;
    }
    return c;
  }, [itemsByDate]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl leading-none whitespace-nowrap text-zinc-900 sm:text-6xl md:text-7xl">
          {MONTH_NAMES[month - 1]} <span className="text-zinc-300">{year}</span>
        </h1>
        <div className="flex items-center gap-2">
          <PlatformSelect value={platform} counts={counts} onChange={setPlatform} />
          <nav className="flex gap-2" aria-label="Month navigation">
            <MonthLink href={prevHref} label="Previous month">
              ←
            </MonthLink>
            <MonthLink href={nextHref} label="Next month">
              →
            </MonthLink>
          </nav>
        </div>
      </div>

      {/* Desktop: month grid */}
      <div className="mt-6 hidden md:block">
        <div className="grid grid-cols-7 gap-2 pb-2">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="px-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((date, i) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                items={visible[date] ?? []}
                state={dayState(date, Boolean(visible[date]), Boolean(itemsByDate[date]), today)}
                isToday={date === today}
                onOpen={() => setSelected(date)}
              />
            ) : (
              <div key={`pad-${i}`} aria-hidden />
            ),
          )}
        </div>
      </div>

      {/* Mobile: agenda list */}
      <ol className="mt-6 space-y-2 md:hidden">
        {cells
          .filter((d): d is string => d !== null)
          .map((date) => {
            const items = visible[date] ?? [];
            const state = dayState(date, items.length > 0, Boolean(itemsByDate[date]), today);
            if (state === "future") return null;
            return (
              <li key={date}>
                <AgendaRow date={date} items={items} state={state} onOpen={() => setSelected(date)} />
              </li>
            );
          })}
      </ol>

      {selected && (
        <DayDrawer
          date={selected}
          items={itemsByDate[selected] ?? []}
          platform={platform}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MonthLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const className = "grid size-11 place-items-center rounded-full border text-lg transition-colors";
  if (!href) {
    return (
      <span aria-disabled className={`${className} cursor-not-allowed border-zinc-200 text-zinc-300`} title={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${className} border-zinc-300 text-zinc-700 hover:bg-white`}>
      {children}
    </Link>
  );
}

function PlatformSelect({
  value,
  counts,
  onChange,
}: {
  value: Platform | null;
  counts: Record<Platform, number>;
  onChange: (p: Platform | null) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Platform</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as Platform | null)}
        className="h-11 appearance-none rounded-full border border-zinc-300 bg-white pr-9 pl-4 text-sm text-zinc-700 hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-900"
      >
        <option value="">All platforms</option>
        {PLATFORMS.map((p) => (
          <option key={p} value={p} disabled={counts[p] === 0}>
            {PLATFORM_META[p].label}
            {counts[p] === 0 ? " (soon)" : ""}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-zinc-400">
        ▾
      </span>
    </label>
  );
}

function DayNumber({ day, isToday }: { day: number; isToday: boolean }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums ${
        isToday ? "bg-zinc-900 font-semibold text-white" : "font-medium text-zinc-400"
      }`}
    >
      {day}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 22 22" aria-label="Verified" className="size-3.5 shrink-0 fill-sky-500">
      <path d="M20.4 11c0-1.4-.8-2.6-2-3.2.4-1.3.1-2.8-.9-3.7-1-1-2.4-1.3-3.7-.9C13.2 2 12 1.2 10.6 1.2S8 2 7.4 3.2c-1.3-.4-2.8-.1-3.7.9-1 1-1.3 2.4-.9 3.7C1.6 8.4.8 9.6.8 11s.8 2.6 2 3.2c-.4 1.3-.1 2.8.9 3.7 1 1 2.4 1.3 3.7.9.6 1.2 1.8 2 3.2 2s2.6-.8 3.2-2c1.3.4 2.8.1 3.7-.9 1-1 1.3-2.4.9-3.7 1.2-.6 2-1.8 2-3.2zm-11.3 4.3L5.5 11.7l1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4z" />
    </svg>
  );
}

/** A day's top pick laid out like a compact X post: author, a line of text, then the media uncropped. */
function PostCard({ item, day, isToday }: { item: Item; day: number; isToday: boolean }) {
  const { post, image } = item;
  const text = post?.text || item.title;
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <DayNumber day={day} isToday={isToday} />
        {post && (
          <>
            {post.avatar ? (
              <Image src={post.avatar} alt="" width={20} height={20} unoptimized className="size-5 shrink-0 rounded-full" />
            ) : (
              <span className="size-5 shrink-0 rounded-full bg-zinc-200" />
            )}
            <span className="truncate text-xs font-semibold text-zinc-900">{post.name}</span>
            {post.verified && <VerifiedBadge />}
          </>
        )}
      </span>
      <span className={`mt-1 text-xs leading-snug text-zinc-600 ${image ? "line-clamp-2" : "line-clamp-[9]"}`}>
        {text}
      </span>
      {image && <FittedImage image={image} className="mt-2 min-h-0 flex-1" />}
    </>
  );
}

function DayCell({
  date,
  items,
  state,
  isToday,
  onOpen,
}: {
  date: string;
  items: Item[];
  state: DayState;
  isToday: boolean;
  onOpen: () => void;
}) {
  const { day } = parseIsoDate(date);
  const top = items[0];

  if (!top) {
    return (
      <div
        className={`flex aspect-[3/4] flex-col rounded-2xl p-2 ${
          state === "future" ? "border border-dashed border-zinc-200" : "bg-zinc-200/40"
        }`}
      >
        <DayNumber day={day} isToday={isToday} />
        {state === "today" && <span className="m-auto size-2 animate-pulse rounded-full bg-amber-500" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${formatLongDate(date)}: ${top.title}`}
      className="flex aspect-[3/4] flex-col overflow-hidden rounded-2xl bg-white p-2 text-left ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      <PostCard item={top} day={day} isToday={isToday} />
    </button>
  );
}

function AgendaRow({
  date,
  items,
  state,
  onOpen,
}: {
  date: string;
  items: Item[];
  state: DayState;
  onOpen: () => void;
}) {
  const { day } = parseIsoDate(date);
  const weekday = formatLongDate(date).split(",")[0].slice(0, 3);
  const top = items[0];
  const dateLabel = (
    <div className="w-9 shrink-0 text-center">
      <div className="text-[11px] uppercase text-zinc-400">{weekday}</div>
      <div className={`text-xl tabular-nums ${state === "today" ? "font-semibold text-amber-600" : "text-zinc-900"}`}>
        {day}
      </div>
    </div>
  );

  if (!top) {
    return <div className="flex items-center gap-3 rounded-2xl p-2 opacity-50">{dateLabel}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left ring-1 ring-black/5"
    >
      {dateLabel}
      {top.image ? (
        <FittedImage image={top.image} className="size-16 shrink-0" />
      ) : (
        <div className="size-16 shrink-0 rounded-xl bg-zinc-100" />
      )}
      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-zinc-900">{top.title}</p>
    </button>
  );
}

function DayDrawer({
  date,
  items,
  platform,
  onClose,
}: {
  date: string;
  items: Item[];
  platform: Platform | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const ordered = platform
    ? [...items.filter((i) => i.platform === platform), ...items.filter((i) => i.platform !== platform)]
    : items;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={formatLongDate(date)}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-100 bg-white/90 px-6 py-4 backdrop-blur">
          <Link href={`/day/${date}`} className="font-display text-2xl text-zinc-900 hover:underline">
            {formatLongDate(date)}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 space-y-12 px-6 py-6">
          {ordered.map((item) => (
            <ItemDetail key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
